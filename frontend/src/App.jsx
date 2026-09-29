import { useState} from 'react'
import './App.css'
import TripInputForm from "./TripInputForm";


function App() {
  const [travelers, setTravelers] = useState("");
  const [transportationCost, setTransportationCost] = useState("");
  const [nights, setNights] = useState("");
  const [lodgingCost, setLodgingCost] = useState("");

  const hasInvalidInput = 
    travelers === "" || 
    transportationCost === "" || 
    nights === "" || 
    lodgingCost === "" || 
    Number(travelers) < 1 || 
    Number(nights) < 1 || 
    Number(transportationCost) < 0 || 
    Number(lodgingCost) < 0;   

  const allFieldsFilled =
    travelers !== "" &&
    transportationCost !== "" &&
    nights !== "" &&
    lodgingCost !== ""

  const transportationTotal = hasInvalidInput
    ? 0
    : Number(travelers) * Number(transportationCost);

  const lodgingTotal = hasInvalidInput
    ? 0
    : Number(nights) * Number(lodgingCost);

  const estimatedTotal = transportationTotal + lodgingTotal;


  return (
    <main>
      <h1>Trip Feasibility Simulator</h1>

      <TripInputForm />
      
      <p>Enter your trip details to estimate transportation and lodging costs.</p>

      <label htmlFor="travelers">Number of Travelers</label> 
      <input
        id="travelers"
        type="number"
        min="1"
        placeholder="Enter number of travelers"
        value={travelers}
        onChange={(event) => setTravelers(event.target.value)}
      />
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
    </main>
  )
}

export default App