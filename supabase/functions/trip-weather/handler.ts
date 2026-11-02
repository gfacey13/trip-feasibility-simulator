const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function unavailable(message: string, status: number) {
  return Response.json(
    { status: "unavailable", message },
    { status, headers },
  );
}

function isTripDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function handleTripWeather(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return Response.json(
      { message: "Use POST to request a trip forecast." },
      { status: 405, headers: { ...headers, Allow: "POST, OPTIONS" } },
    );
  }

  // Validate the trip before contacting the weather service.
  let body;
  try {
    body = await request.json();
  } catch {
    return unavailable("Send the trip details as valid JSON.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return unavailable("Send a destination, start date, and end date.", 400);
  }

  const { startDate, endDate } = body;
  const destination =
    typeof body.destination === "string" ? body.destination.trim() : "";

  if (!destination) {
    return unavailable("Enter a destination.", 400);
  }

  if (!isTripDate(startDate) || !isTripDate(endDate)) {
    return unavailable("Enter valid travel dates in YYYY-MM-DD format.", 400);
  }

  if (endDate <= startDate) {
    return unavailable("The end date must be after the start date.", 400);
  }

  // Look up the city's coordinates.
  const searchParams = new URLSearchParams({
    name: destination,
    count: "1",
    language: "en",
    format: "json",
  });

  const lookupTimeout = AbortSignal.timeout(5000);
  let location;

  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?${searchParams}`,
      { signal: lookupTimeout },
    );

    if (!response.ok) {
      return unavailable("The destination lookup is unavailable.", 502);
    }

    const data = await response.json();
    location = data?.results?.[0];

    if (!location) {
      return unavailable("Destination not found. Try a city name.", 404);
    }

    if (
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude)
    ) {
      return unavailable("The destination is missing coordinates.", 502);
    }
  } catch {
    if (lookupTimeout.aborted) {
      return unavailable("The destination lookup timed out. Please try again.", 504);
    }

    return unavailable("The destination lookup could not be completed.", 502);
  }

  // Request the same measurements and units the frontend already uses.
  const forecastParams = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "precipitation_probability_max",
      "wind_speed_10m_max",
    ].join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: location.timezone || "auto",
    forecast_days: "16",
  });

  const forecastTimeout = AbortSignal.timeout(5000);

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${forecastParams}`,
      { signal: forecastTimeout },
    );

    if (!response.ok) {
      return unavailable("The weather forecast could not be retrieved.", 502);
    }

    const forecast = await response.json();
    const daily = forecast?.daily;

    if (!Array.isArray(daily?.time) || daily.time.length === 0) {
      return unavailable("No forecast dates are available.", 502);
    }

    const days = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);

    // Include the start and end dates and check for gaps between them.
    while (true) {
      const date = cursor.toISOString().slice(0, 10);
      const index = daily.time.indexOf(date);

      if (index === -1) {
        return unavailable(
          `The forecast does not cover the full trip. No forecast is available for ${date}.`,
          422,
        );
      }

      const day = {
        date,
        weatherCode: daily.weather_code?.[index],
        temperatureF: daily.temperature_2m_max?.[index],
        precipitationChance: daily.precipitation_probability_max?.[index],
        windMph: daily.wind_speed_10m_max?.[index],
      };

      const measurements = [
        day.weatherCode,
        day.temperatureF,
        day.precipitationChance,
        day.windMph,
      ];

      if (!measurements.every(Number.isFinite)) {
        return unavailable(`Weather measurements are incomplete for ${date}.`, 502);
      }

      days.push(day);

      if (date === endDate) break;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return Response.json(
      {
        status: "retrieved",
        source: "Open-Meteo",
        location: [location.name, location.admin1, location.country]
          .filter(Boolean)
          .join(", "),
        days,
      },
      { headers },
    );
  } catch {
    if (forecastTimeout.aborted) {
      return unavailable("The forecast request timed out. Please try again.", 504);
    }

    return unavailable("The weather forecast could not be retrieved.", 502);
  }
}