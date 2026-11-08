type JsonObject = Record<string, unknown>;

type Occupancy = { adults: number; children: number[] };
type RoomPrice = Occupancy & {
  roomNumber: number;
  roomName: string;
  total: number;
  baseTotal: number;
  additionalFees: number;
  averageNightly: number;
};
type HotelRate = {
  hotelName: string;
  total: number;
  currency: "USD";
  baseTotal: number;
  additionalFees: number;
  nights: number;
  rooms: RoomPrice[];
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

function validOccupancies(value: unknown): value is Occupancy[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 8 &&
    value.every((entry) => {
      const room = object(entry);
      return room !== null && Number.isSafeInteger(room.adults) &&
        Number(room.adults) >= 1 && Number(room.adults) <= 8 &&
        Array.isArray(room.children) &&
        Number(room.adults) + room.children.length <= 8 &&
        room.children.every((age) =>
          Number.isSafeInteger(age) && age >= 0 && age <= 17
        );
    });
}

function sameChildren(actual: unknown, expected: number[]): boolean {
  if (expected.length === 0) {
    return actual === undefined ||
      (Array.isArray(actual) && actual.length === 0);
  }
  return Array.isArray(actual) && actual.length === expected.length &&
    [...actual].sort((a, b) => a - b).every((age, index) =>
      age === [...expected].sort((a, b) => a - b)[index]
    );
}

function roomPrice(
  rate: JsonObject,
  occupancy: Occupancy,
  index: number,
  nights: number,
): RoomPrice | null {
  const retail = object(rate.retailRate);
  if (!retail || !Array.isArray(retail.total) || retail.total.length !== 1) {
    return null;
  }
  const baseCents = usdCents(retail.total[0]);
  if (baseCents === null || baseCents <= 0) return null;
  const fees = retail.taxesAndFees;
  if (fees !== null && !Array.isArray(fees)) return null;
  let feeCents = 0;
  for (const entry of fees ?? []) {
    const fee = object(entry);
    if (!fee || typeof fee.included !== "boolean") return null;
    if (fee.included) continue;
    const amount = usdCents(fee);
    if (amount === null) return null;
    feeCents += amount;
  }
  const totalCents = baseCents + feeCents;
  if (!Number.isSafeInteger(totalCents)) return null;
  return {
    roomNumber: index + 1,
    roomName: typeof rate.name === "string" && rate.name.trim()
      ? rate.name.trim()
      : `Room ${index + 1}`,
    adults: occupancy.adults,
    children: [...occupancy.children],
    total: totalCents / 100,
    baseTotal: baseCents / 100,
    additionalFees: feeCents / 100,
    averageNightly: Math.round(totalCents / nights) / 100,
  };
}

// Choose a complete multi-room offer. Never assemble rooms from separate offers.
export function normalizeHotelRates(
  payload: unknown,
  requested: Occupancy[] | number,
  nights = 1,
): HotelRate[] {
  const occupancies = typeof requested === "number"
    ? [{ adults: requested, children: [] }]
    : requested;
  const result = object(payload);
  if (
    !validOccupancies(occupancies) || !Number.isSafeInteger(nights) ||
    nights < 1 ||
    !result || result.sandbox !== true || !Array.isArray(result.data) ||
    !Array.isArray(result.hotels)
  ) return [];
  const names = new Map<string, string>();
  for (const entry of result.hotels) {
    const hotel = object(entry);
    if (
      hotel && typeof hotel.id === "string" && typeof hotel.name === "string" &&
      hotel.name.trim()
    ) {
      names.set(hotel.id, hotel.name.trim());
    }
  }
  const prices: HotelRate[] = [];
  for (const entry of result.data) {
    const hotel = object(entry);
    if (
      !hotel || typeof hotel.hotelId !== "string" ||
      !Array.isArray(hotel.roomTypes)
    ) continue;
    const hotelName = names.get(hotel.hotelId);
    if (!hotelName) continue;
    let cheapest: HotelRate | null = null;
    for (const entry of hotel.roomTypes) {
      const offer = object(entry);
      if (
        !offer || !Array.isArray(offer.rates) ||
        offer.rates.length !== occupancies.length
      ) continue;
      const available = offer.rates.map(object);
      const rooms: RoomPrice[] = [];
      for (const [index, occupancy] of occupancies.entries()) {
        const match = available.findIndex((rate) =>
          rate !== null &&
          rate.adultCount === occupancy.adults &&
          rate.childCount === occupancy.children.length &&
          sameChildren(rate.childrenAges, occupancy.children)
        );
        if (match === -1) break;
        const rate = available[match]!;
        available[match] = null;
        const room = roomPrice(rate, occupancy, index, nights);
        if (!room) break;
        rooms.push(room);
      }
      if (rooms.length !== occupancies.length) continue;
      const baseCents = rooms.reduce(
        (sum, room) => sum + Math.round(room.baseTotal * 100),
        0,
      );
      const feeCents = rooms.reduce(
        (sum, room) => sum + Math.round(room.additionalFees * 100),
        0,
      );
      if (!Number.isSafeInteger(baseCents + feeCents)) continue;
      const candidate: HotelRate = {
        hotelName,
        total: (baseCents + feeCents) / 100,
        currency: "USD",
        baseTotal: baseCents / 100,
        additionalFees: feeCents / 100,
        nights,
        rooms,
      };
      if (!cheapest || candidate.total < cheapest.total) cheapest = candidate;
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

  const occupancies = input.occupancies ?? (
    input.hotelSingleRoomAdults === true && Number.isSafeInteger(travelers)
      ? [{ adults: travelers, children: [] }]
      : null
  );
  if (!validOccupancies(occupancies)) {
    return unavailable(
      400,
      "Enter 1–8 rooms, each with at least one adult, up to 8 guests, and children's ages from 0 to 17.",
    );
  }
  const guestCount = occupancies.reduce(
    (sum, room) => sum + room.adults + room.children.length,
    0,
  );
  if (guestCount !== travelers) {
    return unavailable(
      400,
      "The guests assigned to rooms must match the trip's traveler count.",
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
          occupancies,
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
    const nights = Math.round(
      (Date.parse(endDate) - Date.parse(startDate)) / 86400000,
    );
    const rates = normalizeHotelRates(payload, occupancies, nights);

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
      roomCount: occupancies.length,
      nights,
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
