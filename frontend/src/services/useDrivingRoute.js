import { useEffect, useState } from "react";
import { getDrivingRoute } from "./routeService";

function hasCoordinates(city) {
  return Number.isFinite(city?.latitude) && Number.isFinite(city?.longitude);
}

export function useDrivingRoute(form, userId) {
  const { originCity, destinationCity, transportation } = form;
  const ready = transportation === "car" && hasCoordinates(originCity) && hasCoordinates(destinationCity);
  const key = ready && userId ? JSON.stringify([userId, originCity.id, originCity.latitude,
    originCity.longitude, destinationCity.id, destinationCity.latitude, destinationCity.longitude]) : null;
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!key) return;
    let active = true;
    getDrivingRoute(originCity, destinationCity).then((route) => {
      if (active) setResult({ key, route });
    }).catch((error) => {
      if (active) setResult({ key, error: error.message });
    });
    return () => { active = false; };
  }, [key, originCity, destinationCity]);

  if (!key) return { ready, loading: false };
  if (result?.key !== key) return { ready, loading: true };
  return { ready, loading: false, route: result.route, error: result.error };
}
