import { describe, it, expect } from "vitest";
import { normalizeBatchItem } from "@/lib/services/normalizer.service";
import type { AiBatchItem } from "@/lib/validators/schemas";

function makeItem(overrides: Partial<AiBatchItem> = {}): AiBatchItem {
  return {
    rowIndex: 0,
    skip: false,
    skipReason: null,
    confidence: 0.9,
    warnings: [],
    record: {
      created_at: null,
      name: "Jane Doe",
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
    },
    ...overrides,
  };
}

describe("normalizeBatchItem", () => {
  it("imports a record with a valid email and phone", () => {
    const result = normalizeBatchItem(makeItem(), {});
    expect(result.kind).toBe("imported");
  });

  it("skips a record when the AI explicitly flags skip: true", () => {
    const result = normalizeBatchItem(
      makeItem({ skip: true, skipReason: "No contact info" }),
      {}
    );
    expect(result.kind).toBe("skipped");
    if (result.kind === "skipped") {
      expect(result.record.reason).toBe("No contact info");
    }
  });

  it("forcibly skips a record with neither email nor phone, even if the model said skip: false", () => {
    const item = makeItem({
      skip: false,
      record: {
        ...makeItem().record,
        email: null,
        mobile_without_country_code: null,
      },
    });
    const result = normalizeBatchItem(item, {});
    expect(result.kind).toBe("skipped");
  });

  it("keeps a record with only an email (no phone)", () => {
    const item = makeItem({
      record: { ...makeItem().record, mobile_without_country_code: null, country_code: null },
    });
    const result = normalizeBatchItem(item, {});
    expect(result.kind).toBe("imported");
  });

  it("keeps a record with only a phone (no email)", () => {
    const item = makeItem({ record: { ...makeItem().record, email: null } });
    const result = normalizeBatchItem(item, {});
    expect(result.kind).toBe("imported");
  });

  it("treats whitespace-only email/phone as absent", () => {
    const item = makeItem({
      record: {
        ...makeItem().record,
        email: "   ",
        mobile_without_country_code: "   ",
      },
    });
    const result = normalizeBatchItem(item, {});
    expect(result.kind).toBe("skipped");
  });

  it("trims stray whitespace from string fields", () => {
    const item = makeItem({ record: { ...makeItem().record, name: "  Jane Doe  " } });
    const result = normalizeBatchItem(item, {});
    expect(result.kind).toBe("imported");
    if (result.kind === "imported") {
      expect(result.record.record.name).toBe("Jane Doe");
    }
  });

  it("clamps confidence into the 0-1 range", () => {
    const item = makeItem({ confidence: 1.5 });
    const result = normalizeBatchItem(item, {});
    if (result.kind === "imported") {
      expect(result.record.confidence).toBe(1);
    }
  });
});
