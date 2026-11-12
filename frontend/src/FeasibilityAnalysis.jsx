import { formatMoney } from "./services/formatMoney";
import { evaluateFeasibility } from "./services/evaluateFeasibility";

function FeasibilityAnalysis({
  estimatedTotal, travelTime, budget, maxTravelTime, weather, analysis, travelEstimate,
}) {
  // Recalculate automatically when the forecast arrives or a constraint changes.
  const result = analysis ?? evaluateFeasibility({
    estimatedTotal, travelTime, budget, maxTravelTime, weather,
  });

  return (
    <section aria-labelledby="feasibility-heading">
      <h2 id="feasibility-heading">Feasibility Analysis</h2>
      <dl className="metric-grid">
        <div className="metric"><dt>Total Cost</dt><dd>{formatMoney(estimatedTotal)}<small>Budget: {formatMoney(budget)}</small></dd></div>
        <div className="metric"><dt>Travel Time</dt><dd>{travelTime.toFixed(1)} hours<small>Your Travel-Time Limit: {maxTravelTime} hours</small></dd></div>
        <div className="metric"><dt>Budget remaining</dt><dd>{formatMoney(budget - estimatedTotal)}<small>After transportation and lodging</small></dd></div>
      </dl>

      {/* Announce the new result when the asynchronous forecast arrives. */}
      <div className="assessment-result" aria-live="polite">
        <h3>Result: {result.status}</h3>
        <ul className="feasibility-reasons">
          {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </div>
      <p>Travel time is a one-way estimate{travelEstimate && ` (${travelEstimate.source})`}. Weather coverage is destination only.</p>
    </section>
  );
}

export default FeasibilityAnalysis;