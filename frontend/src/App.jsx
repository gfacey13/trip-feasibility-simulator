import { useState } from 'react'
import './App.css'
import TravelTime from "./TravelTime";
import TripInputForm from "./TripInputForm";


function App() {

  const [transportationCost, setTransportationCost] = useState("");
  const [lodgingCost, setLodgingCost] = useState("");

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
    tripForm.travelers === "" ||
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


  return (
    <main>
      <h1>Trip Feasibility Simulator</h1>

      <TripInputForm onFormChange={setTripForm} />
      
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
            onChange={(event) => setTransportationCost(event.target.value)}
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
            onChange={(event) => setLodgingCost(event.target.value)}
          />
        </div>
      </div>
      {allFieldsFilled && hasInvalidInput && !invalidDates && (
        <p className ="error-message">
          Please enter valid trip cost information.</p>
      )}
      
      {!hasInvalidInput && ( 
        <>
          <h2>Estimated Cost</h2>
          <p>Transportation: ${transportationTotal}</p>
          <p>Lodging: ${lodgingTotal}</p>
          <p>Total Estimated Cost: ${estimatedTotal}</p>
        </>
      )}

      {invalidDates && (
        <p className="error-message">
          End date must be after start date.
        </p>
      )}

      <TravelTime transportation={tripForm.transportation} />

    </main>
  )
}

export default App