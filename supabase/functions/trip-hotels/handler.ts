type JsonObject = Record<string, unknown>;

type HotelRate = {
  hotelName: string;
  total: number;
  currency: "USD";
  baseTotal: number;
  additionalFees: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" &&
      !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function reply(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function unavailable(status: number, message: string): Response {
  return reply(status, {
    status: "unavailable",
    message,
  });
}

function validDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function countryCode(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

// Reject missing amounts, numeric strings, and unsupported currencies.
// Work in cents to avoid adding floating-point dollar values.
function usdCents(value: unknown): number | null {
  const price = object(value);

  if (
    !price ||
    price.currency !== "USD" ||
    typeof price.amount !== "number" ||
    !Number.isFinite(price.amount) ||
    price.amount < 0
  ) {
    return null;
  }

  const cents = Math.round(price.amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

// Exported so tests can exercise actual provider-response parsing.
export function normalizeHotelRates(
  payload: unknown,
  travelers: number,
): HotelRate[] {
  const result = object(payload);

  if (
    !result ||
    result.sandbox !== true ||
    !Array.isArray(result.data) ||
    !Array.isArray(result.hotels)
  ) {
    return [];
  }

  const hotelNames = new Map<string, string>();

  for (const entry of result.hotels) {
    const hotel = object(entry);

    if (
      hotel &&
      typeof hotel.id === "string" &&
      typeof hotel.name === "string" &&
      hotel.name.trim()
    ) {
      hotelNames.set(hotel.id, hotel.name.trim());
    }
  }

  const prices: HotelRate[] = [];

  for (const entry of result.data) {
    const hotel = object(entry);

    if (
      !hotel ||
      typeof hotel.hotelId !== "string" ||
      !Array.isArray(hotel.roomTypes)
    ) {
      continue;
    }

    const hotelName = hotelNames.get(hotel.hotelId);
    if (!hotelName) continue;

    let cheapest: HotelRate | null = null;

    for (const entry of hotel.roomTypes) {
      const offer = object(entry);

      // This version supports exactly one occupied room.
      if (
        !offer ||
        !Array.isArray(offer.rates) ||
        offer.rates.length !== 1
      ) {
        continue;
      }

      const rate = object(offer.rates[0]);

      if (
        !rate ||
        rate.adultCount !== travelers ||
        rate.childCount !== 0
      ) {
        continue;
      }

      const retail = object(rate.retailRate);

      if (
        !retail ||
        !Array.isArray(retail.total) ||
        retail.total.length !== 1
      ) {
        continue;
      }

      const baseCents = usdCents(retail.total[0]);
      if (baseCents === null || baseCents <= 0) continue;

      const fees = retail.taxesAndFees;

      // LiteAPI documents null as no excluded fees.
      // A missing or malformed field is treated as unknown.
      if (fees !== null && !Array.isArray(fees)) continue;

      let feeCents = 0;
      let usable = true;

      if (Array.isArray(fees)) {
        for (const entry of fees) {
          const fee = object(entry);

          if (!fee || typeof fee.included !== "boolean") {
            usable = false;
            break;
          }

          // Included fees are already part of the retail total.
          if (fee.included) continue;

          const amount = usdCents(fee);

          // Do not hide unpriced fees or convert currencies by guessing.
          if (amount === null) {
            usable = false;
            break;
          }

          feeCents += amount;
        }
      }

      const totalCents = baseCents + feeCents;

      if (!usable || !Number.isSafeInteger(totalCents)) continue;

      const candidate: HotelRate = {
        hotelName,
        total: totalCents / 100,
        currency: "USD",
        baseTotal: baseCents / 100,
        additionalFees: feeCents / 100,
      };

      if (!cheapest || candidate.total < cheapest.total) {
        cheapest = candidate;
      }
    }

    if (cheapest) prices.push(cheapest);
  }

  return prices.sort((a, b) => a.total - b.total).slice(0, 10);
}

export async function handleTripHotels(
  request: Request,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return unavailable(405, "Use POST to search hotel prices.");
  }

  let input: JsonObject | null;

  try {
    input = object(await request.json());
  } catch {
    return unavailable(400, "Send a valid JSON request.");
  }

  if (!input) {
    return unavailable(400, "Hotel search details are required.");
  }

  const destination = typeof input.destination === "string"
    ? input.destination.trim()
    : "";

  const destinationCountry = countryCode(input.countryCode);
  const nationality = countryCode(input.guestNationality);
  const travelers = input.travelers;

  if (!destination || destination.length > 120) {
    return unavailable(400, "Enter a destination city.");
  }

  if (!destinationCountry || !nationality) {
    return unavailable(
      400,
      "Select destination country and guest nationality.",
    );
  }

  if (input.hotelSingleRoomAdults !== true) {
    return unavailable(
      400,
      "Confirm all travelers are adults sharing one room, or use manual lodging.",
    );
  }

  if (
    typeof travelers !== "number" ||
    !Number.isSafeInteger(travelers) ||
    travelers < 1 ||
    travelers > 8
  ) {
    return unavailable(
      400,
      "Hotel searches support 1–8 adults in one room. Otherwise use manual lodging.",
    );
  }

  const { startDate, endDate } = input;

  if (
    !validDate(startDate) ||
    !validDate(endDate) ||
    endDate <= startDate
  ) {
    return unavailable(
      400,
      "Enter valid dates with checkout after check-in.",
    );
  }

  const apiKey = Deno.env.get("LITEAPI_API_KEY")?.trim();

  if (!apiKey) {
    return unavailable(
      503,
      "Hotel pricing is not connected yet. Enter lodging costs manually.",
    );
  }

  const controller = new AbortController();
  let timedOut = false;

  const cancel = () => controller.abort();
  request.signal.addEventListener("abort", cancel, { once: true });

  if (request.signal.aborted) controller.abort();

  // Leave time for our response before the frontend's 20-second timeout.
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(
      "https://api.liteapi.travel/v3.0/hotels/rates",
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          cityName: destination,
          countryCode: destinationCountry,
          guestNationality: nationality,
          checkin: startDate,
          checkout: endDate,
          currency: "USD",
          occupancies: [{ adults: travelers, children: [] }],
          includeHotelData: true,
          maxRatesPerHotel: 5,
          limit: 10,
          timeout: 10,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return unavailable(
        response.status === 429 ? 503 : 502,
        "Hotel prices are unavailable. Enter lodging costs manually.",
      );
    }

    if (response.status === 204) {
      return unavailable(
        404,
        "No hotel test prices were found for this search.",
      );
    }

    const payload: unknown = await response.json();
    const rates = normalizeHotelRates(payload, travelers);

    if (rates.length === 0) {
      return unavailable(
        404,
        "No usable hotel test prices were returned. Enter lodging costs manually.",
      );
    }

    return reply(200, {
      status: "retrieved",
      mode: "sandbox",
      source: "LiteAPI",
      priceBasis: "whole-stay",
      roomCount: 1,
      rates,
    });
  } catch {
    // Never expose provider responses, credentials, or internal errors.
    return unavailable(
      timedOut ? 504 : 502,
      timedOut
        ? "Hotel pricing timed out. Try again or enter lodging costs manually."
        : "Hotel prices are unavailable. Enter lodging costs manually.",
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancel);
  }
}
