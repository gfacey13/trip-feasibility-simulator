import { describe, it, expect, vi } from 'vitest';
import { createAccountTripStorage } from './services/accountTripStorage';
import { createTripRepository } from './services/tripRepository';

const scenario = { origin: 'Norfolk', destination: 'Boston', startDate: '2026-11-02',
  endDate: '2026-11-03', transportation: 'car', cost: 100, budget: 200, travelTime: 8 };
const report = { version: 1, analysis: { status: 'Feasible', reasons: ['Within limits'] } };
const row = { id: 'trip-a', scenario, report };
function fixture(data = [row], error = null) {
  const client = { rpc: vi.fn().mockResolvedValue({ data, error }) };
  return { client, repository: createTripRepository(client), storage: createAccountTripStorage(client) };
}
describe('scenario repository', () => {
  it('creates separate scenarios with their report snapshots', async () => {
    const { repository, client } = fixture();
    expect(await repository.create(scenario, report)).toEqual(row);
    expect(client.rpc).toHaveBeenCalledWith('trip_repository_create', { p_scenario: scenario, p_report: report });
  });
  it('lists persisted scenarios and gets an individual scenario', async () => {
    const { repository, client } = fixture();
    expect(await repository.list()).toEqual([row]);
    expect(await repository.get('trip-a')).toEqual(row);
    expect(client.rpc).toHaveBeenCalledWith('trip_repository_get', { p_id: 'trip-a' });
  });
  it('updates the chosen ID with matching scenario and report in one call', async () => {
    const { repository, client } = fixture();
    await repository.update('trip-a', scenario, report);
    expect(client.rpc).toHaveBeenCalledWith('trip_repository_update', { p_id: 'trip-a', p_scenario: scenario, p_report: report });
  });
  it('deletes the chosen scenario', async () => {
    const { repository, client } = fixture(true);
    await repository.remove('trip-a');
    expect(client.rpc).toHaveBeenCalledWith('trip_repository_delete', { p_id: 'trip-a' });
  });
  it('does not report success when a scenario is missing', async () => {
    const { repository } = fixture([]);
    await expect(repository.get('missing')).rejects.toThrow('not found');
    await expect(repository.update('missing', scenario, report)).rejects.toThrow('not found');
    await expect(fixture(false).repository.remove('missing')).rejects.toThrow('not found');
  });
  it.each(['list', 'get', 'create', 'update', 'remove'])('propagates %s backend failures', async (method) => {
    const { repository } = fixture(null, new Error('Database unavailable'));
    await expect(repository[method]('trip-a', scenario, report)).rejects.toThrow('Database unavailable');
  });
});
describe('account trip storage', () => {
  it('loads every saved trip with its own report and ID', async () => {
    const second = { ...row, id: 'trip-b', scenario: { ...scenario, destination: 'Richmond' } };
    expect(await fixture([row, second]).storage.loadAll()).toMatchObject([{ persistedId: 'trip-a' }, { persistedId: 'trip-b', destination: 'Richmond' }]);
  });
  it('loads saved results without losing report data or persistent ID', async () => {
    expect(await fixture().storage.load('ignored-user')).toMatchObject({ persistedId: 'trip-a', report, budgetResult: 'Within budget' });
  });
  it('does not send a component-supplied user ID to the backend', async () => {
    const { storage, client } = fixture();
    await storage.save('untrusted-user-id', { ...scenario, report });
    expect(client.rpc).toHaveBeenCalledWith('trip_repository_create', { p_scenario: scenario, p_report: report });
  });
  it('replaces the existing preferred ID instead of duplicating it', async () => {
    const { storage, client } = fixture();
    await storage.save('ignored-user', { ...scenario, report }, 'trip-a');
    expect(client.rpc).toHaveBeenCalledWith('trip_repository_update', { p_id: 'trip-a', p_scenario: scenario, p_report: report });
  });
  it('handles no existing trip and rejects malformed scenario data', async () => {
    expect(await fixture([]).storage.load()).toBeNull();
    await expect(fixture([{ ...row, scenario: {} }]).storage.load()).rejects.toThrow('invalid');
  });
});
