import { normalizeHotelRooms } from "./hotelRooms";

// Local device storage is a prototype, not authenticated account persistence.

export function normalizePricing(pricing) {
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) {
    return { source: "unknown" };
  }

  if (pricing.source === "liteapi-sandbox") {
    if (
      typeof pricing.hotelName !== "string" ||
      !pricing.hotelName.trim() ||
      !Number.isFinite(pricing.lodgingTotal) ||
      pricing.lodgingTotal <= 0
    ) {
      return { source: "unknown" };
    }

    const feeDetails = {};
    if (pricing.baseTotal !== undefined || pricing.additionalFees !== undefined) {
      if (!Number.isFinite(pricing.baseTotal) || pricing.baseTotal <= 0
          || !Number.isFinite(pricing.additionalFees) || pricing.additionalFees < 0
          || Math.abs(pricing.lodgingTotal - pricing.baseTotal - pricing.additionalFees) >= 0.011) {
        return { source: "unknown" };
      }
      feeDetails.baseTotal = pricing.baseTotal;
      feeDetails.additionalFees = pricing.additionalFees;
    }

    const roomDetails = {};
    if (pricing.rooms !== undefined || pricing.nights !== undefined) {
      const rooms = normalizeHotelRooms(pricing.rooms, pricing.nights, pricing.lodgingTotal, pricing.baseTotal, pricing.additionalFees);
      if (!rooms || pricing.roomCount !== rooms.length) return { source: "unknown" };
      roomDetails.rooms = rooms;
      roomDetails.nights = pricing.nights;
      roomDetails.roomCount = rooms.length;
    }
    return {
      ...roomDetails,
      ...feeDetails,
      source: "liteapi-sandbox",
      hotelName: pricing.hotelName.trim(),
      lodgingTotal: pricing.lodgingTotal,
    };
  }

  if (["manual", "edited-sandbox", "unknown"].includes(pricing.source)) {
    return { source: pricing.source };
  }

  return { source: "unknown" };
}

export function pricingLabel(pricing) {
  const checked = normalizePricing(pricing);

  if (checked.source === "liteapi-sandbox") {
    return (
      `LiteAPI sandbox — ${checked.hotelName}; ` +
      `$${checked.lodgingTotal.toFixed(2)} USD lodging for the whole stay. ` +
      (checked.rooms ? `${checked.roomCount} ${checked.roomCount === 1 ? "room" : "rooms"} for ${checked.nights} nights. ` : "") +
      "Transportation is user-entered. Not a booking quote."
    );
  }

  if (checked.source === "edited-sandbox") {
    return (
      "Manually edited scenario originally based on sandbox pricing. " +
      "The previous hotel price no longer applies; review the total."
    );
  }

  if (checked.source === "manual") {
    return "User-entered cost estimate.";
  }

  return "Pricing source was not recorded.";
}

export function readSavedTrip(storage) {
  try {
    // Access storage inside the try block because browsers may block it.
    const targetStorage = storage ?? globalThis.localStorage;
    const trip = JSON.parse(
      targetStorage.getItem("savedPreferredScenario")
    );

    if (!trip || typeof trip !== "object" || Array.isArray(trip)) {
      return null;
    }

    const textFields = [
      "origin",
      "destination",
      "startDate",
      "endDate",
      "transportation",
    ];

    if (
      !textFields.every(
        (key) => typeof trip[key] === "string" && trip[key].trim()
      )
    ) {
      return null;
    }

    if (!["car", "bus", "train", "plane"].includes(trip.transportation)) {
      return null;
    }

    const validNumber = (value) =>
      (typeof value === "string" || typeof value === "number") &&
      String(value).trim() !== "" &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0;

    if (
      ![trip.cost, trip.budget, trip.travelTime].every(validNumber) ||
      Number(trip.budget) <= 0
    ) {
      return null;
    }

    const start = Date.parse(trip.startDate);
    const end = Date.parse(trip.endDate);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return null;
    }

    return {
      ...Object.fromEntries(textFields.map((key) => [key, trip[key]])),
      cost: String(trip.cost),
      budget: String(trip.budget),
      travelTime: String(trip.travelTime),
      savedAt: typeof trip.savedAt === "string" ? trip.savedAt : "",
      budgetResult:
        Number(trip.cost) <= Number(trip.budget)
          ? "Within budget"
          : "Over budget",
      pricing: normalizePricing(trip.pricing),
    };
  } catch {
    return null;
  }
}