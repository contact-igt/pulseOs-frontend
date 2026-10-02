import { describe, expect, it, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AppointmentRow, JourneyCardVm, PatientListRow } from "@pulseos/types";
import { NewAppointmentDrawer } from "../NewAppointmentDrawer";
import { hospitalLocalInput, setDisplayTimeZone } from "../format";

const patient = { id: "p1", name: "Asha Rao", phone: "9000000001" } as PatientListRow;
const journey = { id: "j1", journeyType: "Cataract", stage: "enquiry" } as unknown as JourneyCardVm;

function setup(over: Partial<Parameters<typeof NewAppointmentDrawer>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue({ id: "a1" } as AppointmentRow);
  render(
    <NewAppointmentDrawer
      open
      onClose={vi.fn()}
      branches={[{ id: "b1", name: "Main" }]}
      doctors={[{ id: "d1", name: "Dr Menon" }, { id: "d2", name: "Dr Rao" }]}
      initialPatient={patient}
      onSearchPatients={vi.fn().mockResolvedValue([])}
      onLoadPatientJourneys={vi.fn().mockResolvedValue([journey])}
      onSubmit={onSubmit}
      {...over}
    />,
  );
  return { onSubmit };
}

async function fillRequired() {
  await waitFor(() => expect((screen.getByLabelText(/Journey/) as HTMLSelectElement).value).toBe("j1"));
  fireEvent.change(screen.getByLabelText(/Branch/), { target: { value: "b1" } });
  fireEvent.change(screen.getByLabelText(/Doctor/), { target: { value: "d1" } });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setDisplayTimeZone("Asia/Kolkata");
});

describe("NewAppointmentDrawer — time and doctor rules", () => {
  it("defaults to tomorrow on the hour in the HOSPITAL's zone and does not let the picker go earlier than now", () => {
    setup();
    const input = screen.getByTestId("appt-time") as HTMLInputElement;
    expect(input.min).toBe(hospitalLocalInput());
    expect(input.value.endsWith(":00")).toBe(true);
    expect(input.value > hospitalLocalInput()).toBe(true);
  });

  it("a time that has already passed is refused in the form, in plain words, and nothing is sent", async () => {
    const { onSubmit } = setup();
    await fillRequired();
    fireEvent.change(screen.getByTestId("appt-time"), { target: { value: "2020-01-01T10:00" } });
    expect(screen.getByTestId("appt-time-past").textContent).toBe("Choose a future appointment time.");
    expect((screen.getByTestId("new-appointment-submit") as HTMLButtonElement).disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("a server 'doctor busy' refusal keeps everything typed and says what to do next", async () => {
    const { onSubmit } = setup();
    onSubmit.mockRejectedValueOnce(new Error("resource_unavailable"));
    await fillRequired();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Review" } });
    fireEvent.click(screen.getByTestId("new-appointment-submit"));
    const msg = await screen.findByTestId("new-appointment-error");
    expect(msg.textContent).toBe("This doctor already has another appointment at this time. Choose a different time or doctor.");
    expect((screen.getByLabelText(/Reason/) as HTMLInputElement).value).toBe("Review");
    expect((screen.getByLabelText(/Doctor/) as HTMLSelectElement).value).toBe("d1");
    expect(screen.queryByText(/409|resource_unavailable/)).toBeNull(); // never a status code or an internal code
  });

  it("a server 'in the past' refusal (e.g. the clock moved on) shows the same short copy", async () => {
    const { onSubmit } = setup();
    onSubmit.mockRejectedValueOnce(new Error("appointment_time_in_past"));
    await fillRequired();
    fireEvent.click(screen.getByTestId("new-appointment-submit"));
    expect((await screen.findByTestId("new-appointment-error")).textContent).toBe("Choose a future appointment time.");
  });

  it("asks the server whether the doctor is free once doctor and time are picked, and warns if not — without naming anyone", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onCheckSlot = vi.fn().mockResolvedValue({ available: false, inPast: false });
    setup({ onCheckSlot });
    await fillRequired();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onCheckSlot).toHaveBeenCalledTimes(1);
    expect(onCheckSlot.mock.calls[0]![0]).toBe("d1");
    expect((await screen.findByTestId("new-appointment-error")).textContent).toContain("This doctor already has another appointment");
    // Choosing another doctor who is free clears the warning.
    onCheckSlot.mockResolvedValue({ available: true, inPast: false });
    fireEvent.change(screen.getByLabelText(/Doctor/), { target: { value: "d2" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await waitFor(() => expect(screen.queryByTestId("new-appointment-error")).toBeNull());
  });
});
