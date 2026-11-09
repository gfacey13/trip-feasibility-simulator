import { normalizeHotelRooms, validRoomOccupancies } from "./hotelRooms";

export async function getHotelRates(
  {
    destination,
    startDate,
    endDate,
    travelers,
    countryCode,
    guestNationality,
    hotelSingleRoomAdults,
    occupancies,
  },
  signal
) {
  const url = import.meta.env.VITE_HOTEL_API_URL;

  if (!url) {
    throw new Error(
      "Hotel pricing is not connected yet. Enter lodging costs manually."
    );
  }

  const requestedRooms = occupancies;
  if (requestedRooms !== undefined && (!validRoomOccupancies(requestedRooms)
    || requestedRooms.reduce((sum, room) => sum + room.adults + room.children.length, 0) !== Number(travelers))) {
    throw new Error("Assign all travelers to rooms, with at least one adult per room and valid children's ages.");
  }
  const nights = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000);
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
        occupancies,
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
      result.roomCount !== (requestedRooms?.length ?? 1)
    ) {
      throw new Error(
        "No usable hotel test prices were returned. Enter lodging costs manually."
      );
    }

    if (requestedRooms) {
      if (result.nights !== nights) throw new Error("The returned hotel stay dates do not match your search.");
      for (const rate of result.rates) {
        const rooms = normalizeHotelRooms(rate.rooms, nights, rate.total, rate.baseTotal, rate.additionalFees);
        if (!rooms || rooms.some((room, index) => room.adults !== requestedRooms[index].adults
          || JSON.stringify([...room.children].sort((a, b) => a - b))
            !== JSON.stringify([...requestedRooms[index].children].sort((a, b) => a - b)))) {
          throw new Error("The hotel prices do not match your room arrangement. Try another search.");
        }
        rate.rooms = rooms;
        rate.nights = nights;
      }
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