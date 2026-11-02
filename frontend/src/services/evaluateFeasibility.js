import { getWeatherRisk } from "./weatherRisk";

// Keep decision rules outside React so the UI and tests use the same logic.
export function evaluateFeasibility({
  estimatedTotal, budget, travelTime, maxTravelTime, weather,
}) {
  const numbers = [estimatedTotal, budget, travelTime, maxTravelTime];
  if (!numbers.every(Number.isFinite)
      || estimatedTotal < 0 || budget <= 0
      || travelTime < 0 || maxTravelTime <= 0) {
    return { status: "Assessment incomplete", reasons: ["Enter valid costs and travel-time limits."] };
  }

  const reasons = [];
  if (estimatedTotal > budget) reasons.push("Estimated cost exceeds your budget.");
  if (travelTime > maxTravelTime) reasons.push("Estimated travel time exceeds your chosen limit.");

  // Known constraint failures stay visible even while weather is loading.
  if (reasons.length) {
    return { status: "Not feasible", reasons };
  }

  if (!weather || weather.status === "loading") {
    return { status: "Checking weather", reasons: ["Budget and travel time fit. Waiting for the forecast."] };
  }
  if (weather.status !== "success" || !weather.data?.days?.length) {
    return { status: "Assessment incomplete", reasons: ["Budget and travel time fit, but weather is unavailable."] };
  }

  // The highest risk across all trip days determines the warning.
  // This is a rule-based assessment, not a probability or delay estimate.
  const risks = weather.data.days.map(getWeatherRisk);
  const highRisk = risks.some((risk) => risk.level === "High");
  const moderateRisk = risks.some((risk) => risk.level === "Moderate");
  const incomplete = risks.some((risk) => !risk.complete);

  if (highRisk) reasons.push("High weather risk is forecast. Review the daily warnings before deciding.");
  else if (moderateRisk) reasons.push("Moderate weather risk is forecast. Allow flexibility in your plans.");
  if (incomplete) reasons.push("Some forecast measurements are missing; the weather assessment is incomplete.");

  if (incomplete) return { status: "Assessment incomplete", reasons };
  if (highRisk || moderateRisk) return { status: "Feasible with weather warnings", reasons };
  return {
    status: "Feasible",
    reasons: ["Within budget and your travel-time limit, with low destination weather risk."],
  };
}