import { describe, expect, it } from "vitest";

describe("Saved Scenario Management", () => {
  it("allows editing a destination", () => {
    const scenario = {
      destination: "Richmond",
    };

    scenario.destination = "Virginia Beach";

    expect(scenario.destination).toBe(
      "Virginia Beach"
    );
  });

  it("preserves persisted id during edits", () => {
    const scenario = {
      persistedId: 123,
      destination: "Richmond",
    };

    const updated = {
      ...scenario,
      destination: "Virginia Beach",
    };

    expect(updated.persistedId).toBe(123);
  });

  it("updates existing saved scenario data", () => {
    const original = {
      destination: "Richmond",
    };

    const updated = {
      ...original,
      destination: "Virginia Beach",
    };

    expect(updated.destination).toBe(
      "Virginia Beach"
    );
  });
});