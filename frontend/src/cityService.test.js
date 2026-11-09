import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchCities } from './services/cityService';
afterEach(() => vi.unstubAllGlobals());
describe('city lookup service', () => {
  it('filters malformed and non-city results and retains region and country for disambiguation', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ results: [
      { id: 1, name: 'Boston', admin1: 'Massachusetts', country: 'United States', country_code: 'US', feature_code: 'PPLA' },
      { id: 2, name: 'Boston', admin1: 'England', country: 'United Kingdom', country_code: 'GB', feature_code: 'PPL' },
      { id: 3, name: 'Not a city', country: 'United States', country_code: 'US', feature_code: 'MT' },
      { name: 'Broken' },
    ] }));
    vi.stubGlobal('fetch',fetch);
    const cities = await searchCities('Bos');
    expect(cities.map(city => city.label)).toEqual(['Boston, Massachusetts, United States','Boston, England, United Kingdom']);
    expect(cities[0].countryCode).toBe('US'); expect(new URL(fetch.mock.calls[0][0]).searchParams.get('count')).toBe('8');
  });
  it('returns an empty list for a short search or no matches and rejects service errors', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(new Response('',{status:503})));
    expect(await searchCities('Bo')).toEqual([]); expect(fetch).not.toHaveBeenCalled();
    expect(await searchCities('Unknown')).toEqual([]);
    await expect(searchCities('Boston')).rejects.toThrow('unavailable');
  });
});
