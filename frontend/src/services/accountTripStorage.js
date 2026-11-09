import { readSavedTrip } from './savedTripStorage';
import { createTripRepository } from './tripRepository';

// Account-owned scenarios are stored independently through the backend repository.
export function createAccountTripStorage(client) {
  const repository = createTripRepository(client);
  function decode(row) {
    if (!row) return null;
    const trip = readSavedTrip({ getItem: () => JSON.stringify(row.scenario) });
    if (!trip) throw new Error('The saved trip is invalid.');
    return { ...trip, travelers: row.scenario.travelers ?? row.report?.travelers ?? null, persistedId: row.id, report: row.report };
  }
  return {
    async load() { return decode((await repository.list())[0]); },
    async loadAll() { return (await repository.list()).map(decode); },
    async save(_userId, scenario, persistedId) {
      const { report = null, persistedId: _persistedId, ...details } = scenario;
      void _persistedId;
      const row = persistedId
        ? await repository.update(persistedId, details, report)
        : await repository.create(details, report);
      return decode(row);
    },
    async remove(_userId, persistedId) { await repository.remove(persistedId); },
  };
}
