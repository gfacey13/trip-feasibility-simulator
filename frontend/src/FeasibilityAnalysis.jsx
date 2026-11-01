import { evaluateFeasibility } from "./services/evaluateFeasibility";

function FeasibilityAnalysis({
  estimatedTotal, travelTime, budget, maxTravelTime, weather,
}) {
  // Recalculate automatically when the forecast arrives or a constraint changes.
  const result = evaluateFeasibility({
    estimatedTotal, travelTime, budget, maxTravelTime, weather,
  });

  return (
    <section aria-labelledby="feasibility-heading">
      <h2 id="feasibility-heading">Feasibility Analysis</h2>
      <p>Total Cost: ${estimatedTotal}</p>
      <p>Budget: ${budget}</p>
      <p>Travel Time: {travelTime.toFixed(1)} hours</p>
      <p>Your Travel-Time Limit: {maxTravelTime} hours</p>

      {/* Announce the new result when the asynchronous forecast arrives. */}
      <div aria-live="polite">
        <h3>Result: {result.status}</h3>
        <ul className="feasibility-reasons">
          {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </div>
      <p>Travel time is a distance-based estimate. Weather coverage is destination only.</p>
    </section>
  );
}

export default FeasibilityAnalysis;