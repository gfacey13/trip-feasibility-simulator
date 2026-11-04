import { evaluateFeasibility } from './evaluateFeasibility';

export function buildStoredReport(scenario, context) {
  const sameJourney = ['origin', 'destination', 'startDate', 'endDate', 'transportation']
    .every((field) => scenario[field] === context.tripForm[field]);
  const sameCalculation = sameJourney
    && Number(scenario.cost) === context.estimatedTotal
    && Number(scenario.travelTime) === Number(context.estimatedTravelTime)
    && Number(scenario.budget) === Number(context.tripForm.budget);
  const weather = sameJourney ? context.weather : null;
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    travelers: sameCalculation ? context.tripForm.travelers : null,
    transportationTotal: sameCalculation ? context.transportationTotal : null,
    lodgingTotal: sameCalculation ? context.lodgingTotal : null,
    estimatedTotal: Number(scenario.cost),
    estimatedTravelTime: Number(scenario.travelTime),
    maxTravelTime: Number(context.maxTravelTime) || null,
    budget: Number(scenario.budget),
    weather,
    analysis: sameCalculation ? context.analysis : evaluateFeasibility({
      estimatedTotal: Number(scenario.cost), budget: Number(scenario.budget),
      travelTime: Number(scenario.travelTime), maxTravelTime: Number(context.maxTravelTime), weather,
    }),
  };
}
