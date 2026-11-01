import { useState } from "react";

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

function UserDashboard({ savedTrip }) {
  const [showSummary, setShowSummary] = useState(false);

  if (!savedTrip) {
    return (
      <section className="user-dashboard">
        <h2>Your Dashboard</h2>
        <p>Saved on this device.</p>

        <div className="dashboard-empty">
          <h3>No saved trip yet</h3>
          <p>
            Enter your trip details, calculate the results, then select
            and save your preferred scenario below.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="user-dashboard">
      <h2>Your Dashboard</h2>
      <p>
        Saved on this device. Saving another preferred scenario replaces
        this trip.
      </p>

      <div className="dashboard-grid">
        <article className="dashboard-card">
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

          <button
            type="button"
            aria-expanded={showSummary}
            onClick={() => setShowSummary((current) => !current)}
          >
            {showSummary ? "Close Summary" : "View Summary"}
          </button>

          {showSummary && (
            <div className="dashboard-summary">
              <h4>Saved Trip Summary</h4>

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
      </div>
    </section>
  );
}

export default UserDashboard;