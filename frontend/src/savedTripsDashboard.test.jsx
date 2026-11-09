// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => ({ user: null, listener: null, rows: [], rpc: null }));
vi.mock('./services/supabaseClient', () => ({ supabase: {
  auth: {
    onAuthStateChange: (listener) => { session.listener = listener; return { data: { subscription: { unsubscribe() {} } } }; },
    getUser: async () => ({ data: { user: session.user }, error: null }),
  },
  rpc: (...args) => session.rpc(...args),
} }));
import App from './App';
const trip = (id, destination, cost) => ({ id, scenario: {
  origin: 'Norfolk', destination, startDate: '2026-11-15', endDate: '2026-11-21',
  cost: String(cost), budget: '200', travelTime: '2', transportation: 'car', travelers: 2,
  pricing: { source: 'manual' },
}, report: { travelers: 2, maxTravelTime: 20, lodgingTotal: cost - 20, transportationTotal: 20,
  weather: { status: 'error' }, analysis: { status: 'Assessment incomplete', reasons: ['Weather unavailable'] } } });
let root, container;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  session.user = null;
  session.rows = [trip('a', 'Boston', 100), trip('b', 'Richmond', 300)];
  session.rpc = vi.fn(async (name, args) => {
    if (name === 'trip_repository_list') return { error: null, data: session.user?.id === 'owner' ? structuredClone(session.rows) : [] };
    if (name === 'trip_repository_create' || name === 'trip_repository_update') {
      const row = { id: args.p_id ?? `new-${session.rows.length}`, scenario: args.p_scenario, report: args.p_report };
      session.rows = [row, ...session.rows.filter((item) => item.id !== row.id)];
      return { error: null, data: [structuredClone(row)] };
    }
    if (name === 'trip_repository_delete') {
      session.rows = session.rows.filter((item) => item.id !== args.p_id);
      return { error: null, data: true };
    }
    throw new Error('Unexpected repository call');
  });
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(App)));
  await account('owner');
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function account(id) {
  await act(async () => {
    session.user = id ? { id, email: `${id}@example.test` } : null;
    session.listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', session.user ? { user: session.user } : null);
  });
}
async function click(text, scope = container) {
  const button = [...scope.querySelectorAll('button')].find((node) => node.textContent.trim() === text);
  expect(button, text).toBeDefined();
  await act(async () => button.click());
}
async function enter(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const cards = () => [...container.querySelectorAll('.dashboard-card')];
describe('multiple saved trips dashboard', () => {
  it('compares selected persisted trips and restores all trips after a new login', async () => {
    expect(cards()).toHaveLength(2);
    const compare = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Compare Selected Trips'));
    expect(compare.disabled).toBe(true);
    for (const checkbox of container.querySelectorAll('.compare-trip-choice input')) await act(async () => checkbox.click());
    await click('Compare Selected Trips (2)');
    const table = container.querySelector('.saved-comparison-table');
    expect(table.textContent).toContain('Boston'); expect(table.textContent).toContain('Richmond');
    expect(table.textContent).toContain('$100.00'); expect(table.textContent).toContain('$300.00');
    expect(table.textContent).toContain('Within budget'); expect(table.textContent).toContain('Over budget');
    expect(session.rpc.mock.calls.every(([name]) => name === 'trip_repository_list')).toBe(true);
    await account(null); expect(container.querySelector('table')).toBeNull(); expect(cards()).toHaveLength(0);
    await account('owner'); expect(cards()).toHaveLength(2);
    expect(container.querySelector('.saved-comparison-table')).toBeNull();
  });
  it('edits only the selected existing trip and preserves the other trip and saved report', async () => {
    await click('Edit Saved Trip', cards()[1]);
    await enter(container.querySelector('#budget-1'), '400');
    await click('Save Preferred Scenario');
    expect(session.rows).toHaveLength(2);
    expect(session.rows.find((row) => row.id === 'a').scenario.budget).toBe('200');
    const edited = session.rows.find((row) => row.id === 'b');
    expect(edited.scenario.budget).toBe('400'); expect(edited.report.lodgingTotal).toBe(280);
    await account(null); await account('owner'); expect(cards()).toHaveLength(2);
  });
  it('invalidates the old report breakdown when saved costs are edited', async () => {
    await click('Edit Saved Trip', cards()[0]);
    await enter(container.querySelector('#cost-1'), '150');
    await click('Save Preferred Scenario');
    const edited = session.rows.find((row) => row.id === 'a');
    expect(edited.report.estimatedTotal).toBe(150);
    expect(edited.report.lodgingTotal).toBeNull();
    expect(edited.report.transportationTotal).toBeNull();
  });
  it('saves a duplicate as an independent trip, then updates it without further duplicates', async () => {
    await click('Edit Saved Trip', cards()[0]);
    await click('Duplicate Scenario');
    const second = container.querySelectorAll('.scenario-card')[1];
    await click('Select Preferred', second);
    await click('Save Preferred Scenario');
    expect(session.rows).toHaveLength(3);
    expect(session.rows.filter((row) => row.scenario.destination === 'Boston')).toHaveLength(2);
    expect(session.rows[0].report.lodgingTotal).toBe(80);
    await click('Save Preferred Scenario'); expect(session.rows).toHaveLength(3);
    expect(session.rpc.mock.calls.filter(([name]) => name === 'trip_repository_create')).toHaveLength(1);
  });
  it('confirms deletion of the chosen trip and leaves the other trip intact', async () => {
    await click('Delete Saved Trip', cards()[1]); await click('Cancel', cards()[1]);
    expect(session.rows).toHaveLength(2);
    await click('Delete Saved Trip', cards()[1]); await click('Confirm Delete', cards()[1]);
    expect(session.rows.map((row) => row.id)).toEqual(['a']); expect(cards()).toHaveLength(1);
    await account(null); await account('owner'); expect(cards()[0].textContent).toContain('Boston');
  });
  it('hides the previous account cards and comparison on account switch', async () => {
    for (const checkbox of container.querySelectorAll('.compare-trip-choice input')) await act(async () => checkbox.click());
    await click('Compare Selected Trips (2)');
    await account('other'); expect(cards()).toHaveLength(0);
    expect(container.textContent).not.toContain('Richmond'); expect(container.querySelector('.saved-comparison-table')).toBeNull();
    expect(container.textContent).toContain('No saved trip yet');
  });
});
