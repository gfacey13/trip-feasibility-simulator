import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import TripSummary from "./TripSummary";
import FeasibilityAnalysis from "./FeasibilityAnalysis";
import UserDashboard from "./UserDashboard";
import { evaluateFeasibility } from "./services/evaluateFeasibility";
import { readSavedTrip } from "./services/savedTripStorage";

const day = { date: "2026-11-02", weatherCode: 0, temperatureF: 55, precipitationChance: 0, windMph: 8 };
const success = { status: "success", data: { location: "Boston", days: [day] } };
const tripForm = { origin: "Norfolk", destination: "Boston", startDate: "2026-11-02", endDate: "2026-11-03", travelers: "2", transportation: "car", budget: "1000" };
function renderPair({ travelTime = 1.3, maxTravelTime = 8, weather = success, budget = 1000 } = {}) {
  const analysis = evaluateFeasibility({ estimatedTotal: 160, budget, travelTime, maxTravelTime, weather });
  const props = { estimatedTotal: 160, travelTime, budget, maxTravelTime, weather, analysis };
  return {
    analysis,
    main: renderToStaticMarkup(createElement(FeasibilityAnalysis, props)),
    report: renderToStaticMarkup(createElement(TripSummary, {
      ...props, tripForm: { ...tripForm, budget: String(budget) },
      transportationTotal: 60, lodgingTotal: 100, estimatedTravelTime: travelTime.toFixed(1),
    })),
  };
}
describe("report integration", () => {
  it.each([
    [{}, "Feasible"],
    [{ budget: 100 }, "Not feasible"],
    [{ travelTime: 11.7 }, "Not feasible"],
    [{ weather: null }, "Checking weather"],
    [{ weather: { status: "error", error: "Forecast unavailable for these dates." } }, "Assessment incomplete"],
    [{ weather: { ...success, data: { ...success.data, days: [{ ...day, weatherCode: 95 }] } } }, "Feasible with weather warnings"],
  ])("keeps report and main assessment consistent for %j", (options, status) => {
    const result = renderPair(options);
    expect(result.analysis.status).toBe(status);
    expect(result.report).toContain(status);
    expect(result.main).toContain(status);
  });
  it("shows returned weather instead of a permanent placeholder", () => {
    const { report } = renderPair();
    expect(report).toContain("55°F");
    expect(report).toContain("0%");
    expect(report).not.toContain("Currently unavailable");
    for (const value of ["Norfolk", "Boston", "2026-11-02", "$60", "$100", "$160"]) expect(report).toContain(value);
  });
  it("explains weather failure in the report", () => {
    expect(renderPair({ weather: { status: "error", error: "Forecast unavailable for these dates." } }).report)
      .toContain("Forecast unavailable for these dates.");
  });
});

const saved = { ...tripForm, cost: "160", travelTime: "1.3" };
const storageFor = (value) => ({ getItem: () => value });
describe("device saved trip integration", () => {
  it("loads legacy snapshots and derives their budget result", () => {
    const trip = readSavedTrip(storageFor(JSON.stringify(saved)));
    expect(trip.budgetResult).toBe("Within budget");
    const html = renderToStaticMarkup(createElement(UserDashboard, { savedTrip: trip }));
    expect(html).toContain("Boston");
    expect(html).toContain("$160.00");
    expect(html).toContain("checks budget only");
  });
  it.each([null, "bad JSON", "[]", "{}", JSON.stringify({ ...saved, destination: {} }), JSON.stringify({ ...saved, cost: "NaN" }), JSON.stringify({ ...saved, budget: 0 })])(
    "does not crash the page on corrupt storage: %s", (stored) => {
      const trip = readSavedTrip(storageFor(stored));
      expect(trip).toBeNull();
      expect(renderToStaticMarkup(createElement(UserDashboard, { savedTrip: trip }))).toContain("No saved trip yet");
    },
  );
  it("handles browsers that block local storage", () => {
    expect(readSavedTrip({ getItem() { throw new Error("Storage blocked"); } })).toBeNull();
  });
});
