import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTripWeather } from "./services/weatherService";
import { evaluateFeasibility } from "./services/evaluateFeasibility";

const apiUrl = "https://weather.example.test/trip-weather";
const destination = "Boston, Massachusetts";
const startDate = "2026-10-27";
const endDate = "2026-10-28";

const getWeather = (signal) =>
  getTripWeather(destination, startDate, endDate, signal);

function forecast(weatherCode = 0) {
  return {
    status: "retrieved",
    source: "Open-Meteo",
    location: "Boston, Massachusetts, United States",
    days: [startDate, endDate].map((date) => ({
      date,
      weatherCode,
      temperatureF: 57,
      precipitationChance: 4,
      windMph: 8,
    })),
  };
}

function assess(weather) {
  return evaluateFeasibility({
    estimatedTotal: 160,
    budget: 1000,
    travelTime: 1.3,
    maxTravelTime: 8,
    weather,
  });
}

let fetchMock;

beforeEach(() => {
  vi.stubEnv("VITE_WEATHER_API_URL", apiUrl);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("weather backend integration", () => {
  it("posts the trip once and returns the retrieved forecast", async () => {
    const expected = forecast();
    const controller = new AbortController();
    fetchMock.mockResolvedValue(Response.json(expected));

    const data = await getWeather(controller.signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(apiUrl);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.signal).toBe(controller.signal);
    expect(JSON.parse(options.body)).toEqual({ destination, startDate, endDate });
    expect(data).toEqual(expected);
    expect(assess({ status: "success", data }).status).toBe("Feasible");
  });

  it.each([
    [404, "Destination not found. Try a city name."],
    [422, "The forecast does not cover the full trip."],
    [502, "Weather measurements are incomplete for 2026-10-27."],
    [504, "The forecast request timed out. Please try again."],
  ])("shows the backend explanation for HTTP %i", async (status, message) => {
    fetchMock.mockResolvedValue(
      Response.json({ status: "unavailable", message }, { status })
    );

    await expect(getWeather()).rejects.toThrow(message);
  });

  it("reports a network failure when the backend cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(getWeather()).rejects.toThrow(
      "The weather service could not be reached."
    );
  });

  it("preserves cancellation so an old trip cannot replace the current one", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(controller.signal.reason);

    await expect(getWeather(controller.signal)).rejects.toBe(controller.signal.reason);
  });

  it("reports an unreadable response", async () => {
    fetchMock.mockResolvedValue(new Response("not JSON"));

    await expect(getWeather()).rejects.toThrow("unreadable response");
  });

  it("rejects a retrieved forecast with no days", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...forecast(), days: [] }));

    await expect(getWeather()).rejects.toThrow("No forecast days were returned.");
  });

  it("explains when the backend URL is missing", async () => {
    vi.stubEnv("VITE_WEATHER_API_URL", "");

    await expect(getWeather()).rejects.toThrow("has not been configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([[61, "Moderate"], [95, "High"], [66, "High"]])(
    "connects weather code %i to a %s warning",
    async (code, severity) => {
      fetchMock.mockResolvedValue(Response.json(forecast(code)));

      const data = await getWeather();
      const result = assess({ status: "success", data });

      expect(result.status).toBe("Feasible with weather warnings");
      expect(result.reasons[0]).toContain(severity);
    }
  );

  it("does not treat missing wind measurements as low risk", async () => {
    const partial = forecast();
    partial.days[0].windMph = null;
    fetchMock.mockResolvedValue(Response.json(partial));

    const data = await getWeather();

    expect(assess({ status: "success", data }).status).toBe("Assessment incomplete");
  });
});