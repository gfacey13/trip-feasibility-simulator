import { handleTripWeather } from "./handler.ts";

Deno.test("reports incomplete weather when a wind reading is missing", async () => {
  const originalFetch = globalThis.fetch;

  // Simulate the city lookup, followed by a forecast with one missing reading.
  const responses = [
    {
      results: [{
        name: "Baltimore",
        latitude: 39.29,
        longitude: -76.61,
        timezone: "America/New_York",
      }],
    },
    {
      daily: {
        time: ["2026-11-03", "2026-11-04"],
        weather_code: [0, 0],
        temperature_2m_max: [65, 66],
        precipitation_probability_max: [0, 0],
        wind_speed_10m_max: [5, null],
      },
    },
  ];

  try {
    globalThis.fetch = async () => Response.json(responses.shift());

    const request = new Request("http://localhost/trip-weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: "Baltimore",
        startDate: "2026-11-03",
        endDate: "2026-11-04",
      }),
    });

    const response = await handleTripWeather(request);
    const result = await response.json();

    if (
      response.status !== 502 ||
      result.status !== "unavailable" ||
      !result.message?.includes("2026-11-04")
    ) {
      throw new Error(`Expected a missing-data error for November 4. Got ${JSON.stringify(result)}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("returns 504 when the forecast request times out", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  try {
    globalThis.fetch = async (_input, options) => {
      calls++;

      if (calls === 1) {
        return Response.json({
          results: [{
            name: "Baltimore",
            latitude: 39.29,
            longitude: -76.61,
            timezone: "America/New_York",
          }],
        });
      }

      const signal = options?.signal;
      if (!signal) throw new Error("Forecast request is missing its timeout signal.");

      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    };

    const request = new Request("http://localhost/trip-weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: "Baltimore",
        startDate: "2026-11-03",
        endDate: "2026-11-04",
      }),
    });

    const response = await handleTripWeather(request);
    const result = await response.json();

    if (
      response.status !== 504 ||
      result.status !== "unavailable" ||
      !result.message?.includes("forecast request timed out")
    ) {
      throw new Error(`Expected a forecast timeout. Got ${JSON.stringify(result)}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});