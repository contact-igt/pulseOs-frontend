import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MarketingPanel } from "../MarketingPanel";
import type { MarketingSourceRow } from "@pulseos/types";

const ROWS: MarketingSourceRow[] = [
  { source: "meta", volume: 4, appointments: 5, consultations: 1, treatmentConversion: 1, revenue: 18000, spend: 185000, roas: 0.1 },
  { source: "google", volume: 5, appointments: 4, consultations: 0, treatmentConversion: 0, revenue: 0, spend: 220000, roas: 0 },
  { source: "referral", volume: 4, appointments: 4, consultations: 0, treatmentConversion: 0, revenue: 0, spend: 0, roas: null },
];

describe("MarketingPanel", () => {
  it("defaults to sorting by enquiries descending", () => {
    render(<MarketingPanel rows={ROWS} />);
    const rows = screen.getAllByTestId(/source-row-/);
    expect(rows[0].getAttribute("data-testid")).toBe("source-row-google");
  });

  it("shows an em dash for a source with no spend data instead of a misleading ROAS", () => {
    render(<MarketingPanel rows={ROWS} />);
    const referralRow = screen.getByTestId("source-row-referral");
    expect(within(referralRow).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("flips to ascending when the already-active sort column is clicked again", () => {
    render(<MarketingPanel rows={ROWS} />);
    fireEvent.click(screen.getByTestId("sort-volume"));
    const rows = screen.getAllByTestId(/source-row-/);
    expect(rows[0].getAttribute("data-testid")).toBe("source-row-meta");
  });
});
