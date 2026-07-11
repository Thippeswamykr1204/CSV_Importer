import { describe, it, expect } from "vitest";
import { aiBatchResponseSchema } from "@/lib/validators/schemas";

const validRecord = {
  created_at: null,
  name: "Jane",
  email: "jane@example.com",
  country_code: "+91",
  mobile_without_country_code: "9876543210",
  company: null,
  city: null,
  state: null,
  country: null,
  lead_owner: null,
  crm_status: null,
  crm_note: null,
  data_source: null,
  possession_time: null,
  description: null,
};

describe("aiBatchResponseSchema", () => {
  it("accepts a well-formed response", () => {
    const result = aiBatchResponseSchema.safeParse({
      items: [
        {
          rowIndex: 0,
          skip: false,
          skipReason: null,
          confidence: 0.9,
          record: validRecord,
          warnings: [],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid crm_status enum value", () => {
    const result = aiBatchResponseSchema.safeParse({
      items: [
        {
          rowIndex: 0,
          skip: false,
          confidence: 0.9,
          record: { ...validRecord, crm_status: "SUPER_HOT_LEAD" },
          warnings: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid data_source enum value", () => {
    const result = aiBatchResponseSchema.safeParse({
      items: [
        {
          rowIndex: 0,
          skip: false,
          confidence: 0.9,
          record: { ...validRecord, data_source: "some_random_project" },
          warnings: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence value outside 0-1", () => {
    const result = aiBatchResponseSchema.safeParse({
      items: [{ rowIndex: 0, skip: false, confidence: 1.4, record: validRecord, warnings: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("defaults missing optional record fields to null rather than failing", () => {
    const result = aiBatchResponseSchema.safeParse({
      items: [{ rowIndex: 0, skip: false, confidence: 0.5, record: { name: "Jane" }, warnings: [] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].record.email).toBeNull();
    }
  });
});
