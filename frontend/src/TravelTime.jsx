import { useState } from "react";

function TravelTime({ transportation, onDistanceChange, showErrors = false }) {
  const [distance, setDistance] = useState("");

  return (
    <div className="form-group">

      <label htmlFor="distance">
        Distance (Miles)
      </label>

      <input
        aria-invalid={showErrors && (!distance || Number(distance) <= 0)}
        aria-describedby="distance-help"
        id="distance"
        type="number"
        min="1"
        placeholder="Enter trip distance"
        value={distance}
        onChange={(event) =>{
          const newDistance = event.target.value;
          setDistance(newDistance);
          onDistanceChange?.(newDistance);
        }}
      />


      <small id="distance-help">Enter the journey distance in miles, greater than zero.</small>
      {distance && !transportation && (
        <p className="error-message" role="alert">
              Please select a transportation method in Trip Input Details.
        </p>
      )}

    </div>
  );
}

export default TravelTime;