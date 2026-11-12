export async function searchCities(query, signal) {
  if (query.trim().length < 3) return [];

  const params = new URLSearchParams({
    name: query.trim(),
    count: '8',
    language: 'en',
    format: 'json',
  });

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`,
    {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
        : AbortSignal.timeout(6000),
    }
  );

  if (!response.ok) {
    throw new Error(
      'City search is unavailable. You can still enter a city manually.'
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      'City search is unavailable. You can still enter a city manually.'
    );
  }

  return (data.results ?? [])
    .filter(
      (city) =>
        Number.isSafeInteger(city.id) &&
        typeof city.name === 'string' &&
        typeof city.country_code === 'string' &&
        /^[A-Z]{2}$/.test(city.country_code) &&
        typeof city.country === 'string' &&
        city.feature_code?.startsWith('PPL')
    )
    .map((city) => ({
      id: city.id,
      name: city.name,
      region: city.admin1 ?? '',
      country: city.country,
      countryCode: city.country_code,
      latitude: city.latitude,
      longitude: city.longitude,
      label: [
        ...new Set(
          [city.name, city.admin1, city.country].filter(Boolean)
        ),
      ].join(', '),
    }));
}