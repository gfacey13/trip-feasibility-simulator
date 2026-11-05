import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHotelRates } from "./hotelService";

const input = {
  destination: "New York",
  startDate: "2026-12-10",
  endDate: "2026-12-12",
  travelers: "2",
  countryCode: "US",
  guestNationality: "US",
  hotelSingleRoomAdults: true,
};

function validResponse() {
  return {
    status: "retrieved",
    mode: "sandbox",
    source: "LiteAPI",
    priceBasis: "whole-stay",
    roomCount: 1,
    rates: [
      {
        hotelName: "Example Hotel",
        total: 300,
        baseTotal: 275,
        additionalFees: 25,
        currency: "USD",
      },
    ],
  };
}

function respondWith(body, status = 200) {
  fetch.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

// Simulate a pending request that rejects when aborted.
function pendingRequest() {
  fetch.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        const abort = () =>
          reject(new DOMException("Request aborted.", "AbortError"));

        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener("abort", abort, { once: true });
        }
      })
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_HOTEL_API_URL", "https://example.test/trip-hotels");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getHotelRates", () => {
  it("sends search details and returns the whole-stay price unchanged", async () => {
    respondWith(validResponse());

    const result = await getHotelRates(input);

    expect(result.rates[0].total).toBe(300);

    const [url, options] = fetch.mock.calls[0];

    expect(url).toBe("https://example.test/trip-hotels");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      ...input,
      travelers: 2,
    });
    expect(options.headers).toEqual({
      "Content-Type": "application/json",
    });
  });

  it("reports missing configuration without making a request", async () => {
    vi.stubEnv("VITE_HOTEL_API_URL", "");

    await expect(getHotelRates(input)).rejects.toThrow(
      "Hotel pricing is not connected yet."
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a safe fallback for backend errors", async () => {
    respondWith(
      { status: "unavailable", message: "Internal provider details" },
      503
    );

    await expect(getHotelRates(input)).rejects.toThrow(
      "Hotel prices are unavailable. Try another search or enter lodging costs manually."
    );
  });

  it("handles unreadable responses", async () => {
    fetch.mockResolvedValue(new Response("not JSON", { status: 200 }));

    await expect(getHotelRates(input)).rejects.toThrow(
      "The hotel service returned an unreadable response."
    );
  });

  it("preserves the cause of network failures", async () => {
    const cause = new TypeError("Failed to fetch");
    fetch.mockRejectedValue(cause);

    await expect(getHotelRates(input)).rejects.toMatchObject({
      message:
        "The hotel service could not be reached. Enter lodging costs manually.",
      cause,
    });
  });

  it.each([
    ["production mode", (body) => { body.mode = "production"; }],
    ["wrong source", (body) => { body.source = "Other"; }],
    ["nightly pricing", (body) => { body.priceBasis = "nightly"; }],
    ["multiple rooms", (body) => { body.roomCount = 2; }],
    ["empty results", (body) => { body.rates = []; }],
    ["missing hotel name", (body) => { body.rates[0].hotelName = ""; }],
    ["non-USD pricing", (body) => { body.rates[0].currency = "EUR"; }],
    ["numeric string", (body) => { body.rates[0].total = "300"; }],
    ["zero price", (body) => { body.rates[0].total = 0; }],
    ["inconsistent fee total", (body) => { body.rates[0].total = 310; }],
    ["negative fees", (body) => { body.rates[0].additionalFees = -25; }],
  ])("rejects %s", async (_name, modify) => {
    const body = validResponse();
    modify(body);
    respondWith(body);

    await expect(getHotelRates(input)).rejects.toThrow(
      "No usable hotel test prices were returned."
    );
  });

  it("does not fetch when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      getHotelRates(input, controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves cancellation during a request", async () => {
    pendingRequest();
    const controller = new AbortController();

    const request = getHotelRates(input, controller.signal);
    const check = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });

    controller.abort();
    await check;
  });

  it("times out after 20 seconds", async () => {
    vi.useFakeTimers();
    pendingRequest();

    const request = getHotelRates(input);
    const check = expect(request).rejects.toThrow(
      "Hotel pricing timed out."
    );

    await vi.advanceTimersByTimeAsync(20000);
    await check;

    expect(vi.getTimerCount()).toBe(0);
  });
});