import { formatMoney } from "./services/formatMoney";
import HotelRoomBreakdown from "./HotelRoomBreakdown";

function TripSummary({
  tripForm,
  transportationTotal,
  lodgingTotal,
  estimatedTotal,
  estimatedTravelTime,
  maxTravelTime,
  analysis,
  weather,
  travelEstimate,
  selectedHotel,
}) {
  const hasWeather =
    weather?.status === "success" && weather.data?.days?.length > 0;

  const measurement = (value, unit) =>
    Number.isFinite(value) ? `${value}${unit}` : "Unavailable";

  const money = formatMoney;

  return (
    <section className="trip-summary" aria-labelledby="trip-summary-heading">
      <h2 id="trip-summary-heading">Trip Summary Report</h2>

      <div className="report-grid">
      <div>
      <h3>Trip Details</h3>
      <p><strong>Origin:</strong> {tripForm.origin}</p>
      <p><strong>Destination:</strong> {tripForm.destination}</p>
      <p>
        <strong>Travel Dates:</strong> {tripForm.startDate} to {tripForm.endDate}
      </p>
      <p><strong>Travelers:</strong> {tripForm.travelers}</p>
      <p><strong>Transportation:</strong> {tripForm.transportation}</p>

      </div>
      <div>
      <h3>Cost Summary</h3>

      {selectedHotel ? (
        <>
          <p>
            Transportation uses your entered price. Lodging uses a LiteAPI
            sandbox test estimate for the selected rooms for the whole stay.
            This is not a booking quote.
          </p>
          <p><strong>Hotel:</strong> {selectedHotel.hotelName}</p>
          <HotelRoomBreakdown rooms={selectedHotel.rooms} nights={selectedHotel.nights} />
          <p>
            <strong>Hotel Base Total:</strong>{" "}
            {money(selectedHotel.baseTotal)} USD
          </p>
          <p>
            <strong>Reported Additional Fees:</strong>{" "}
            {money(selectedHotel.additionalFees)} USD
          </p>
          <p>These additional fees are already included in the lodging total.</p>
        </>
      ) : (
        <p>
          Cost estimate based on the transportation and lodging prices you
          entered.
        </p>
      )}

      <p><strong>Transportation Cost:</strong> {money(transportationTotal)}</p>
      <p><strong>Lodging Cost:</strong> {money(lodgingTotal)}</p>
      <p><strong>Total Estimated Cost:</strong> {money(estimatedTotal)}</p>
      <p><strong>Budget:</strong> {money(tripForm.budget)}</p>

      </div>
      </div>
      <h3>Travel Information</h3>
      <p>
        <strong>Estimated Travel Time:</strong> {estimatedTravelTime} hours
      </p>
      <p><strong>Your Travel-Time Limit:</strong> {maxTravelTime} hours</p>

      {travelEstimate && <p><strong>One-way distance:</strong> {travelEstimate.distanceMiles.toFixed(1)} miles ({travelEstimate.source})</p>}
      <h3>Weather Information</h3>
      {hasWeather ? (
        <>
          <p>Destination forecast for {weather.data.location}</p>
          <ul className="report-weather">
            {weather.data.days.map((day) => (
              <li key={day.date}>
                {day.date}: high {measurement(day.temperatureF, "\u00B0F")},
                {" "}precipitation chance{" "}
                {measurement(day.precipitationChance, "%")},
                {" "}maximum wind {measurement(day.windMph, " mph")}.
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>
          {!weather || weather.status === "loading"
            ? "Loading destination forecast."
            : weather.error || "Destination weather is unavailable."}
        </p>
      )}

      <div className="assessment-result" aria-live="polite">
        <h3>Feasibility Result</h3>
        <p>{analysis.status}</p>
        <ul className="feasibility-reasons">
          {analysis.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <p>
        Weather risk uses project rules. Live transportation delays are not
        included.
      </p>
    </section>
  );
}

export default TripSummary;