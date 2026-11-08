import { readSavedTrip } from './savedTripStorage';
import { createTripRepository } from './tripRepository';

// Compatibility with the existing preferred-trip screen. The full repository
// supports independent scenarios for SCRUM-68's management UI.
export function createAccountTripStorage(client) {
  const repository = createTripRepository(client);
  function decode(row) {
    if (!row) return null;
    const trip = readSavedTrip({ getItem: () => JSON.stringify(row.scenario) });
    if (!trip) throw new Error('The saved trip is invalid.');
    return { ...trip, persistedId: row.id, report: row.report };
  }
  return {
    async load() { return decode((await repository.list())[0]); },
    async save(_userId, scenario, persistedId) {
      const { report = null, ...details } = scenario;
      const row = persistedId
        ? await repository.update(persistedId, details, report)
        : await repository.create(details, report);
      return decode(row);
    },
    async remove(_userId, persistedId) { await repository.remove(persistedId); },
  };
}
