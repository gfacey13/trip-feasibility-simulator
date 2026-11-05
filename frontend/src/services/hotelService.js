export async function getHotelRates(
  {
    destination,
    startDate,
    endDate,
    travelers,
    countryCode,
    guestNationality,
    hotelSingleRoomAdults,
  },
  signal
) {
  const url = import.meta.env.VITE_HOTEL_API_URL;

  if (!url) {
    throw new Error(
      "Hotel pricing is not connected yet. Enter lodging costs manually."
    );
  }

  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();

  if (signal?.aborted) {
    throw new DOMException("Request cancelled.", "AbortError");
  }

  signal?.addEventListener("abort", cancel, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        destination,
        startDate,
        endDate,
        travelers: Number(travelers),
        countryCode,
        guestNationality,
        hotelSingleRoomAdults,
      }),
      signal: controller.signal,
    });

    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error(
        "The hotel service returned an unreadable response.",
        { cause: error }
      );
    }

    if (!response.ok || result?.status !== "retrieved") {
      throw new Error(
        "Hotel prices are unavailable. Try another search or enter lodging costs manually."
      );
    }

    const validRates =
      Array.isArray(result.rates) &&
      result.rates.length > 0 &&
      result.rates.every(
        (rate) =>
          rate !== null &&
          typeof rate === "object" &&
          typeof rate.hotelName === "string" &&
          rate.hotelName.trim() !== "" &&
          Number.isFinite(rate.total) &&
          rate.total > 0 &&
          rate.currency === "USD" &&
          Number.isFinite(rate.baseTotal) &&
          rate.baseTotal > 0 &&
          Number.isFinite(rate.additionalFees) &&
          rate.additionalFees >= 0 &&
          Math.abs(
            rate.total - rate.baseTotal - rate.additionalFees
          ) < 0.011
      );

    if (
      !validRates ||
      result.mode !== "sandbox" ||
      result.source !== "LiteAPI" ||
      result.priceBasis !== "whole-stay" ||
      result.roomCount !== 1
    ) {
      throw new Error(
        "No usable hotel test prices were returned. Enter lodging costs manually."
      );
    }

    return result;
  } catch (error) {
    if (signal?.aborted) {
      throw new DOMException("Request cancelled.", "AbortError");
    }

    if (timedOut) {
      throw new Error(
        "Hotel pricing timed out. Try again or enter lodging costs manually.",
        { cause: error }
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "The hotel service could not be reached. Enter lodging costs manually.",
        { cause: error }
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}