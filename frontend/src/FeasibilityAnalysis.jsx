function FeasibilityAnalysis({
  estimatedTotal,
  travelTime,
  budget
}) {

  if (
    estimatedTotal === undefined ||
    travelTime === undefined
  ) {
    return (
      <p className="error-message">
        Missing feasibility analysis data.
      </p>
    );
  }

  const feasible =
    estimatedTotal <= budget &&
    travelTime <= 8;

  return (
    <>
      <h2>Feasibility Analysis</h2>

      <p>
        Total Cost: ${estimatedTotal}
      </p>
      <p>
         Budget: ${budget}
     </p>
      <p>
        Travel Time: {travelTime} hours
      </p>

      <h3>
        Result: {
          feasible
            ? "Feasible ✅"
            : "Not Feasible ⚠️"
        }
      </h3>
    </>
  );
}

export default FeasibilityAnalysis;