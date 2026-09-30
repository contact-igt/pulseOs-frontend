import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/appointments", useSearchParams: () => new URLSearchParams("") }));

import type { AppointmentRow } from "@pulseos/types";
import { useAppointmentActions } from "../hooks";

const row = { id: "a1" } as AppointmentRow;

async function reschedule(fetchImpl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  const onDone = vi.fn();
  const { result } = renderHook(() => useAppointmentActions({ refresh: vi.fn(), onDone }));
  await act(() => result.current.handleReschedule(row, "2026-10-02T04:30:00.000Z"));
  return { onDone, error: result.current.error };
}

describe("useAppointmentActions (the drawer keeps what the user typed on a recoverable failure)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a network failure keeps the drawer open and reports the error", async () => {
    const { onDone, error } = await reschedule(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(onDone).not.toHaveBeenCalled();
    expect(error).toMatch(/try again/i);
  });

  it("a state change on the server (409) closes the drawer: the appointment is no longer what the user saw", async () => {
    const { onDone, error } = await reschedule(async () => new Response(JSON.stringify({ error: "appointment_closed" }), { status: 409 }));
    expect(onDone).toHaveBeenCalled();
    expect(error).toMatch(/already closed/i);
  });

  it("success closes the drawer", async () => {
    const { onDone, error } = await reschedule(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(onDone).toHaveBeenCalled();
    expect(error).toBeNull();
  });
});
