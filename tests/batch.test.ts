import { describe, it, expect } from "vitest";
import { createBatches } from "@/lib/services/batch.service";

describe("createBatches", () => {
  it("splits rows evenly when divisible by batch size", () => {
    const rows = Array.from({ length: 50 }, (_, i) => i);
    const batches = createBatches(rows, 25);
    expect(batches).toHaveLength(2);
    expect(batches[0].rows).toHaveLength(25);
    expect(batches[1].rows).toHaveLength(25);
  });

  it("puts the remainder in the final batch", () => {
    const rows = Array.from({ length: 53 }, (_, i) => i);
    const batches = createBatches(rows, 25);
    expect(batches).toHaveLength(3);
    expect(batches[2].rows).toHaveLength(3);
  });

  it("assigns sequential batch indices", () => {
    const rows = Array.from({ length: 60 }, (_, i) => i);
    const batches = createBatches(rows, 25);
    expect(batches.map((b) => b.index)).toEqual([0, 1, 2]);
  });

  it("handles a single row", () => {
    const batches = createBatches([1], 25);
    expect(batches).toHaveLength(1);
    expect(batches[0].rows).toEqual([1]);
  });

  it("handles an empty array", () => {
    const batches = createBatches([], 25);
    expect(batches).toHaveLength(0);
  });
});
