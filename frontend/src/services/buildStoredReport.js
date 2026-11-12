import { evaluateFeasibility } from './evaluateFeasibility';
import { normalizePricing } from './savedTripStorage';

export function buildStoredReport(scenario, context, originalScenario = null, estimates = {}) {
  const previousReport = originalScenario?.report;
  // An edit must use the saved assessment's inputs, not an unrelated calculator form.
  const reference = previousReport ? {
    tripForm: { ...originalScenario, travelers: previousReport.travelers },
    estimatedTotal: Number(originalScenario.cost),
    estimatedTravelTime: originalScenario.travelTime,
    maxTravelTime: previousReport.maxTravelTime,
    travelEstimate: previousReport.travelEstimate,
    transportationTotal: previousReport.transportationTotal,
    lodgingTotal: previousReport.lodgingTotal,
    weather: previousReport.weather,
    analysis: previousReport.analysis,
  } : context;
  const sameJourney = ['origin', 'destination', 'startDate', 'endDate', 'transportation']
    .every((field) => scenario[field] === reference.tripForm[field]);
  const sameCosts = sameJourney
    && Number(scenario.cost) === reference.estimatedTotal
    && Number(scenario.travelTime) === Number(reference.estimatedTravelTime);
  const sameAssessment = sameCosts
    && Number(scenario.budget) === Number(reference.tripForm.budget)
    && reference.analysis;
  const matchingTravelEstimate = sameJourney && Number(scenario.travelTime) === Number(reference.estimatedTravelTime)
    ? reference.travelEstimate ?? null : null;
  const travelEstimate = estimates.travelEstimate === undefined ? matchingTravelEstimate : estimates.travelEstimate;
  const weather = sameJourney ? reference.weather : null;
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    travelers: reference.tripForm.travelers || null,
    transportationTotal: estimates.transportationTotal ?? (sameCosts ? reference.transportationTotal : null),
    lodgingTotal: estimates.lodgingTotal ?? (sameCosts ? reference.lodgingTotal : null),
    estimatedTotal: Number(scenario.cost),
    estimatedTravelTime: Number(scenario.travelTime),
    travelEstimate,
    maxTravelTime: Number(reference.maxTravelTime) || null,
    budget: Number(scenario.budget),
    pricing: normalizePricing(scenario.pricing),
    weather,
    analysis: sameAssessment && estimates.travelEstimate === undefined ? reference.analysis : evaluateFeasibility({
      estimatedTotal: Number(scenario.cost), budget: Number(scenario.budget),
      travelTime: travelEstimate ? travelEstimate.durationMinutes / 60 : Number(scenario.travelTime), maxTravelTime: Number(reference.maxTravelTime), weather,
    }),
  };
}
