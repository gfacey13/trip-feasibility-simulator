import { useState} from 'react'
import './App.css'
import TravelTime from "./TravelTime";
import TripInputForm from "./TripInputForm";
import TravelTime from "./TravelTime";

function App() {

  const [transportationCost, setTransportationCost] = useState("");
  const [nights, setNights] = useState("");
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

  const hasInvalidInput = 
    tripForm.travelers === "" || 
    transportationCost === "" || 
    nights === "" || 
    lodgingCost === "" || 
    Number(tripForm.travelers) < 1 || 
    Number(nights) < 1 || 
    Number(transportationCost) < 0 || 
    Number(lodgingCost) < 0;   

  const allFieldsFilled =
    tripForm.travelers !== "" &&
    transportationCost !== "" &&
    nights !== "" &&
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

      <label htmlFor="transportationCost">Transportation Cost Per Traveler</label>
      <input
        id="transportationCost"
        type="number"
        min="0"
        placeholder="Enter transportation cost"
        value={transportationCost}
        onChange={(event) => setTransportationCost(event.target.value)}
      />
      <label htmlFor="nights">Number of Nights</label>
      <input
        id="nights"
        type="number"
        min="1"
        placeholder="Enter number of nights"
        value={nights}
        onChange={(event) => setNights(event.target.value)}
      />
      <label htmlFor="lodgingCost">Lodging Cost Per Night</label>
      <input
        id="lodgingCost"
        type="number"
        min="0"
        placeholder="Enter lodging cost per night"
        value={lodgingCost}
        onChange={(event) => setLodgingCost(event.target.value)}
      />
      {allFieldsFilled && hasInvalidInput && (
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

      <TravelTime transportation={tripForm.transportation} />

    </main>
  )
}

export default App