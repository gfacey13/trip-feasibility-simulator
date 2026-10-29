import { describe, it, expect } from "vitest";
import { evaluateFeasibility } from "./services/evaluateFeasibility";
import { getWeatherRisk } from "./services/weatherRisk";

const clearDay = { weatherCode: 0, windMph: 10, precipitationChance: 5 };
const forecast = (...days) => ({ status: "success", data: { days } });
const base = {
  estimatedTotal: 651, budget: 20000,
  travelTime: 700 / 60, maxTravelTime: 12,
  weather: forecast(clearDay),
};

describe("combined feasibility assessment", () => {
  it("accepts a trip within all assessed constraints", () => {
    expect(evaluateFeasibility(base).status).toBe("Feasible");
  });
  it("rejects the screenshot's 700-mile trip when the user chooses 8 hours", () => {
    expect(evaluateFeasibility({ ...base, maxTravelTime: 8 }).status).toBe("Not feasible");
  });
  it("does not round travel time before comparing it to the limit", () => {
    expect(evaluateFeasibility({ ...base, travelTime: 8.04, maxTravelTime: 8 }).status).toBe("Not feasible");
  });
  it("accepts exact budget and time boundaries", () => {
    expect(evaluateFeasibility({ ...base, estimatedTotal: 20000, travelTime: 12 }).status).toBe("Feasible");
  });
  it("reports budget and time failures together, even without weather", () => {
    const result = evaluateFeasibility({ ...base, estimatedTotal: 21000, maxTravelTime: 8, weather: null });
    expect(result.status).toBe("Not feasible");
    expect(result.reasons).toHaveLength(2);
  });
  it.each([null, { status: "loading" }])("waits for weather: %j", (weather) => {
    expect(evaluateFeasibility({ ...base, weather }).status).toBe("Checking weather");
  });
  it.each([{ status: "error" }, forecast(), forecast({ ...clearDay, windMph: null })])(
    "does not mark missing weather as fully feasible: %j", (weather) => {
      expect(evaluateFeasibility({ ...base, weather }).status).toBe("Assessment incomplete");
    },
  );
  it.each([20, 35])("warns about elevated wind at %i mph", (windMph) => {
    expect(evaluateFeasibility({ ...base, weather: forecast({ ...clearDay, windMph }) }).status)
      .toBe("Feasible with weather warnings");
  });
  it("uses the highest risk across trip days", () => {
    const result = evaluateFeasibility({
      ...base, weather: forecast(clearDay, { ...clearDay, weatherCode: 95 }),
    });
    expect(result.reasons[0]).toContain("High weather risk");
  });
  it("preserves known warnings when other measurements are missing", () => {
    const result = evaluateFeasibility({
      ...base, weather: forecast({ ...clearDay, weatherCode: 95, windMph: null }),
    });
    expect(result.status).toBe("Assessment incomplete");
    expect(result.reasons[0]).toContain("High weather risk");
  });
  it.each([0, -1, NaN, Infinity])("rejects invalid time limits: %s", (maxTravelTime) => {
    expect(evaluateFeasibility({ ...base, maxTravelTime }).status).toBe("Assessment incomplete");
  });
});

describe("weather risk completeness", () => {
  it("does not mistake missing values for zero", () => {
    expect(getWeatherRisk({ ...clearDay, windMph: null }).level).toBe("Unknown");
    expect(getWeatherRisk({ ...clearDay, windMph: 0, precipitationChance: 0 }).complete).toBe(true);
  });
  it("keeps a high warning when precipitation also triggers a moderate warning", () => {
    expect(getWeatherRisk({ ...clearDay, weatherCode: 95, precipitationChance: 90 }).level).toBe("High");
  });
});