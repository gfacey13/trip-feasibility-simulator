// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./services/supabaseClient', () => ({ supabase: null }));
const lookup = vi.hoisted(() => vi.fn());
vi.mock('./services/cityService', () => ({ searchCities: (...args) => lookup(...args) }));
import App from './App';
const boston = { id: 1, name: 'Boston', region: 'Massachusetts', country: 'United States', countryCode: 'US', label: 'Boston, Massachusetts, United States' };
const paris = { id: 2, name: 'Paris', region: 'Ile-de-France', country: 'France', countryCode: 'FR', label: 'Paris, Ile-de-France, France' };
let container, root;
beforeEach(async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  lookup.mockReset(); lookup.mockResolvedValue([boston]);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root.render(createElement(App)));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function enter(id,value) {
  await act(async () => {
    const input = document.getElementById(id); input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
async function wait() { await act(async () => vi.advanceTimersByTimeAsync(300)); }
async function key(id,key) { await act(async () => document.getElementById(id).dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}))); }
describe('city autocomplete', () => {
  it('debounces typing and lets the keyboard select an unambiguous destination and hotel country', async () => {
    await enter('destination','Bo'); await wait(); expect(lookup).not.toHaveBeenCalled();
    await enter('destination','Bos'); expect(lookup).not.toHaveBeenCalled(); await wait();
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role=option]').textContent).toContain('Massachusetts');
    await key('destination','ArrowDown'); expect(document.getElementById('destination').getAttribute('aria-activedescendant')).toBe('destination-city-1');
    await key('destination','Enter'); expect(document.getElementById('destination').value).toBe(boston.label);
    expect(document.getElementById('hotelCountry').value).toBe('US');
    expect(document.getElementById('destination').getAttribute('aria-expanded')).toBe('false');
    await enter('destination','Boston changed'); expect(document.getElementById('hotelCountry').value).toBe('');
  });
  it('ignores a previous query that finishes after a newer query', async () => {
    let resolveOld;
    lookup.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce([paris]);
    await enter('origin','Bos'); await wait(); await enter('origin','Par'); await wait();
    expect(container.querySelector('[role=option]').textContent).toContain('France');
    await act(async () => resolveOld([boston]));
    expect(container.querySelector('[role=option]').textContent).not.toContain('Boston');
    await act(async () => container.querySelector('[role=option]').click());
    expect(document.getElementById('origin').value).toBe(paris.label);
  });
  it('retains manual input when city lookup fails and closes suggestions with Escape', async () => {
    lookup.mockRejectedValue(new Error('offline'));
    await enter('destination','Richmond'); await wait();
    expect(container.querySelector('.city-suggestions [role=status]').textContent).toContain('enter a city manually');
    expect(document.getElementById('destination').value).toBe('Richmond');
    await key('destination','Escape'); expect(container.querySelector('.city-suggestions')).toBeNull();
  });
});
