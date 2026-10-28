import { useState, useEffect } from "react";

function ScenarioComparison({
  tripForm,
  estimatedTotal,
  estimatedTravelTime,
  showResults,
  hasInvalidInput,
  savedScenario,
  onSavedScenarioChange,
}) {
  const [scenarios, setScenarios] = useState([
    {
      id: 1,
      origin: "",
      destination: "",
      startDate: "",
      endDate: "",
      transportation: "",
      cost: "",
      travelTime: "",
      budget: "",
    },
  ]);

  const [preferredScenario, setPreferredScenario] = useState(null);

  const [saveError, setSaveError] = useState("");

useEffect(() => {
  if (!showResults || hasInvalidInput) return;

  setScenarios((currentScenarios) =>
    currentScenarios.map((scenario) =>
      scenario.id === 1
        ? {
            ...scenario,
            origin: tripForm.origin,
            destination: tripForm.destination,
            startDate: tripForm.startDate,
            endDate: tripForm.endDate,
            transportation: tripForm.transportation,
            cost: String(estimatedTotal),
            travelTime: String(estimatedTravelTime),
            budget: tripForm.budget,
          }
        : scenario
    )
  );
}, [showResults, hasInvalidInput, tripForm, estimatedTotal, estimatedTravelTime]);

  const updateScenario = (id, field, value) => {
    const updatedScenarios = scenarios.map((scenario) =>
      scenario.id === id
        ? {
            ...scenario,
            [field]: value,
          }
        : scenario
    );

    setScenarios(updatedScenarios);
  };

  const duplicateScenario = (scenario) => {
    const newScenario = {
      ...scenario,
      id: Date.now(),
    };

    setScenarios([...scenarios, newScenario]);
  };

  const removeScenario = (id) => {
    if (scenarios.length === 1) {
      return;
    }

    setScenarios((currentScenarios) =>
      currentScenarios.filter((scenario) => scenario.id !== id)
    );

    if (preferredScenario === id) {
      setPreferredScenario(null);
    }
  };

  const selectPreferred = (id) => {
    setPreferredScenario(id);
  };

  const deleteSavedScenario = () => {
  try {
    localStorage.removeItem("savedPreferredScenario");
    onSavedScenarioChange(null);
    setSaveError("");
  } catch {
    setSaveError("The saved trip could not be deleted. Please try again.");
  }
};

  const savePreferredScenario = () => {
  const selectedScenario = scenarios.find(
    (scenario) => scenario.id === preferredScenario
  );

  if (!selectedScenario) {
    setSaveError("Select a preferred scenario first.");
    return;
  }

  const validNumber = (value, minimum) =>
    value != null &&
    String(value).trim() !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= minimum;

  const start = Date.parse(selectedScenario.startDate);
  const end = Date.parse(selectedScenario.endDate);

  const validTrip =
    selectedScenario.origin.trim() !== "" &&
    selectedScenario.destination.trim() !== "" &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    end > start &&
    ["car", "bus", "train", "plane"].includes(
      selectedScenario.transportation
    ) &&
    validNumber(selectedScenario.cost, 0) &&
    validNumber(selectedScenario.budget, 0) &&
    Number(selectedScenario.budget) > 0 &&
    validNumber(selectedScenario.travelTime, 0);

  if (!validTrip) {
    setSaveError(
      "Complete the selected scenario with valid locations, dates, " +
      "transportation, cost, budget, and travel time before saving."
    );
    return;
  }

  const tripToSave = {
    ...selectedScenario,
    budgetResult:
      Number(selectedScenario.cost) <= Number(selectedScenario.budget)
        ? "Within budget"
        : "Over budget",
    savedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(
      "savedPreferredScenario",
      JSON.stringify(tripToSave)
    );

    onSavedScenarioChange(tripToSave);
    setSaveError("");
  } catch {
    setSaveError(
      "The trip could not be saved on this device. Please try again."
    );
  }
};

  const getFeasibility = (scenario) => {
    if (scenario.cost === "" || scenario.budget === "") {
      return "Not enough information";
    }

    return Number(scenario.cost) <= Number(scenario.budget)
      ? "Yes"
      : "No";
  };

  return (
    <div>
      <h2>Scenario Comparison</h2>

      {saveError && (
  <p className="error-message" role="alert">
    {saveError}
  </p>
)}

      <div
        className="scenario-container"
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "flex-start",
          flexWrap: "wrap",
     }}
   >
        {scenarios.map((scenario, index) => (
          <div
           className="scenario-card"
           key={scenario.id}
           style={{
             flex: "1 1 300px",
             border: "1px solid #ccc",
             padding: "20px",
             borderRadius: "8px",
         }}
     >
            <h3>
              Scenario {index + 1}
              {preferredScenario === scenario.id && " ⭐ Preferred"}
            </h3>

            <div className="form-group">
              <label htmlFor={`origin-${scenario.id}`}>
                Origin:
              </label>

              <input
                id={`origin-${scenario.id}`}
                type="text"
                placeholder="Enter origin"
                value={scenario.origin}
                onChange={(event) =>
                  updateScenario(
                    scenario.id,
                    "origin",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor={`destination-${scenario.id}`}>
                Destination:
              </label>

              <input
                id={`destination-${scenario.id}`}
                type="text"
                placeholder="Enter destination"
                value={scenario.destination}
                onChange={(event) =>
                  updateScenario(
                    scenario.id,
                    "destination",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor={`start-${scenario.id}`}>
                Start Date:
              </label>

              <input
                id={`start-${scenario.id}`}
                type="date"
                value={scenario.startDate}
                onChange={(event) =>
                  updateScenario(
                    scenario.id,
                    "startDate",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor={`end-${scenario.id}`}>
                End Date:
              </label>

              <input
                id={`end-${scenario.id}`}
                type="date"
                value={scenario.endDate}
                onChange={(event) =>
                  updateScenario(
                    scenario.id,
                    "endDate",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor={`transportation-${scenario.id}`}>
                Transportation:
              </label>

              <select
                id={`transportation-${scenario.id}`}
                value={scenario.transportation}
                onChange={(event) =>
                  updateScenario(
                    scenario.id,
                    "transportation",
                    event.target.value
                  )
                }
              >
                <option value="">Select one</option>
                <option value="car">Car</option>
                <option value="bus">Bus</option>
                <option value="train">Train</option>
                <option value="plane">Plane</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor={`cost-${scenario.id}`}>
                Estimated Cost ($):
              </label>

              <input
                id={`cost-${scenario.id}`}
                type="number"
                min="0"
                placeholder="Enter estimated cost"
                value={scenario.cost}
                onChange={(event) =>
                  updateScenario(
                    scenario.id,
                    "cost",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor={`travel-time-${scenario.id}`}>
                Travel Time (hours):
              </label>

              <input
                id={`travel-time-${scenario.id}`}
                type="number"
                min="0"
                step="0.1"
                placeholder="Enter travel time"
                value={scenario.travelTime}
                onChange={(event) =>
                  updateScenario(
                    scenario.id,
                    "travelTime",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor={`budget-${scenario.id}`}>
                Budget ($):
              </label>

              <input
                id={`budget-${scenario.id}`}
                type="number"
                min="0"
                placeholder="Enter budget"
                value={scenario.budget}
                onChange={(event) =>
                  updateScenario(
                    scenario.id,
                    "budget",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="scenario-results">
              <p>
                <strong>Estimated Cost:</strong>{" "}
                {scenario.cost === ""
                  ? "Not entered"
                  : `$${scenario.cost}`}
              </p>

              <p>
                <strong>Travel Time:</strong>{" "}
                {scenario.travelTime === ""
                  ? "Not entered"
                  : `${scenario.travelTime} hours`}
              </p>

              <p>
                <strong>Feasible:</strong>{" "}
                {getFeasibility(scenario)}
              </p>
            </div>

            <button
              onClick={() => duplicateScenario(scenario)}
            >
              Duplicate Scenario
            </button>
            <button
              onClick={() => removeScenario(scenario.id)}
              disabled={scenarios.length === 1}
              style={{ marginLeft: "10px" }}
            >
              Remove Scenario
            </button>

            <button
              onClick={() => selectPreferred(scenario.id)}
              style={{ marginLeft: "10px" }}
            >
              Select Preferred
            </button>
          </div>
        ))}
      </div>

      {preferredScenario !== null && (
        <div className="preferred-section">
          <p>
            Preferred Scenario:{" "}
            {scenarios.find(
              (scenario) => scenario.id === preferredScenario
            )
              ? `Scenario ${
                  scenarios.findIndex(
                    (scenario) =>
                      scenario.id === preferredScenario
                  ) + 1
                }`
              : ""}
          </p>

          <button onClick={savePreferredScenario}>
            Save Preferred Scenario
          </button>
        </div>
      )}

      {savedScenario && (
        <div className="saved-scenario">
          <h3>Saved Preferred Scenario</h3>
          <p>
            {savedScenario.origin} to {savedScenario.destination}
          </p>
          <p>Estimated Cost: ${savedScenario.cost}</p>
          <p>Travel Time: {savedScenario.travelTime} hours</p>
          <button
            type="button"
            onClick={deleteSavedScenario}
          >
            Delete Saved Scenario
          </button>
        </div>
      )}

    </div>
  );
}

export default ScenarioComparison;