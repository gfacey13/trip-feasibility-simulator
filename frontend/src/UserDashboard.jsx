import HotelRoomBreakdown from "./HotelRoomBreakdown";

import { useState } from "react";
import { pricingLabel } from "./services/savedTripStorage";

function money(value) {
  if (
    value == null ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "Not available";
  }

  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function SavedTripCard({ savedTrip, onEditTrip, onDeleteTrip }) {
  const [showSummary, setShowSummary] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await onDeleteTrip(savedTrip.persistedId); setConfirmDelete(false); }
    catch { setError("The saved trip could not be deleted. Please try again."); }
    finally { setBusy(false); }
  }
  return (
        <article className="dashboard-card" aria-label={`Saved trip: ${savedTrip.destination}`}>
          <h3>{savedTrip.destination || "Untitled trip"}</h3>

          <p>
            <strong>Dates:</strong> {savedTrip.startDate || "Not set"} to{" "}
            {savedTrip.endDate || "Not set"}
          </p>

          <p>
            <strong>Estimated cost:</strong> {money(savedTrip.cost)}
          </p>

          <p>
            <strong>Budget feasibility:</strong>{" "}
            {savedTrip.budgetResult || "No saved result"}
          </p>

          <p><strong>Saved assessment:</strong> {savedTrip.report?.analysis?.status || "No full assessment saved"}</p>
          <p><strong>Pricing source:</strong> {pricingLabel(savedTrip.pricing)}</p>

          <button
            type="button"
            aria-expanded={showSummary}
            onClick={() => setShowSummary((current) => !current)}
          >
            {showSummary ? "Close Summary" : "View Summary"}
          </button>

          <button type="button" disabled={busy} onClick={() => onEditTrip?.(savedTrip)}>Edit Saved Trip</button>
          {onDeleteTrip && <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete Saved Trip</button>}
          {confirmDelete && (
            <div role="group" aria-label={`Confirm deletion of ${savedTrip.destination}`}>
              <p>Delete this saved trip and its report history?</p>
              <button type="button" disabled={busy} onClick={remove}>Confirm Delete</button>

              <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          {showSummary && (
            <div className="dashboard-summary">
              <h4>Saved Trip Summary</h4>
              <p><strong>Travelers:</strong> {savedTrip.travelers ?? savedTrip.report?.travelers ?? "Not recorded"}</p>
              <p><strong>Saved assessment:</strong> {savedTrip.report?.analysis?.status || "No full assessment saved"}</p>
              {savedTrip.report?.analysis?.reasons?.length > 0 && <ul>{savedTrip.report.analysis.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
              {savedTrip.report && <>
                <p><strong>Transportation cost:</strong> {money(savedTrip.report.transportationTotal)}</p>
                <p><strong>Lodging cost:</strong> {money(savedTrip.report.lodgingTotal)}</p>
                <p><strong>Travel-time limit:</strong> {savedTrip.report.maxTravelTime != null ? `${savedTrip.report.maxTravelTime} hours` : "Not recorded"}</p>
                <p><strong>Weather:</strong> {savedTrip.report.weather?.status === "success" ? `Saved forecast for ${savedTrip.report.weather.data?.location || savedTrip.destination}` : "No complete weather forecast saved"}</p>
                {savedTrip.report.weather?.data?.days?.length > 0 && <ul>{savedTrip.report.weather.data.days.map((day) => <li key={day.date}>{day.date}: high {day.temperatureF ?? "Unavailable"}°F; precipitation {day.precipitationChance ?? "Unavailable"}%; maximum wind {day.windMph ?? "Unavailable"} mph.</li>)}</ul>}
              </>}
              <HotelRoomBreakdown rooms={savedTrip.pricing?.rooms} nights={savedTrip.pricing?.nights} />

              <p>
                <strong>Origin:</strong>{" "}
                {savedTrip.origin || "Not available"}
              </p>

              <p>
                <strong>Destination:</strong>{" "}
                {savedTrip.destination || "Not available"}
              </p>

              <p>
                <strong>Travel dates:</strong>{" "}
                {savedTrip.startDate || "Not set"} to{" "}
                {savedTrip.endDate || "Not set"}
              </p>

              <p>
                <strong>Transportation:</strong>{" "}
                {savedTrip.transportation || "Not available"}
              </p>

              <p>
                <strong>Estimated cost:</strong> {money(savedTrip.cost)}
              </p>

              <p>
                <strong>Budget:</strong> {money(savedTrip.budget)}
              </p>

              <p>
                <strong>Travel time:</strong>{" "}
                {savedTrip.travelTime != null &&
                savedTrip.travelTime !== ""
                  ? `${savedTrip.travelTime} hours`
                  : "Not available"}
              </p>

              <p>
                <strong>Budget feasibility:</strong>{" "}
                {savedTrip.budgetResult || "No saved result"}
              </p>

            </div>
          )}
        </article>
  );
}

function UserDashboard({ savedTrips, savedTrip, accountSaved = false, onEditTrip, onDeleteTrip }) {
  const trips = savedTrips ?? (savedTrip ? [savedTrip] : []);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const selected = trips.filter((trip) => selectedIds.includes(trip.persistedId));
  const rows = [
    ["Origin", (trip) => trip.origin],
    ["Destination", (trip) => trip.destination],
    ["Dates", (trip) => `${trip.startDate} to ${trip.endDate}`],
    ["Travelers", (trip) => trip.travelers ?? trip.report?.travelers ?? "Not recorded"],
    ["Transportation", (trip) => trip.transportation],
    ["Estimated cost", (trip) => money(trip.cost)],
    ["Budget", (trip) => money(trip.budget)],
    ["Budget feasibility", (trip) => trip.budgetResult],
    ["Travel time", (trip) => `${trip.travelTime} hours`],
    ["Saved assessment", (trip) => trip.report?.analysis?.status || "No full assessment saved"],
    ["Pricing source", (trip) => pricingLabel(trip.pricing)],
  ];
  return (
    <section className="user-dashboard" aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading">Your Dashboard</h2>
      <p>{accountSaved ? "Saved to your account." : "Saved on this device."} New trips are saved separately; editing updates only the selected trip.</p>
      {!trips.length ? (
        <div className="dashboard-empty">
          <h3>No saved trip yet</h3>
          <p>Enter your trip details, calculate the results, then select and save your preferred scenario below.</p>
        </div>
      ) : (
        <>
          <p>Select two or more saved trips to compare. Budget feasibility checks budget only; the saved assessment may also include travel time and weather.</p>
          <button type="button" disabled={selected.length < 2} onClick={() => setShowComparison(true)}>Compare Selected Trips ({selected.length})</button>
          {showComparison && selected.length >= 2 && (
            <section aria-labelledby="saved-comparison-heading">
              <h3 id="saved-comparison-heading">Saved Trip Comparison</h3>
              <p>These are saved snapshots. Comparing them does not fetch new prices or weather.</p>
              <div className="saved-comparison-scroll" role="region" aria-label="Saved trip comparison table" tabIndex={0}>
                <table className="saved-comparison-table">
                  <caption>Compare saved trip costs, budgets, travel times, and assessments</caption>
                  <thead><tr><th scope="col">Trip details</th>{selected.map((trip, index) => <th scope="col" key={trip.persistedId}>Trip {index + 1}: {trip.destination}</th>)}</tr></thead>
                  <tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{selected.map((trip) => <td key={trip.persistedId}>{value(trip)}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <button type="button" onClick={() => setShowComparison(false)}>Close Comparison</button>
            </section>
          )}
          <div className="dashboard-grid">
            {trips.map((trip) => (
              <div key={trip.persistedId ?? "device-trip"}>
                {trip.persistedId && <label className="compare-trip-choice"><input type="checkbox" checked={selectedIds.includes(trip.persistedId)} onChange={(event) => {
                  setSelectedIds((ids) => event.target.checked ? [...ids, trip.persistedId] : ids.filter((id) => id !== trip.persistedId));
                }} /> Compare {trip.destination} ({trip.startDate} to {trip.endDate})</label>}
                <SavedTripCard savedTrip={trip} onEditTrip={onEditTrip} onDeleteTrip={onDeleteTrip} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default UserDashboard;
