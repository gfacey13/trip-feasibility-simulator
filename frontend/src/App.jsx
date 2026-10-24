import { useState } from 'react'
import './App.css'
import TravelTime from "./TravelTime";
import TripInputForm from "./TripInputForm";
import ScenarioComparison from "./ScenarioComparison";


function App() {

  const [transportationCost, setTransportationCost] = useState("");
  const [lodgingCost, setLodgingCost] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [distance, setDistance] = useState("");

  const [tripForm, setTripForm] = useState({
  origin: "",
  destination: "",
  startDate: "",
  endDate: "",
  budget: "",
  travelers: "",
  transportation: "",
});

const invalidDates =
  tripForm.startDate &&
  tripForm.endDate &&
  new Date(`${tripForm.endDate}T00:00:00`) <=
    new Date(`${tripForm.startDate}T00:00:00`);

const nights =
  tripForm.startDate &&
  tripForm.endDate &&
  !invalidDates
    ? Math.round(
        (new Date(`${tripForm.endDate}T00:00:00`) -
          new Date(`${tripForm.startDate}T00:00:00`)) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  const hasInvalidInput =
    distance === "" ||
    Number(distance) <= 0 ||
    tripForm.travelers === "" ||
    tripForm.origin.trim() === "" ||
    tripForm.destination.trim() === "" ||
    tripForm.startDate === "" ||
    tripForm.endDate === "" ||
    tripForm.budget === "" ||
    Number(tripForm.budget) <= 0 ||
    tripForm.transportation === "" ||
    transportationCost === "" ||
    nights === 0 ||
    lodgingCost === "" ||
    invalidDates ||
    Number(tripForm.travelers) < 1 ||
    Number(nights) < 1 || 
    Number(transportationCost) < 0 ||
    Number(lodgingCost) < 0;

  const allFieldsFilled =
    tripForm.travelers !== "" &&
    transportationCost !== "" &&
    nights > 0 &&
    lodgingCost !== ""

  const transportationTotal = hasInvalidInput
    ? 0
    : Number(tripForm.travelers) * Number(transportationCost);

  const lodgingTotal = hasInvalidInput
    ? 0
    : Number(nights) * Number(lodgingCost);

  const estimatedTotal = transportationTotal + lodgingTotal;

  const speeds = {
  car: 60,
  bus: 45,
  train: 80,
  plane: 500,
};

const estimatedTravelTime =
  Number(distance) > 0 && speeds[tripForm.transportation]
    ? (Number(distance) / speeds[tripForm.transportation]).toFixed(1)
    : null;


  return (
    <main>
      <h1>Trip Feasibility Simulator</h1>

      <TripInputForm 
        onFormChange={(updatedForm) => {
          setTripForm(updatedForm);
          setShowResults(false);
        }}
      />
      
      <p>Enter your trip details to estimate transportation and lodging costs.</p>

      <div className="cost-inputs">
        <div className="form-group">
          <label htmlFor="transportationCost">
            Transportation Cost Per Traveler
          </label>
          <input
            id="transportationCost"
            type="number"
            min="0"
            placeholder="Enter transportation cost"
            value={transportationCost}
            onChange={(event) => {
              setTransportationCost(event.target.value);
              setShowResults(false);
            }}
          />
          
        </div>

        <div className="form-group">
          <label htmlFor="nights">Number of Nights</label>
          <p className="calculated-value">
            {nights || "Calculated from dates"}
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="lodgingCost">
            Lodging Cost Per Night
          </label>
          <input
            id="lodgingCost"
            type="number"
            min="0"
            placeholder="Enter lodging cost per night"
            value={lodgingCost}
            onChange={(event) => {
              setLodgingCost(event.target.value);
              setShowResults(false);
            }}
          />
        </div>
      </div>

      {showResults && hasInvalidInput && !invalidDates && (
        <p className ="error-message">
            Please complete all required trip details and enter valid costs.
        </p>
      )}
      
  
      {invalidDates && (
        <p className="error-message">
          End date must be after start date.
        </p>
      )}

      <TravelTime 
        transportation={tripForm.transportation} 
        onDistanceChange={(newDistance) => {
          setDistance(newDistance);
          setShowResults(false);
        }}
        showResults={showResults}
      />
      <div className="calculate-button-container">
        <button
          type="button"
          onClick={() => setShowResults(true)}
        >
          Calculate Feasibility
        </button>
      </div>

      {showResults && !hasInvalidInput && (
        <>
          <h2>Trip Feasibility Results</h2>
          <p>Transportation: ${transportationTotal}</p>
          <p>Lodging: ${lodgingTotal}</p>
          <p>Total Estimated Cost: ${estimatedTotal}</p>
          <p>Estimated Travel Time: {estimatedTravelTime} hours</p>
          <p>
            <strong>Feasible:</strong>{" "}
            {estimatedTotal <= Number(tripForm.budget) ? "Yes" : "No"}
          </p>
        </>
      )}

      <ScenarioComparison
        tripForm={tripForm}
        estimatedTotal={estimatedTotal}
        estimatedTravelTime={estimatedTravelTime}
        showResults={showResults}
        hasInvalidInput={hasInvalidInput}
      />

    </main>
  )
}

export default App