import { afterEach, describe, expect, it, vi } from "vitest";
import { getTripWeather } from "./services/weatherService";
import { evaluateFeasibility } from "./services/evaluateFeasibility";

// Mock fetch so tests do not depend on today's forecast or network access.
afterEach(() => vi.unstubAllGlobals());
const location = {
  results: [{
    name: "Boston", admin1: "Massachusetts", country: "United States",
    latitude: 42.36, longitude: -71.06, timezone: "America/New_York",
  }],
};
function dailyForecast(code = 0) {
  return { daily: {
    time: ["2026-10-27", "2026-10-28", "2026-10-29"],
    weather_code: [code, code, code],
    temperature_2m_max: [52, 57, 58],
    precipitation_probability_max: [4, 0, 5],
    wind_speed_10m_max: [8.8, 7.9, 10],
  } };
}
const response = (data, ok = true) => ({ ok, json: async () => data });
function mockApi(data = dailyForecast()) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response(location))
    .mockResolvedValueOnce(response(data));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const getWeather = (start = "2026-10-27", end = "2026-10-28", signal) =>
  getTripWeather("Boston, Massachusetts", start, end, signal);
const assess = (weather) => evaluateFeasibility({
  estimatedTotal: 160, budget: 1000, travelTime: 1.3, maxTravelTime: 8, weather,
});

describe("weather API behavior", () => {
  it("returns only trip dates and requests destination timezone and units", async () => {
    const fetchMock = mockApi();
    const data = await getWeather();
    expect(data.days.map((day) => day.date)).toEqual(["2026-10-27", "2026-10-28"]);
    expect(data.location).toBe("Boston, Massachusetts, United States");
    const params = new URL(fetchMock.mock.calls[1][0]).searchParams;
    expect(params.get("timezone")).toBe("America/New_York");
    expect(params.get("temperature_unit")).toBe("fahrenheit");
    expect(params.get("wind_speed_unit")).toBe("mph");
    expect(assess({ status: "success", data }).status).toBe("Feasible");
  });
  it.each([
    ["2026-11-20", "2026-11-21"],
    ["2026-10-26", "2026-10-28"],
    ["2026-10-28", "2026-10-30"],
  ])("rejects trips without full forecast coverage: %s to %s", async (start, end) => {
    mockApi();
    await expect(getWeather(start, end)).rejects.toThrow("full trip forecast is unavailable");
  });
  it("reports an unknown destination", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({})));
    await expect(getWeather()).rejects.toThrow("Destination not found");
  });
  it("reports a failed location lookup", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, false)));
    await expect(getWeather()).rejects.toThrow("Could not look up");
  });
  it("reports a failed forecast request", async () => {
    const fetchMock = mockApi();
    fetchMock.mockReset()
      .mockResolvedValueOnce(response(location))
      .mockResolvedValueOnce(response({}, false));
    await expect(getWeather()).rejects.toThrow("Could not load");
  });
  it.each([{}, { daily: { time: [] } }])("reports absent forecast dates: %j", async (data) => {
    mockApi(data);
    await expect(getWeather()).rejects.toThrow("No forecast is available");
  });
  it("propagates network failures for the component to display", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network unavailable")));
    await expect(getWeather()).rejects.toThrow("Network unavailable");
  });
  it("passes the cancellation signal to both API requests", async () => {
    const fetchMock = mockApi();
    const controller = new AbortController();
    await getWeather("2026-10-27", "2026-10-28", controller.signal);
    expect(fetchMock.mock.calls.every((call) => call[1].signal === controller.signal)).toBe(true);
  });
  it("preserves cancellation errors for the component to ignore", async () => {
    const controller = new AbortController();
    controller.abort();
    const error = new Error("Request aborted");
    error.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(getWeather("2026-10-27", "2026-10-28", controller.signal)).rejects.toBe(error);
  });
  it.each([[61, "Moderate"], [95, "High"], [66, "High"]])(
    "connects forecast code %i to a %s weather warning", async (code, severity) => {
      mockApi(dailyForecast(code));
      const data = await getWeather();
      const result = assess({ status: "success", data });
      expect(result.status).toBe("Feasible with weather warnings");
      expect(result.reasons[0]).toContain(severity);
    },
  );
  it("keeps missing measurements incomplete rather than low risk", async () => {
    const apiData = dailyForecast();
    apiData.daily.wind_speed_10m_max[0] = null;
    mockApi(apiData);
    const data = await getWeather();
    expect(assess({ status: "success", data }).status).toBe("Assessment incomplete");
  });
});