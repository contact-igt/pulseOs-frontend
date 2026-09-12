import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedRadial } from "../SegmentedRadial";

const SEGMENTS = [
  { key: "contacted", label: "Contacted", count: 19, pct: 83, color: "#3b6fb0" },
  { key: "booked", label: "Appointment Booked", count: 15, pct: 65, color: "#2f8f8a" },
];

describe("SegmentedRadial", () => {
  it("renders the centre metric and every segment's count and percentage", () => {
    render(<SegmentedRadial title="Journey Health" segments={SEGMENTS} centerLabel="Journey Conversion" centerValue="26%" />);
    expect(screen.getByText("26%")).toBeTruthy();
    expect(screen.getByText("Journey Conversion")).toBeTruthy();
    expect(screen.getByText("Contacted")).toBeTruthy();
    expect(screen.getByText("19")).toBeTruthy();
    expect(screen.getByText("83%")).toBeTruthy();
  });

  it("invokes onSegmentClick with the segment key when a legend row is clicked", () => {
    const onSegmentClick = vi.fn();
    render(<SegmentedRadial title="Journey Health" segments={SEGMENTS} centerLabel="Journey Conversion" centerValue="26%" onSegmentClick={onSegmentClick} />);
    fireEvent.click(screen.getByTestId("radial-segment-booked"));
    expect(onSegmentClick).toHaveBeenCalledWith("booked");
  });
});
