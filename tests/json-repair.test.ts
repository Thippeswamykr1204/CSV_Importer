import { describe, it, expect } from "vitest";
import { repairAndParseJson } from "@/lib/ai/json-repair";

describe("repairAndParseJson", () => {
  it("parses clean JSON as-is", () => {
    const result = repairAndParseJson('{"a": 1}');
    expect(result).toEqual({ a: 1 });
  });

  it("strips markdown code fences", () => {
    const result = repairAndParseJson('```json\n{"a": 1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it("strips plain markdown fences without a language tag", () => {
    const result = repairAndParseJson('```\n{"a": 1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it("extracts a JSON object surrounded by prose", () => {
    const result = repairAndParseJson('Sure, here is the result:\n{"a": 1}\nLet me know if you need anything else.');
    expect(result).toEqual({ a: 1 });
  });

  it("removes trailing commas", () => {
    const result = repairAndParseJson('{"a": 1, "b": [1, 2, 3,],}');
    expect(result).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("returns null for unrecoverable garbage", () => {
    const result = repairAndParseJson("not json at all, sorry, I can't help with that");
    expect(result).toBeNull();
  });
});
