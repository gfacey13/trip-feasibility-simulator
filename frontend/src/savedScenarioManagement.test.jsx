// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => ({ user: null, listener: null, row: null, rpc: null }));
vi.mock('./services/supabaseClient', () => ({ supabase: {
  auth: {
    onAuthStateChange: (listener) => { session.listener = listener; return { data: { subscription: { unsubscribe() {} } } }; },
    getUser: async () => ({ data: { user: session.user }, error: null }),
  },
  rpc: (...args) => session.rpc(...args),
} }));
import App from './App';
let root;
let container;
const original = {
  id: 'trip-a', scenario: { origin: 'Private Account A Origin', destination: 'Boston', startDate: '2026-11-15',
    endDate: '2026-11-21', cost: '100', budget: '200', travelTime: '2', transportation: 'car',
    pricing: { source: 'liteapi-sandbox', hotelName: 'Saved Hotel', lodgingTotal: 80 } },
  report: { travelers: 2, maxTravelTime: 20, lodgingTotal: 80, transportationTotal: 20,
    weather: { status: 'error' }, analysis: { status: 'Assessment incomplete', reasons: ['Weather unavailable'] } },
};
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  session.row = structuredClone(original);
  session.user = null;
  session.rpc = vi.fn(async (name, args) => {
    if (name === 'trip_repository_list') return { error: null, data: session.user?.id === 'account-a' ? [session.row] : [] };
    if (name === 'trip_repository_update') {
      session.row = { id: args.p_id, scenario: args.p_scenario, report: args.p_report };
      return { error: null, data: [structuredClone(session.row)] };
    }
    throw new Error('Unexpected repository call');
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(App)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function account(id) {
  await act(async () => {
    session.user = id ? { id, email: `${id}@example.test` } : null;
    session.listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', session.user ? { user: session.user } : null);
  });
}
async function click(text) {
  const button = [...container.querySelectorAll('button')].find((node) => node.textContent.trim() === text);
  expect(button).toBeDefined();
  await act(async () => button.click());
}
async function enter(id, value) {
  await act(async () => {
    const input = container.querySelector(`#${id}`);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function edit() {
  await account('account-a');
  await click('View Summary');
  await click('Edit Saved Trip');
}
describe('saved scenario editing', () => {
  it('preloads the saved trip and saves changes to the existing record with its report inputs', async () => {
    await edit();
    expect(container.querySelector('#origin-1').value).toBe(original.scenario.origin);
    expect(document.activeElement.id).toBe('scenario-comparison');
    expect(container.textContent).toContain('Editing your saved trip.');
    await enter('budget-1', '300');
    await click('Save Preferred Scenario');
    expect(session.row.id).toBe('trip-a');
    expect(session.row.scenario.budget).toBe('300');
    expect(session.row.scenario.pricing.hotelName).toBe('Saved Hotel');
    expect(session.row.report.travelers).toBe(2);
    expect(session.row.report.lodgingTotal).toBe(80);
    await account(null);
    await account('account-a');
    await click('View Summary');
    await click('Edit Saved Trip');
    expect(container.querySelector('#budget-1').value).toBe('300');
  });
  it.each(['account-b', null])('clears private edit data on account change to %s', async (id) => {
    await edit();
    await account(id);
    expect(container.querySelector('#origin-1').value).toBe('');
    expect(container.querySelector('#budget-1').value).toBe('');
  });
  it('reopens the same saved trip without retaining an abandoned edit', async () => {
    await edit();
    await enter('destination-1', 'Richmond');
    expect(container.textContent).toContain('previous hotel price no longer applies');
    await click('Edit Saved Trip');
    expect(container.querySelector('#destination-1').value).toBe('Boston');
    expect(container.textContent).toContain('Saved Hotel');
  });
});
