import { handleTripHotels, normalizeHotelRates } from "./handler.ts";

const occupancies = [{ adults: 2, children: [7] }, { adults: 1, children: [] }];
function room(adults: number, children: number[], amount: number) {
  return {
    name: "Standard Room",
    adultCount: adults,
    childCount: children.length,
    childrenAges: children,
    retailRate: {
      total: [{ currency: "USD", amount }],
      taxesAndFees: [
        { currency: "USD", amount: 5, included: true },
        { currency: "USD", amount: 10, included: false },
      ],
    },
  };
}
function payload(rates = [room(1, [], 300), room(2, [7], 200)]) {
  return {
    sandbox: true,
    hotels: [{ id: "hotel", name: "Family Hotel" }],
    data: [{ hotelId: "hotel", roomTypes: [{ rates }] }],
  };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
Deno.test("prices a complete offer, matches reversed rooms, and averages cents over nights", () => {
  const prices = normalizeHotelRates(payload(), occupancies, 2);
  assert(prices.length === 1, "Missing complete offer");
  const price = prices[0];
  assert(
    price.total === 520 && price.baseTotal === 500 &&
      price.additionalFees === 20,
    "Incorrect summed fees",
  );
  assert(
    price.rooms[0].total === 210 && price.rooms[0].averageNightly === 105,
    "First room did not match its occupancy",
  );
  assert(
    price.rooms[1].total === 310 && price.rooms[1].averageNightly === 155,
    "Second room average incorrect",
  );
  assert(price.rooms[0].children[0] === 7, "Child age lost");
});
Deno.test("does not assemble incomplete rooms from incompatible offers", () => {
  const data = payload();
  data.data[0].roomTypes = [{ rates: [room(2, [7], 100)] }, {
    rates: [room(1, [], 100)],
  }];
  assert(
    normalizeHotelRates(data, occupancies, 2).length === 0,
    "Combined separate offers",
  );
});
Deno.test("rejects incorrect child ages and missing occupancy rooms", () => {
  assert(
    normalizeHotelRates(
      payload([room(2, [8], 200), room(1, [], 300)]),
      occupancies,
      2,
    ).length === 0,
    "Accepted wrong child age",
  );
  assert(
    normalizeHotelRates(payload([room(2, [7], 200)]), occupancies, 2).length ===
      0,
    "Accepted partial room set",
  );
});
Deno.test("selects the cheapest whole offer without mixing room prices", () => {
  const data = payload();
  data.data[0].roomTypes.push({ rates: [room(2, [7], 50), room(1, [], 800)] });
  assert(
    normalizeHotelRates(data, occupancies, 2)[0].total === 520,
    "Mixed cheaper rooms from separate offers",
  );
});
Deno.test("preserves one-room legacy parsing and rounds nightly averages correctly", () => {
  const price = normalizeHotelRates(payload([room(2, [], 4271.81)]), 2, 6)[0];
  assert(
    price.total === 4281.81 && price.rooms[0].averageNightly === 713.64,
    "Incorrect nightly rounding",
  );
});
Deno.test("rejects non-USD fees and invalid room arrangements", () => {
  const data = payload();
  data.data[0].roomTypes[0].rates[0].retailRate.taxesAndFees[1].currency =
    "EUR";
  assert(
    normalizeHotelRates(data, occupancies, 2).length === 0,
    "Accepted mixed currency",
  );
  assert(
    normalizeHotelRates(payload(), [{ adults: 0, children: [7] }], 2).length ===
      0,
    "Accepted child-only room",
  );
});
Deno.test("backend validates guest totals and ages before using the provider", async () => {
  for (
    const rooms of [[{ adults: 2, children: [18] }], [{
      adults: 1,
      children: [],
    }]]
  ) {
    const response = await handleTripHotels(
      new Request("http://localhost/hotels", {
        method: "POST",
        body: JSON.stringify({
          destination: "Boston",
          travelers: 4,
          countryCode: "US",
          guestNationality: "US",
          startDate: "2026-11-15",
          endDate: "2026-11-17",
          occupancies: rooms,
        }),
      }),
    );
    assert(response.status === 400, "Invalid occupancy reached provider");
  }
});
Deno.test("backend sends each occupancy once and returns room counts and nightly details", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = Deno.env.get("LITEAPI_API_KEY");
  Deno.env.set("LITEAPI_API_KEY", "local-test-placeholder");
  let requestBody: Record<string, unknown> | undefined;
  try {
    globalThis.fetch = async (_input, options) => {
      requestBody = JSON.parse(String(options?.body));
      return Response.json(payload());
    };
    const response = await handleTripHotels(
      new Request("http://localhost/hotels", {
        method: "POST",
        body: JSON.stringify({
          destination: "Boston",
          travelers: 4,
          countryCode: "US",
          guestNationality: "US",
          startDate: "2026-11-15",
          endDate: "2026-11-17",
          occupancies,
        }),
      }),
    );
    const data = await response.json();
    assert(
      response.status === 200 && data.roomCount === 2 && data.nights === 2,
      "Response room count/dates mismatch",
    );
    assert(
      JSON.stringify(requestBody?.occupancies) === JSON.stringify(occupancies),
      "Occupancies changed upstream",
    );
    assert(
      data.rates[0].total === 520,
      "Whole-stay price multiplied by nights",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Deno.env.delete("LITEAPI_API_KEY");
    else Deno.env.set("LITEAPI_API_KEY", originalKey);
  }
});
