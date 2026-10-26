// These thresholds are project assumptions, not validated delay predictions.
// Keep this logic separate from React so it can be reused and tested.
export function getWeatherRisk(day) {
  const reasons = [];
  let level = "Low";

  // Escalate warnings without allowing a later moderate warning to
  // overwrite an earlier high warning.
  function warn(severity, reason) {
    reasons.push(reason);
    if (severity === "High" || level === "Low") level = severity;
  }

  const code = day.weatherCode;
  const knownCodes = [
    0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57,
    61, 63, 65, 66, 67, 71, 73, 75, 77,
    80, 81, 82, 85, 86, 95, 96, 99,
  ];

  // Interpret the provider's weather codes before using numeric thresholds.
  if ([95, 96, 99].includes(code)) warn("High", "Thunderstorms forecast.");
  else if ([56, 57, 66, 67].includes(code)) warn("High", "Freezing precipitation forecast.");
  else if ([65, 75, 82, 86].includes(code)) warn("High", "Heavy rain or snow forecast.");
  else if ([71, 73, 77, 85].includes(code)) warn("Moderate", "Snow forecast.");
  else if ([45, 48].includes(code)) warn("Moderate", "Fog forecast.");
  else if ([51, 53, 55, 61, 63, 80, 81].includes(code)) warn("Moderate", "Rain or drizzle forecast.");

  if (Number.isFinite(day.windMph)) {
    if (day.windMph >= 35) warn("High", "Maximum wind is at least 35 mph.");
    else if (day.windMph >= 20) warn("Moderate", "Maximum wind is at least 20 mph.");
  }

  if (Number.isFinite(day.precipitationChance) && day.precipitationChance >= 60) {
    warn("Moderate", "Precipitation chance is at least 60%.");
  }

  // Missing data must never silently become a low-risk result.
  const complete = knownCodes.includes(code)
    && Number.isFinite(day.windMph) && day.windMph >= 0
    && Number.isFinite(day.precipitationChance)
    && day.precipitationChance >= 0 && day.precipitationChance <= 100;

  if (!complete) {
    reasons.push("Some weather measurements are unavailable; assessment is incomplete.");
    if (level === "Low") level = "Unknown";
  }

  if (reasons.length === 0) {
    reasons.push("No elevated weather risk detected by the project's rules.");
  }

  return { level, reasons, complete };
}