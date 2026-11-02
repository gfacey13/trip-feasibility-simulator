// Local device storage is a prototype, not authenticated account persistence.
// Accept the existing saved format, but never render arbitrary parsed objects.
export function readSavedTrip(storage = globalThis.localStorage) {
  try {
    const trip = JSON.parse(storage.getItem("savedPreferredScenario"));
    if (!trip || typeof trip !== "object" || Array.isArray(trip)) return null;
    const textFields = ["origin", "destination", "startDate", "endDate", "transportation"];
    if (!textFields.every((key) => typeof trip[key] === "string" && trip[key].trim())) return null;
    if (!["car", "bus", "train", "plane"].includes(trip.transportation)) return null;
    const validNumber = (value) =>
      (typeof value === "string" || typeof value === "number")
      && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
    if (![trip.cost, trip.budget, trip.travelTime].every(validNumber) || Number(trip.budget) <= 0) return null;
    if (!Number.isFinite(Date.parse(trip.startDate)) || !Number.isFinite(Date.parse(trip.endDate))
      || Date.parse(trip.endDate) <= Date.parse(trip.startDate)) return null;
    // Copy only fields the current UI understands and derive the budget label.
    return {
      ...Object.fromEntries(textFields.map((key) => [key, trip[key]])),
      cost: String(trip.cost), budget: String(trip.budget), travelTime: String(trip.travelTime),
      savedAt: typeof trip.savedAt === "string" ? trip.savedAt : "",
      budgetResult: Number(trip.cost) <= Number(trip.budget) ? "Within budget" : "Over budget",
    };
  } catch {
    return null;
  }
}
