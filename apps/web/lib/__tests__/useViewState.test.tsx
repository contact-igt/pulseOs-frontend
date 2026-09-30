import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// A tiny stand-in for the Next router: the URL is the only state.
let search = "";
const replace = vi.fn((url: string) => {
  search = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/my-work",
  useSearchParams: () => new URLSearchParams(search),
}));

import { useViewState } from "../useViewState";

const opts = { views: ["list", "calendar"] as const, defaultView: "list" as const, defaultRange: "week" as const, timeZone: "Asia/Kolkata" };

describe("useViewState calendar mode", () => {
  beforeEach(() => {
    search = "";
    replace.mockClear();
  });

  it("calendar mode follows the range until Agenda is picked", () => {
    search = "view=calendar&range=month";
    expect(renderHook(() => useViewState(opts)).result.current.calendarMode).toBe("month");
  });

  it("Agenda lives in the URL (cal=agenda) and keeps the range as its span", () => {
    search = "view=calendar&range=month&status=open";
    renderHook(() => useViewState(opts)).result.current.setCalendarMode("agenda");
    expect(new URLSearchParams(search).get("cal")).toBe("agenda");
    expect(new URLSearchParams(search).get("range")).toBe("month");
    expect(new URLSearchParams(search).get("status")).toBe("open");
    const again = renderHook(() => useViewState(opts)).result.current;
    expect(again.calendarMode).toBe("agenda");
    expect(again.range).toBe("month");
  });

  it("picking a grid mode clears Agenda and drops a default range from the URL", () => {
    search = "view=calendar&range=month&cal=agenda";
    renderHook(() => useViewState(opts)).result.current.setCalendarMode("week");
    expect(search).toBe("view=calendar");
  });

  it("two updates in one handler both land (open a day from month view: date + Day mode)", () => {
    search = "view=calendar&range=month&date=2026-09-01";
    const s = renderHook(() => useViewState(opts)).result.current;
    s.setDate("2026-09-29");
    s.setCalendarMode("day");
    const url = new URLSearchParams(search);
    expect(url.get("date")).toBe("2026-09-29");
    expect(url.get("range")).toBe("day");
  });
});
