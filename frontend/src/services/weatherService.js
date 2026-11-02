export async function getTripWeather(destination, startDate, endDate, signal) {
  const url = import.meta.env.VITE_WEATHER_API_URL;

  if (!url) {
    throw new Error("The weather service has not been configured.");
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination, startDate, endDate }),
      signal,
    });
  } catch (error) {
    // Let the component cancel an earlier request when trip details change.
    if (signal?.aborted) throw error;
    throw new Error("The weather service could not be reached. Please try again.");
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("The weather service returned an unreadable response.");
  }

  if (!response.ok || result?.status !== "retrieved") {
    throw new Error(result?.message || "Weather information is unavailable.");
  }

  if (!Array.isArray(result.days) || result.days.length === 0) {
    throw new Error("No forecast days were returned.");
  }

  return result;
}