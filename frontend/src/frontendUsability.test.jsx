// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./services/supabaseClient', () => ({ supabase: null }));
const hotels = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('./services/hotelService', () => ({ getHotelRates: (...args) => hotels.search(...args) }));
vi.mock('./services/weatherService', () => ({ getTripWeather: async () => ({ location: 'Boston', days: [{ date: '2026-11-15', temperatureF: 55, precipitationChance: 0, windMph: 4, weatherCode: 0 }] }) }));
import App from './App';
let root, container;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
  hotels.search.mockReset();
  await act(async () => root.render(createElement(App)));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function enter(id, value) {
  await act(async () => {
    const input = document.getElementById(id);
    const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event(input.tagName === 'SELECT' || input.type === 'date' ? 'change' : 'input', { bubbles: true }));
  });
}
async function click(text) {
  const button = [...container.querySelectorAll('button')].find((node) => node.textContent.trim() === text);
  expect(button, text).toBeDefined(); await act(async () => button.click());
}
async function trip() {
  for (const [id, value] of Object.entries({ origin: 'Norfolk', destination: 'Boston', startDate: '2026-11-15', endDate: '2026-11-21', budget: '8000', travelers: '2', transportation: 'car', transportationCost: '30', lodgingCost: '90', distance: '800', maxTravelTime: '20' })) await enter(id,value);
}
describe('frontend usability', () => {
  it('focuses the first incomplete field and associates labels and error guidance with controls', async () => {
    await click('Calculate Feasibility');
    expect(document.activeElement.id).toBe('origin');
    expect(document.getElementById('origin').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('origin-error').textContent).toContain('starting city');
    for (const input of container.querySelectorAll('input, select')) expect(input.labels.length, input.id).toBeGreaterThan(0);
    expect(container.querySelector('a.skip-link').getAttribute('href')).toBe('#plan-trip');
  });
  it('preserves optional hotel inputs when collapsed or when unrelated trip fields change', async () => {
    await trip();
    await enter('hotelCountry','US'); await enter('guestNationality','US');
    const options = container.querySelector('details.hotel-options');
    await act(async () => options.querySelector('summary').click());
    await click('Add child'); await enter('room-0-child-0','1');
    await act(async () => options.querySelector('summary').click());
    await enter('budget','9000'); await enter('origin','Richmond');
    expect(document.getElementById('hotelCountry').value).toBe('US');
    expect(document.getElementById('guestNationality').value).toBe('US');
    expect(document.getElementById('room-0-child-0').value).toBe('1');
    expect(document.getElementById('travelers').value).toBe('3');
    await click('Remove child 1'); expect(document.getElementById('travelers').value).toBe('2');
  });
  it('uses selected hotel totals and returns to the retained manual lodging price', async () => {
    await trip(); await enter('hotelCountry','US'); await enter('guestNationality','US');
    hotels.search.mockResolvedValue({ rates: [{ hotelName: 'Sample Hotel', total: 600, baseTotal: 550, additionalFees: 50, nights: 6,
      rooms: [{ roomNumber: 1, roomName: 'Standard', adults: 2, children: [], total: 600, baseTotal: 550, additionalFees: 50 }] }] });
    await click('Search Hotel Test Prices');
    expect(container.textContent).toContain('$100.00 USD average per night for this room');
    await click('Use This Hotel'); expect(document.getElementById('lodgingCost').disabled).toBe(true);
    await click('Calculate Feasibility');
    expect(container.querySelector('.results-panel').textContent).toContain('$660.00');
    expect(container.querySelector('.trip-summary').textContent).toContain('Sample Hotel');
    expect(container.querySelector('.trip-summary').textContent).toContain('$50.00');
    await click('Use Manual Lodging');
    expect(document.getElementById('lodgingCost').disabled).toBe(false); expect(document.getElementById('lodgingCost').value).toBe('90');
    await click('Calculate Feasibility'); expect(container.querySelector('.results-panel').textContent).toContain('$600.00');
  });
  it('announces hotel search failures and leaves the entered manual price available', async () => {
    await trip(); await enter('hotelCountry','US'); await enter('guestNationality','US');
    hotels.search.mockRejectedValue(new Error('Hotel prices are unavailable. Try another search or enter lodging costs manually.'));
    await click('Search Hotel Test Prices');
    expect(container.querySelector('.hotel-pricing [role=alert]').textContent).toContain('Hotel prices are unavailable');
    expect(document.getElementById('lodgingCost').value).toBe('90');
  });
});
