import { useState } from "react";

function TravelTime( { transportation } ) {
  const [distance, setDistance] = useState("");

  const speeds = {
    car: 60,
    bus: 45,
    train: 80,
    plane: 500,
  };

  const travelTime =
    distance && transportation
      ? (Number(distance) / speeds[transportation]).toFixed(1)
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


      {distance && !transportation && (
        <p className="error-message">
              Please select a transportation method in Trip Input Details.
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


        </>
      )}
    </>
  );
}

export default TravelTime;