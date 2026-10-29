import { useEffect, useState } from "react";
import { getTripWeather } from "./services/weatherService";
import { getWeatherRisk } from "./services/weatherRisk";

function WeatherDelayChecker({ destination, startDate, endDate, onForecastChange }) {
  // Keep loading, success, and error information together.
  const [forecast, setForecast] = useState({
    status: "loading",
    data: null,
    error: "",
  });

  // Run the request when the component appears or trip details change.
  useEffect(() => {
    // This controller lets us cancel requests for an old trip.
    const controller = new AbortController();

    // App passes a stable state setter. Send the same request state to
    // both displays so the overall result updates when weather arrives.
    function publish(nextForecast) {
      setForecast(nextForecast);
      onForecastChange?.(nextForecast);
    }

    async function loadWeather() {
      publish({
        status: "loading",
        data: null,
        error: "",
      });

      try {
        const data = await getTripWeather(
          destination,
          startDate,
          endDate,
          controller.signal
        );

        // Ignore a result if the user has already changed the trip.
        if (controller.signal.aborted) return;

        publish({
          status: "success",
          data,
          error: "",
        });
      } catch (error) {
        // Cancellation is expected when the trip changes.
        // It should not appear as an error to the user.
        if (controller.signal.aborted) return;

        publish({
          status: "error",
          data: null,
          error: error.message || "Could not load weather.",
        });
      }
    }

    loadWeather();

    // React runs this cleanup when details change or the component
    // disappears. Cancel any request that is still running.
    return () => controller.abort();
  }, [destination, startDate, endDate, onForecastChange]);

  return (
    <section>
      <h2>Weather / Delay Checker</h2>

      {forecast.status === "loading" && (
        <p role="status">Loading weather forecast...</p>
      )}

      {forecast.status === "error" && (
        <p role="alert">{forecast.error}</p>
      )}

      {forecast.status === "success" && (
        <>
          {/* Show the matched location so the user can verify it. */}
          <p>Forecast for: {forecast.data.location}</p>

          {/* Turn each day's data into a row in the table. */}
          <div className="weather-table-scroll" role="region" aria-label="Daily weather forecast" tabIndex={0}>
          <table className="weather-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">High temperature</th>
                <th scope="col">Precipitation chance</th>
                <th scope="col">Maximum wind</th>
                <th scope="col">Weather risk</th>
              </tr>
            </thead>

            <tbody>
              {forecast.data.days.map((day) => {
                // Calculate warnings from this day only; keep rendering separate.
                const risk = getWeatherRisk(day);
                return (
                <tr key={day.date}>
                  <td>{day.date}</td>

                  {/* Missing measurements display as unavailable.
                      A real value of zero still displays correctly. */}
                  <td>
                    {day.temperatureF == null
                      ? "Unavailable"
                      : `${day.temperatureF}°F`}
                  </td>

                  <td>
                    {day.precipitationChance == null
                      ? "Unavailable"
                      : `${day.precipitationChance}%`}
                  </td>

                  <td>
                    {day.windMph == null
                      ? "Unavailable"
                      : `${day.windMph} mph`}
                  </td>
                  <td>
                    <strong className={`weather-risk weather-risk--${risk.level.toLowerCase()}`}>
                      {risk.level}
                    </strong>
                    <ul className="weather-risk-reasons">
                      {risk.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <p>Weather risk uses project rules, not a trained prediction or confirmed delay. The assessment above includes budget, your travel-time limit, and destination weather.</p>

          <p>
            Destination weather only. Live transportation delays
            are not connected yet.
          </p>

          <p>
            Weather data by{" "}
            <a href="https://open-meteo.com/">Open-Meteo</a>.
          </p>
        </>
      )}
    </section>
  );
}

export default WeatherDelayChecker;