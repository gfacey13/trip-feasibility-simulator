import { supabase } from "./supabaseClient";

export async function getDrivingRoute(originCity, destinationCity) {
  if (!supabase) {
    throw new Error("Driving estimates are not configured.");
  }

  const { data, error } = await supabase.functions.invoke("trip-route", {
    body: {
      origin: {
        latitude: originCity.latitude,
        longitude: originCity.longitude,
      },
      destination: {
        latitude: destinationCity.latitude,
        longitude: destinationCity.longitude,
      },
    },
  });

  if (
    error ||
    !Number.isFinite(data?.distanceMiles) ||
    !Number.isFinite(data?.durationMinutes) ||
    data.distanceMiles <= 0 ||
    data.durationMinutes <= 0
  ) {
    throw new Error("Could not estimate the driving route. Enter the distance manually.");
  }

  return data;
}
