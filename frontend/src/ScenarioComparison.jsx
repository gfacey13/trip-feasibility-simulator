import { useState } from "react";

function ScenarioComparison() {
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
  const [savedScenario, setSavedScenario] = useState(null);

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
    setSavedScenario(null);
  };

  const duplicateScenario = (scenario) => {
    const newScenario = {
      ...scenario,
      id: Date.now(),
    };

    setScenarios([...scenarios, newScenario]);
  };

  const selectPreferred = (id) => {
    setPreferredScenario(id);
    setSavedScenario(null);
  };

  const savePreferredScenario = () => {
    if (preferredScenario === null) {
      return;
    }

    const selectedScenario = scenarios.find(
      (scenario) => scenario.id === preferredScenario
    );

    setSavedScenario(selectedScenario);
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
                <option value="Car">Car</option>
                <option value="Bus">Bus</option>
                <option value="Train">Train</option>
                <option value="Plane">Plane</option>
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
        <p>
          Scenario has been saved as your preferred scenario.
        </p>
      )}
    </div>
  );
}

export default ScenarioComparison;