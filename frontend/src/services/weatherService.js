// "export" lets other files import and use this function.
// "async" allows us to wait for API responses using "await".
export async function getTripWeather(
  destination, // City entered by the user.
  startDate,   // Trip start date: "YYYY-MM-DD".
  endDate,     // Trip end date: "YYYY-MM-DD".
  signal       // Lets the calling component cancel an outdated request.
) {
  // Weather APIs need latitude and longitude rather than a city name.
  // First, we ask the location-search API to find those coordinates.
  //
  // URLSearchParams safely formats values for a URL, including spaces
  // and special characters in names such as "New York".
  const locationParams = new URLSearchParams({
    name: destination.trim(), // Remove spaces around the city name.
    count: "1",               // Return only the first matching location.
    language: "en",          // Request location names in English.
    format: "json",          // Request structured JSON data.
  });

  // fetch() sends the request.
  // await pauses this function until the response arrives.
  const locationResponse = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${locationParams}`,
    { signal }
  );

  // A response can arrive successfully but contain an HTTP error.
  // For example, the API might temporarily be unavailable.
  if (!locationResponse.ok) {
    throw new Error("Could not look up the destination.");
  }

  // Convert the response body into a JavaScript object.
  const locationData = await locationResponse.json();

  // results is an array of matching locations.
  // [0] selects the first match.
  // ?. prevents an error if the API returned no results array.
  const location = locationData.results?.[0];

  if (!location) {
    throw new Error("Destination not found. Try a city and state.");
  }

  // Now that we have coordinates, prepare the forecast request.
  const weatherParams = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),

    // Ask for these four measurements for each forecast day.
    // join(",") turns the array into the comma-separated list
    // expected by the API.
    daily: [
      "weather_code",                  // Code describing conditions.
      "temperature_2m_max",            // Highest daily temperature.
      "precipitation_probability_max", // Highest precipitation chance.
      "wind_speed_10m_max",            // Highest daily wind speed.
    ].join(","),

    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",

    // Use the destination's timezone so dates match local days there.
    timezone: location.timezone,

    // Request the available forecast window, up to 16 days.
    forecast_days: "16",
  });

  const weatherResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?${weatherParams}`,
    { signal }
  );

  if (!weatherResponse.ok) {
    throw new Error("Could not load the weather forecast.");
  }

  const weatherData = await weatherResponse.json();

  // The API groups daily measurements into parallel arrays.
  // For example:
  // time[0] is the first date.
  // temperature_2m_max[0] is the temperature for that same date.
  const daily = weatherData.daily;

  // Stop if the response contains no forecast dates.
  if (!daily?.time?.length) {
    throw new Error("No forecast is available.");
  }

  // Find the earliest and latest dates the API actually returned.
  const firstDate = daily.time[0];
  const lastDate = daily.time[daily.time.length - 1];

  // Dates in YYYY-MM-DD format can be compared as strings.
  // Require coverage for the entire trip so a partial forecast
  // does not accidentally appear to cover every day.
  if (startDate < firstDate || endDate > lastDate) {
    throw new Error(
      `The full trip forecast is unavailable. Available dates: ${firstDate} through ${lastDate}.`
    );
  }

  // Turn the API's parallel arrays into one object per trip day.
  // flatMap() lets us both skip unwanted days and build the result.
  const days = daily.time.flatMap((date, index) => {
    // Returning an empty array skips dates outside the trip.
    // Both the start date and end date are included.
    if (date < startDate || date > endDate) return [];

    // The same index selects measurements belonging to this date.
    // Our shorter field names will be easier to use in the UI.
    return [{
      date,
      weatherCode: daily.weather_code[index],
      temperatureF: daily.temperature_2m_max[index],
      precipitationChance:
        daily.precipitation_probability_max[index],
      windMph: daily.wind_speed_10m_max[index],
    }];
  });

  // Return a simple object for the React component to display.
  return {
    // Build a readable location such as "Boston, Massachusetts,
    // United States". filter(Boolean) removes missing fields.
    location: [location.name, location.admin1, location.country]
      .filter(Boolean)
      .join(", "),

    days,
  };
}