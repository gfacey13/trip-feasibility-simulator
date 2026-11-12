import { describe, it, expect } from 'vitest';
import { buildStoredReport } from './services/buildStoredReport';
const scenario = { origin: 'Norfolk', destination: 'Boston', startDate: '2026-11-02',
  endDate: '2026-11-03', transportation: 'car', cost: '100', budget: '200', travelTime: '8' };
const context = { tripForm: { ...scenario, travelers: '2' }, estimatedTotal: 100,
  estimatedTravelTime: '8', transportationTotal: 60, lodgingTotal: 40, maxTravelTime: 10,
  analysis: { status: 'Checking weather', reasons: ['Waiting for forecast'] }, weather: null };
describe('persisted report snapshot', () => {
  it('includes all report results and inputs from the matching assessment', () => {
    const snapshot = buildStoredReport(scenario, context);
    expect(snapshot).toMatchObject({ version: 1, travelers: '2', transportationTotal: 60,
      lodgingTotal: 40, maxTravelTime: 10, analysis: context.analysis });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
  it('reassesses an edited cost instead of storing the old result', () => {
    const snapshot = buildStoredReport({ ...scenario, cost: '500' }, context);
    expect(snapshot.analysis.status).toBe('Not feasible');
    expect(snapshot.transportationTotal).toBeNull();
  });
  it('does not attach another destination forecast to an edited scenario', () => {
    const snapshot = buildStoredReport({ ...scenario, destination: 'Miami' }, {
      ...context, weather: { status: 'success', data: { location: 'Boston', days: [{ date: '2026-11-02' }] } },
    });
    expect(snapshot.weather).toBeNull();
    expect(snapshot.analysis.status).toBe('Checking weather');
  });
});

it("keeps a retrieved route after a budget edit and removes it after a duration edit", () => {
  const travelEstimate = { distanceMiles: 629, durationMinutes: 694.56, source: "OpenRouteService", oneWay: true };
  const original = { ...scenario, report: buildStoredReport(scenario, { ...context, travelEstimate }) };
  expect(buildStoredReport({ ...scenario, budget: "800" }, context, original).travelEstimate).toEqual(travelEstimate);
  expect(buildStoredReport({ ...scenario, travelTime: "6" }, context, original).travelEstimate).toBeNull();
});
