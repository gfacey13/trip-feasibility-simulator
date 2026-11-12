export default function TravelTime({
  transportation, distance, manualHours, route, loading, routeError, routeHint,
  onDistanceChange, onHoursChange, onUseManual, showErrors = false,
}) {
  if (route) {
    const minutes = Math.round(route.durationMinutes);
    return (
      <div className="form-group">
        <p><strong>One-way driving estimate</strong></p>
        <p>{route.distanceMiles.toFixed(1)} miles · {Math.floor(minutes / 60)} hr {minutes % 60} min</p>
        <small>Source: {route.source}</small>
        <button type="button" onClick={onUseManual}>Enter distance and time manually</button>
      </div>
    );
  }

  return (
    <div className="form-group">
      {loading && <p role="status">Looking up the driving route…</p>}
      {routeError && <p role="status">{routeError}</p>}
      {routeHint && <small>{routeHint}</small>}
      <label htmlFor="distance">Distance (Miles)</label>
      <input id="distance" type="number" min="0.01" step="any" value={distance}
        aria-invalid={showErrors && (!distance || Number(distance) <= 0)}
        aria-describedby="distance-help" onChange={(event) => onDistanceChange(event.target.value)} />
      <small id="distance-help">Enter the one-way distance in miles.</small>
      <label htmlFor="manualTravelHours">One-way travel time (optional, hours)</label>
      <input id="manualTravelHours" type="number" min="0.01" step="any" value={manualHours}
        aria-invalid={showErrors && manualHours !== "" && Number(manualHours) <= 0}
        aria-describedby="manual-time-help" onChange={(event) => onHoursChange(event.target.value)} />
      <small id="manual-time-help">Leave blank to estimate time from distance and an assumed speed for your transportation type.</small>
      {distance && !transportation && <p className="error-message" role="alert">Choose a transportation method in Trip Input Details.</p>}
    </div>
  );
}
