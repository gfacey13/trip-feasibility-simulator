function TripSummary({
  tripForm,
  transportationTotal,
  lodgingTotal,
  estimatedTotal,
  estimatedTravelTime
}) {
  const feasible =
    estimatedTotal <= Number(tripForm.budget);

  return (
    <div className="trip-summary">
      <h2>Trip Summary Report</h2>

      <h3>Trip Details</h3>

      <p>
        <strong>Origin:</strong> {tripForm.origin}
      </p>

      <p>
        <strong>Destination:</strong> {tripForm.destination}
      </p>

      <p>
        <strong>Travel Dates:</strong>{" "}
        {tripForm.startDate} to {tripForm.endDate}
      </p>

      <p>
        <strong>Travelers:</strong>{" "}
        {tripForm.travelers}
      </p>

      <p>
        <strong>Transportation:</strong>{" "}
        {tripForm.transportation.charAt(0).toUpperCase() +
         tripForm.transportation.slice(1)}
      </p>

      <h3>Cost Summary</h3>

      <p>
        <strong>Transportation Cost:</strong>
        {" "} ${transportationTotal}
      </p>

      <p>
        <strong>Lodging Cost:</strong>
        {" "} ${lodgingTotal}
      </p>

      <p>
        <strong>Total Estimated Cost:</strong>
        {" "} ${estimatedTotal}
      </p>

      <h3>Travel Information</h3>

      <p>
        <strong>Estimated Travel Time:</strong>
        {" "} {estimatedTravelTime} hours
      </p>

      <p>
        <strong>Weather Information:</strong>
        {" "} Currently unavailable
      </p>

      <h3>Feasibility Result</h3>

      <p>
        {feasible
          ? "Feasible ✅"
          : "Not Feasible ⚠️"}
      </p>
    </div>
  );
}

export default TripSummary;