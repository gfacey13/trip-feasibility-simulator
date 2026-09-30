import { useState } from "react";

function TravelTime() {
  const [distance, setDistance] = useState("");
  const [transportMethod, setTransportMethod] = useState("");

  const speeds = {
    driving: 60,
    bus: 45,
    train: 80,
    flying: 500,
  };

  const travelTime =
    distance && transportMethod
      ? (Number(distance) / speeds[transportMethod]).toFixed(1)
      : null;

  const tripFeasible =
    travelTime !== null
      ? Number(travelTime) <= 8
      : null;

  return (
    <>
      <h2>Travel Time Calculator</h2>

      <label htmlFor="distance">
        Distance (Miles)
      </label>

      <input
        id="distance"
        type="number"
        min="1"
        placeholder="Enter trip distance"
        value={distance}
        onChange={(event) =>
          setDistance(event.target.value)
        }
      />

      <label htmlFor="transportMethod">
        Transportation Method
      </label>

      <select
        id="transportMethod"
        value={transportMethod}
        onChange={(event) =>
          setTransportMethod(event.target.value)
        }
      >
        <option value="">
          Select Transportation Method
        </option>

        <option value="driving">Driving</option>
        <option value="bus">Bus</option>
        <option value="train">Train</option>
        <option value="flying">Flying</option>
      </select>

      {distance && !transportMethod && (
        <p className="error-message">
          Please select a transportation method.
        </p>
      )}

      {travelTime && (
        <>
          <p>
            Estimated Travel Time:
            {" "}
            {travelTime}
            {" "}
            hours
          </p>

          <p>
            Trip Feasibility:
            {" "}
            {tripFeasible
              ? "Feasible ✅"
              : "Less Feasible ⚠️"}
          </p>
        </>
      )}
    </>
  );
}

export default TravelTime;