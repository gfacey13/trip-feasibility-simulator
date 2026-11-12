// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import ScenarioComparison from "./ScenarioComparison";

it("keeps the updated fare and requires a manual time when the new mode has no route", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const tripForm = {
    origin: "Norfolk", destination: "Boston", startDate: "2026-11-15",
    endDate: "2026-11-21", transportation: "car", travelers: "2", budget: "10000",
  };
  const save = vi.fn();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  try {
    await act(async () => root.render(createElement(ScenarioComparison, {
      user: { id: "traveler" }, tripForm, estimatedTotal: 5784.30,
      estimatedTravelTime: "11.6", showResults: true, calculationId: 1,
      reportContext: {
        tripForm, estimatedTotal: 5784.30, estimatedTravelTime: "11.6",
        lodgingTotal: 5544.30, transportationTotal: 240, maxTravelTime: 20,
        travelEstimate: { distanceMiles: 629, durationMinutes: 694.56, source: "OpenRouteService", oneWay: true },
      },
      onSaveTrip: save,
    })));
    const click = async (scope, label) => {
      const button = [...scope.querySelectorAll("button")].find((item) => item.textContent.trim() === label);
      await act(async () => button.click());
    };
    await click(container, "Duplicate Scenario");
    const [original, duplicate] = container.querySelectorAll(".scenario-card");
    const mode = duplicate.querySelector("select");
    await act(async () => {
      mode.value = "train";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const time = duplicate.querySelector('[id^="travelTime-"]');
    expect(time.value).toBe("");
    expect(duplicate.textContent).toContain("Travel Time: Unavailable");
    expect(duplicate.querySelector('[id^="cost-"]').value).toBe("");
    expect(original.querySelector('[id^="travelTime-"]').value).toBe("11.6");
    const fare = duplicate.querySelector('[id^="fare-"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(fare, "300");
      fare.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(duplicate.querySelector('[id^="cost-"]').value).toBe("5844.3");
    await click(duplicate, "Select Preferred");
    await click(container, "Save Preferred Scenario");
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(time, "14");
      time.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(container, "Save Preferred Scenario");
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      transportation: "train", cost: "5844.3",
      report: expect.objectContaining({
        lodgingTotal: 5544.30, transportationTotal: 300,
        travelEstimate: null,
      }),
    }));
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
