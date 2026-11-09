import { useState } from "react";
import { buildStoredReport } from "./services/buildStoredReport";
import {
  normalizePricing,
  pricingLabel,
} from "./services/savedTripStorage";

const fields = [
  ["origin", "Origin", "text"],
  ["destination", "Destination", "text"],
  ["startDate", "Start Date", "date"],
  ["endDate", "End Date", "date"],
  ["cost", "Estimated Cost ($)", "number"],
  ["travelTime", "Travel Time (hours)", "number"],
  ["budget", "Budget ($)", "number"],
];

function validNumber(value, minimum) {
  return (
    value != null &&
    String(value).trim() !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= minimum
  );
}

function ScenarioComparison({
  user,
  tripForm,
  estimatedTotal,
  estimatedTravelTime,
  showResults,
  hasInvalidInput,
  calculationId,
  savedScenario,
  editingScenario,
  tripBusy,
  onSaveTrip,
  onDeleteTrip,
  reportContext,
  selectedHotel,
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
      pricing: { source: "manual" },
    },
  ]);

  const [preferredScenario, setPreferredScenario] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastCalculationId, setLastCalculationId] = useState(null);
  const [lastEditRequest, setLastEditRequest] = useState(null);
  const editChanged = editingScenario && editingScenario.requestId !== lastEditRequest;

  if (editChanged) {
    setLastEditRequest(editingScenario.requestId);
    setLastCalculationId(calculationId);
    setScenarios([{ ...editingScenario.scenario, id: 1 }]);
    setPreferredScenario(1);
    setSaveError("");
  }

  if (
    !editChanged &&
    showResults &&
    !hasInvalidInput &&
    calculationId !== lastCalculationId
  ) {
    setLastCalculationId(calculationId);

    const calculatedScenario = {
      id: 1,
      origin: tripForm.origin,
      destination: tripForm.destination,
      startDate: tripForm.startDate,
      endDate: tripForm.endDate,
      transportation: tripForm.transportation,
      cost: String(estimatedTotal),
      travelTime: String(estimatedTravelTime),
      budget: tripForm.budget,
      travelers: tripForm.travelers,
      pricing: selectedHotel
        ? normalizePricing({
            source: "liteapi-sandbox",
            hotelName: selectedHotel.hotelName,
            lodgingTotal: selectedHotel.total,
            baseTotal: selectedHotel.baseTotal,
            additionalFees: selectedHotel.additionalFees,
            ...(selectedHotel.rooms ? { rooms: selectedHotel.rooms, nights: selectedHotel.nights,
              roomCount: selectedHotel.rooms.length } : {}),
          })
        : { source: "manual" },
    };

    setScenarios((current) =>
      current.some((scenario) => scenario.id === 1)
        ? current.map((scenario) =>
            scenario.id === 1 ? calculatedScenario : scenario
          )
        : [calculatedScenario, ...current]
    );
  }

  function updateScenario(id, field, value) {
    setScenarios((current) =>
      current.map((scenario) => {
        if (scenario.id !== id) return scenario;

        let pricing = scenario.pricing;

        const changesPriceContext = [
          "origin",
          "destination",
          "startDate",
          "endDate",
          "transportation",
          "cost",
        ].includes(field);

        if (changesPriceContext && scenario[field] !== value) {
          const source = normalizePricing(pricing).source;

          pricing = {
            source:
              source === "liteapi-sandbox" || source === "edited-sandbox"
                ? "edited-sandbox"
                : "manual",
          };
        }

        return { ...scenario, [field]: value, pricing };
      })
    );

    setSaveError("");
  }

  function duplicateScenario(scenario) {
    const duplicate = {
      ...scenario,
      id: crypto.randomUUID(),
      pricing: normalizePricing(scenario.pricing),
    };

    setScenarios((current) => [...current, duplicate]);
  }

  function removeScenario(id) {
    if (scenarios.length === 1) return;

    setScenarios((current) =>
      current.filter((scenario) => scenario.id !== id)
    );

    if (preferredScenario === id) setPreferredScenario(null);
  }

  function selectPreferred(id) {
    setPreferredScenario(id);
    setSaveError("");
  }

  async function savePreferredScenario() {
    if (tripBusy || saving) return;

    if (!user?.id) {
      setSaveError("Please log in to save your preferred trip.");
      return;
    }

    const selected = scenarios.find(
      (scenario) => scenario.id === preferredScenario
    );

    if (!selected) {
      setSaveError("Select a preferred scenario first.");
      return;
    }

    const start = Date.parse(selected.startDate);
    const end = Date.parse(selected.endDate);

    const validTrip =
      selected.origin.trim() !== "" &&
      selected.destination.trim() !== "" &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end > start &&
      ["car", "bus", "train", "plane"].includes(selected.transportation) &&
      validNumber(selected.cost, 0) &&
      validNumber(selected.budget, 0) &&
      Number(selected.budget) > 0 &&
      validNumber(selected.travelTime, 0);

    if (!validTrip) {
      setSaveError(
        "Complete the selected scenario with valid locations, dates, " +
          "transportation, cost, budget, and travel time before saving."
      );
      return;
    }

    const tripToSave = {
      ...selected,
      pricing: normalizePricing(selected.pricing),
      report: buildStoredReport(selected, reportContext, editingScenario?.scenario),
      budgetResult:
        Number(selected.cost) <= Number(selected.budget)
          ? "Within budget"
          : "Over budget",
      savedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await onSaveTrip(tripToSave);
      setSaveError("");
    } catch {
      setSaveError(
        "Your trip could not be saved to your account. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteSavedScenario() {
    if (!user?.id) {
      setSaveError("Please log in to manage your saved trip.");
      return;
    }

    if (tripBusy || saving) return;

    setSaving(true);
    try {
      await onDeleteTrip();
      setSaveError("");
    } catch {
      setSaveError("The saved trip could not be deleted. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function budgetLabel(scenario) {
    if (
      !validNumber(scenario.cost, 0) ||
      !validNumber(scenario.budget, 0) ||
      Number(scenario.budget) <= 0
    ) {
      return "Not enough information";
    }

    return Number(scenario.cost) <= Number(scenario.budget) ? "Yes" : "No";
  }

  return (
    <section id="scenario-comparison" aria-labelledby="scenario-comparison-heading" tabIndex={-1}>
      <h2 id="scenario-comparison-heading">Scenario Comparison</h2>
      {editingScenario && <p role="status">Editing your saved trip. Update the fields below, then save your preferred scenario.</p>}
      <p>
        Scenarios are saved snapshots. Changing their fields does not
        fetch new hotel prices or recalculate the total.
      </p>

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
              {preferredScenario === scenario.id && " — Preferred"}
            </h3>

            {fields.map(([field, label, type]) => (
              <div className="form-group" key={field}>
                <label htmlFor={`${field}-${scenario.id}`}>
                  {label}:
                </label>
                <input
                  id={`${field}-${scenario.id}`}
                  type={type}
                  min={type === "number" ? "0" : undefined}
                  step={type === "number" ? "any" : undefined}
                  value={scenario[field]}
                  onChange={(event) =>
                    updateScenario(scenario.id, field, event.target.value)
                  }
                />
              </div>
            ))}

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

            <div className="scenario-results">
              <p>
                <strong>Estimated Cost:</strong>{" "}
                {scenario.cost === "" ? "Not entered" : `$${scenario.cost}`}
              </p>
              <p>
                <strong>Pricing Source:</strong>{" "}
                {pricingLabel(scenario.pricing)}
              </p>
              <p>
                <strong>Travel Time:</strong>{" "}
                {scenario.travelTime === ""
                  ? "Not entered"
                  : `${scenario.travelTime} hours`}
              </p>
              <p>
                <strong>Within Budget:</strong> {budgetLabel(scenario)}
              </p>
              <small>
                This budget check is not a full feasibility assessment.
              </small>
            </div>

            <button
              type="button"
              onClick={() => duplicateScenario(scenario)}
            >
              Duplicate Scenario
            </button>
            <button
              type="button"
              onClick={() => removeScenario(scenario.id)}
              disabled={scenarios.length === 1}
            >
              Remove Scenario
            </button>
            <button
              type="button"
              onClick={() => selectPreferred(scenario.id)}
            >
              Select Preferred
            </button>
          </div>
        ))}
      </div>

      {preferredScenario !== null && (
        <div className="preferred-section">
          <p>
            Preferred Scenario: Scenario{" "}
            {scenarios.findIndex((item) => item.id === preferredScenario) + 1}
          </p>
          <button
            type="button"
            disabled={tripBusy || saving}
            onClick={savePreferredScenario}
          >
            {tripBusy ? "Please wait..." : "Save Preferred Scenario"}
          </button>
        </div>
      )}

      {user && savedScenario && (
        <div className="saved-scenario">
          <h3>Saved Preferred Scenario</h3>
          <p>Saved to your account.</p>
          <p>{savedScenario.origin} to {savedScenario.destination}</p>
          <p>Estimated Cost: ${savedScenario.cost}</p>
          <p>Pricing Source: {pricingLabel(savedScenario.pricing)}</p>
          <p>Travel Time: {savedScenario.travelTime} hours</p>
          <button
            type="button"
            disabled={tripBusy || saving}
            onClick={deleteSavedScenario}
          >
            Delete Saved Scenario
          </button>
        </div>
      )}
    </section>
  );
}

export default ScenarioComparison;