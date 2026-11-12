const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function reply(body: object, status = 200) {
  return Response.json(body, { status, headers });
}

function isLocation(value: unknown): value is {
  latitude: number;
  longitude: number;
} {
  if (!value || typeof value !== "object") return false;

  const { latitude, longitude } = value as Record<string, unknown>;

  return typeof latitude === "number" && Math.abs(latitude) <= 90
    && typeof longitude === "number" && Math.abs(longitude) <= 180;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return reply({ message: "Use POST to request a driving route." }, 405);
  }

  const body = await request.json().catch(() => null);
  const origin = body?.origin;
  const destination = body?.destination;

  if (!isLocation(origin) || !isLocation(destination)) {
    return reply({ message: "Choose a valid origin and destination." }, 400);
  }

  const apiKey = Deno.env.get("ORS_API_KEY");
  if (!apiKey) {
    return reply({ message: "Driving estimates are not configured." }, 503);
  }

  try {
    const response = await fetch(
      "https://api.heigit.org/openrouteservice/v2/directions/driving-car/json",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [
            [origin.longitude, origin.latitude],
            [destination.longitude, destination.latitude],
          ],
        }),
        signal: AbortSignal.timeout(8000),
      },
    );

    const data = await response.json();

    if (data?.error?.code === 2009 || data?.error?.code === 2010) {
      return reply({ message: "No driving route was found between these locations." }, 422);
    }

    const summary = data?.routes?.[0]?.summary;
    if (!response.ok || !Number.isFinite(summary?.distance)
      || !Number.isFinite(summary?.duration)) {
      return reply({ message: "Driving estimates are temporarily unavailable." }, 502);
    }

    return reply({
      distanceMiles: summary.distance / 1609.344,
      durationMinutes: summary.duration / 60,
      source: "OpenRouteService",
      oneWay: true,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return reply({ message: "The driving route lookup timed out." }, 504);
    }

    return reply({ message: "Driving estimates are temporarily unavailable." }, 502);
  }
});