import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHotelRates } from './services/hotelService';
import { normalizePricing, pricingLabel } from './services/savedTripStorage';
import { createAccountTripStorage } from './services/accountTripStorage';
import { buildStoredReport } from './services/buildStoredReport';
import UserDashboard from './UserDashboard';
import HotelRoomBreakdown from './HotelRoomBreakdown';
import { validRoomOccupancies } from './services/hotelRooms';

const rate = { hotelName: 'Test Hotel', total: 100, baseTotal: 80, additionalFees: 20, currency: 'USD' };
const scenario = { origin: 'Norfolk', destination: 'Boston', startDate: '2026-11-08',
  endDate: '2026-11-10', transportation: 'train', cost: '160', budget: '1000', travelTime: '8.3' };
const context = { tripForm: { ...scenario, travelers: '2' }, transportationTotal: 60,
  lodgingTotal: 100, estimatedTotal: 160, estimatedTravelTime: '8.3', maxTravelTime: 10,
  analysis: { status: 'Checking weather', reasons: ['Waiting for forecast'] }, weather: null };

// Persist serialized backend payloads so a new adapter instance simulates refresh.
function backend() {
  let row = null;
  const client = {
    from: vi.fn(() => { throw new Error('Legacy preferred_trips writes must not be used'); }),
    rpc: vi.fn(async (name, args) => {
      if (name === 'trip_repository_create' || name === 'trip_repository_update') {
        row = JSON.parse(JSON.stringify({ id: 'persisted-hotel-trip', scenario: args.p_scenario, report: args.p_report }));
        return { data: [structuredClone(row)], error: null };
      }
      if (name === 'trip_repository_list') return { data: row ? [structuredClone(row)] : [], error: null };
      throw new Error('Unexpected backend method');
    }),
  };
  return client;
}

async function hotelTrip() {
  vi.stubEnv('VITE_HOTEL_API_URL', 'https://example.test/hotels');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
    status: 'retrieved', mode: 'sandbox', source: 'LiteAPI', priceBasis: 'whole-stay', roomCount: 1, rates: [rate],
  })));
  const result = await getHotelRates({ ...scenario, travelers: '2', countryCode: 'US',
    guestNationality: 'US', hotelSingleRoomAdults: true });
  const selected = result.rates[0];
  const pricing = normalizePricing({ source: 'liteapi-sandbox', hotelName: selected.hotelName,
    lodgingTotal: selected.total, baseTotal: selected.baseTotal, additionalFees: selected.additionalFees });
  const trip = { ...scenario, pricing };
  return { ...trip, report: buildStoredReport(trip, context) };
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('hotel pricing account persistence', () => {
  it('preserves the selected hotel, whole-stay total and fees through a fresh load and dashboard render', async () => {
    const client = backend();
    const trip = await hotelTrip();
    await createAccountTripStorage(client).save('owner-a', trip);
    const loaded = await createAccountTripStorage(client).load('owner-a');
    expect(loaded.pricing).toEqual(trip.pricing);
    expect(loaded.report.pricing).toEqual(trip.pricing);
    expect(loaded.report.lodgingTotal).toBe(100);
    expect(loaded.report.estimatedTotal).toBe(160);
    const html = renderToStaticMarkup(createElement(UserDashboard, { savedTrip: loaded, accountSaved: true }));
    expect(html).toContain('LiteAPI sandbox');
    expect(html).toContain('Test Hotel');
    expect(html).toContain('$100.00 USD lodging for the whole stay');
    expect(client.from).not.toHaveBeenCalled();
  });
  it('replaces the same persisted ID and retains the edited-price warning after refresh', async () => {
    const client = backend();
    const original = await createAccountTripStorage(client).save('owner-a', await hotelTrip());
    const edited = { ...scenario, cost: '500', pricing: { source: 'edited-sandbox' } };
    await createAccountTripStorage(client).save('owner-a', {
      ...edited, report: buildStoredReport(edited, context),
    }, original.persistedId);
    const loaded = await createAccountTripStorage(client).load('owner-a');
    expect(loaded.persistedId).toBe(original.persistedId);
    expect(loaded.pricing).toEqual({ source: 'edited-sandbox' });
    expect(loaded.report.pricing).toEqual({ source: 'edited-sandbox' });
    expect(pricingLabel(loaded.pricing)).toContain('previous hotel price no longer applies');
    expect(original.report.pricing.hotelName).toBe('Test Hotel');
  });
  it('preserves legacy sandbox labels whose fee breakdown was not recorded', () => {
    const legacy = { source: 'liteapi-sandbox', hotelName: 'Legacy Hotel', lodgingTotal: 120 };
    expect(normalizePricing(legacy)).toEqual(legacy);
    expect(pricingLabel(legacy)).toContain('Legacy Hotel');
  });
  it('rejects inconsistent recorded fees instead of presenting them as a verified hotel rate', () => {
    expect(normalizePricing({ source: 'liteapi-sandbox', hotelName: 'Invalid Hotel',
      lodgingTotal: 100, baseTotal: 80, additionalFees: 40 })).toEqual({ source: 'unknown' });
  });
});

describe('saved multi-room pricing', () => {
  it('retains room arrangements, child ages and nightly averages in both scenario and report', async () => {
    const client = backend();
    const pricing = normalizePricing({ source: 'liteapi-sandbox', hotelName: 'Family Hotel', lodgingTotal: 520,
      baseTotal: 500, additionalFees: 20, nights: 2, roomCount: 2, rooms: [
        { roomNumber: 1, roomName: 'Family Room', adults: 2, children: [7], total: 210, baseTotal: 200, additionalFees: 10 },
        { roomNumber: 2, roomName: 'Single Room', adults: 1, children: [], total: 310, baseTotal: 300, additionalFees: 10 },
      ] });
    const details = { ...scenario, pricing, cost: '580' };
    await createAccountTripStorage(client).save('owner-a', { ...details,
      report: buildStoredReport(details, { ...context, estimatedTotal: 580, lodgingTotal: 520 }) });
    const loaded = await createAccountTripStorage(client).load('owner-a');
    expect(loaded.pricing).toEqual(pricing);
    expect(loaded.report.pricing).toEqual(pricing);
    const html = renderToStaticMarkup(createElement(HotelRoomBreakdown, loaded.pricing));
    expect(html).toContain('$105.00 USD average per night');
    expect(html).toContain('$155.00 USD average per night');
    expect(html).toContain('children ages 7');
    expect(pricingLabel(loaded.pricing)).toContain('2 rooms for 2 nights');
  });
  it.each([
    [[{ adults: 0, children: [7] }]],
    [[{ adults: 2, children: [18] }]],
    [[{ adults: 2, children: [''] }]],
    [[{ adults: 1, children: [2.5] }]],
    [[]],
  ])('rejects invalid room arrangements %j', (rooms) => {
    expect(validRoomOccupancies(rooms)).toBe(false);
  });
  it('keeps infant age zero and rounds half-cent nightly averages upwards', () => {
    expect(validRoomOccupancies([{ adults: 1, children: [0] }])).toBe(true);
    const html = renderToStaticMarkup(createElement(HotelRoomBreakdown, { nights: 6, rooms: [
      { roomNumber: 1, roomName: 'Room', adults: 1, children: [0], total: 4281.81, additionalFees: 258.54 },
    ] }));
    expect(html).toContain('$713.64 USD average per night');
    expect(html).toContain('children ages 0');
  });
});
