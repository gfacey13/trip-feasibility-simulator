// The report presents the same assessment as the main results; it does not
// independently decide feasibility from budget alone.
function TripSummary({
  tripForm, transportationTotal, lodgingTotal, estimatedTotal,
  estimatedTravelTime, maxTravelTime, analysis, weather,
}) {
  const hasWeather = weather?.status === "success" && weather.data?.days?.length > 0;
  const measurement = (value, unit) => Number.isFinite(value) ? `${value}${unit}` : "Unavailable";

  return (
    <section className="trip-summary" aria-labelledby="trip-summary-heading">
      <h2 id="trip-summary-heading">Trip Summary Report</h2>
      <h3>Trip Details</h3>
      <p><strong>Origin:</strong> {tripForm.origin}</p>
      <p><strong>Destination:</strong> {tripForm.destination}</p>
      <p><strong>Travel Dates:</strong> {tripForm.startDate} to {tripForm.endDate}</p>
      <p><strong>Travelers:</strong> {tripForm.travelers}</p>
      <p><strong>Transportation:</strong> {tripForm.transportation}</p>

      <h3>Cost Summary</h3>
      <p><strong>Transportation Cost:</strong> ${transportationTotal}</p>
      <p><strong>Lodging Cost:</strong> ${lodgingTotal}</p>
      <p><strong>Total Estimated Cost:</strong> ${estimatedTotal}</p>
      <p><strong>Budget:</strong> ${tripForm.budget}</p>

      <h3>Travel Information</h3>
      <p><strong>Estimated Travel Time:</strong> {estimatedTravelTime} hours</p>
      <p><strong>Your Travel-Time Limit:</strong> {maxTravelTime} hours</p>

      <h3>Weather Information</h3>
      {hasWeather ? (
        <>
          <p>Destination forecast for {weather.data.location}</p>
          <ul className="report-weather">
            {weather.data.days.map((day) => (
              <li key={day.date}>
                {day.date}: high {measurement(day.temperatureF, "°F")}, precipitation chance {measurement(day.precipitationChance, "%")}, maximum wind {measurement(day.windMph, " mph")}.
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>{!weather || weather.status === "loading"
          ? "Loading destination forecast."
          : weather.error || "Destination weather is unavailable."}</p>
      )}

      <div aria-live="polite">
        <h3>Feasibility Result</h3>
        <p>{analysis.status}</p>
        <ul className="feasibility-reasons">
          {analysis.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </div>
      <p>Weather risk uses project rules. Live transportation delays are not included.</p>
    </section>
  );
}

export default TripSummary;
