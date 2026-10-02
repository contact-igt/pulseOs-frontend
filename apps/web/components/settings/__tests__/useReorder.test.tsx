import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useReorder } from "../SortableList";

const LABELS: Record<string, string> = { a: "New enquiry", b: "Needs callback", c: "Wrong number" };
const base = { label: (id: string) => LABELS[id] ?? id };
const list = [{ id: "a" }, { id: "b" }, { id: "c" }];

function setup(save: (group: "contacted", ids: string[]) => Promise<unknown>, refresh = vi.fn(async () => {})) {
  return { refresh, ...renderHook(() => useReorder<"contacted">({ ...base, save, refresh })) };
}

describe("useReorder", () => {
  it("shows the new order at once, saves it, and announces the new position", async () => {
    let release!: () => void;
    const save = vi.fn(() => new Promise<void>((r) => (release = r)));
    const { result } = setup(save);

    let done!: Promise<void>;
    act(() => {
      done = result.current.reorder("contacted", ["b", "a", "c"], "b");
    });
    expect(result.current.ordered("contacted", list).map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(result.current.isSaving("contacted")).toBe(true);
    expect(result.current.statusOf("b")).toBe("saving");
    expect(save).toHaveBeenCalledWith("contacted", ["b", "a", "c"]);

    await act(async () => {
      release();
      await done;
    });
    expect(result.current.isSaving("contacted")).toBe(false);
    expect(result.current.statusOf("b")).toBe("idle");
    expect(result.current.announcement).toBe("Needs callback moved to position 1 of 3.");
    expect(result.current.error).toBeNull();
  });

  it("puts the old order back on a failed save, says so, and marks the moved row failed", async () => {
    const { result } = setup(vi.fn(async () => { throw new Error("boom"); }));
    await act(async () => {
      await result.current.reorder("contacted", ["c", "a", "b"], "c", "grip", ["a", "b", "c"]);
    });
    expect(result.current.ordered("contacted", list).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(result.current.error).toMatch(/put back/i);
    expect(result.current.statusOf("c")).toBe("failed");
    expect(result.current.announcement).toMatch(/Wrong number is back at position 3 of 3/);
  });

  it("keeps items that were not part of the saved order after the ordered ones", async () => {
    let release!: () => void;
    const { result } = setup(vi.fn(() => new Promise<void>((r) => (release = r))));
    act(() => void result.current.reorder("contacted", ["b", "a"], "b"));
    expect(result.current.ordered("contacted", list).map((x) => x.id)).toEqual(["b", "a", "c"]);
    await act(async () => release());
  });

  it("refreshes after a successful save and not after a failed one", async () => {
    const ok = setup(vi.fn(async () => {}));
    await act(async () => void (await ok.result.current.reorder("contacted", ["b", "a", "c"], "b")));
    expect(ok.refresh).toHaveBeenCalledTimes(1);
    const bad = setup(vi.fn(async () => { throw new Error("x"); }));
    await act(async () => void (await bad.result.current.reorder("contacted", ["b", "a", "c"], "b")));
    expect(bad.refresh).not.toHaveBeenCalled();
  });

  it("ignores a second reorder while one is saving", async () => {
    let release!: () => void;
    const save = vi.fn(() => new Promise<void>((r) => (release = r)));
    const { result } = setup(save);
    act(() => void result.current.reorder("contacted", ["b", "a", "c"], "b"));
    await act(async () => void (await result.current.reorder("contacted", ["c", "b", "a"], "c")));
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });

  it("records which control to give focus back to after an arrow move", async () => {
    const { result } = setup(vi.fn(async () => {}));
    await act(async () => void (await result.current.reorder("contacted", ["b", "a", "c"], "b", "down")));
    expect(result.current.focusRequest).toMatchObject({ id: "b", control: "down" });
  });
});
