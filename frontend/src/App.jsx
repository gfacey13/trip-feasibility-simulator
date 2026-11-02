import { useEffect, useState } from 'react'
import './App.css'
import TravelTime from "./TravelTime";
import TripInputForm from "./TripInputForm";
import ScenarioComparison from "./ScenarioComparison";
import FeasibilityAnalysis from "./FeasibilityAnalysis";
import WeatherDelayChecker from "./WeatherDelayChecker";
import TripSummary from "./TripSummary";

import UserDashboard from "./UserDashboard";
import { evaluateFeasibility } from "./services/evaluateFeasibility";

import AccountPanel from "./AccountPanel";
import { supabase } from "./services/supabaseClient";

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!supabase);
   useEffect(() => {
  if (!supabase) return;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
    setAuthReady(true);
  });

  return () => data.subscription.unsubscribe();
}, []);

  // Read a validated device snapshot; malformed storage must not break the page.
  const [savedScenario, setSavedScenario] = useState(null);

  const [transportationCost, setTransportationCost] = useState("");
  const [lodgingCost, setLodgingCost] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [distance, setDistance] = useState("");
  // Keep the limit user-defined rather than assuming every trip must be under 8 hours.
  const [maxTravelTime, setMaxTravelTime] = useState("");
  // The weather component reports its request state to the main assessment.
  const [weather, setWeather] = useState(null);
  const [assessmentId, setAssessmentId] = useState(0);

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
    maxTravelTime === "" ||
    !Number.isFinite(Number(maxTravelTime)) ||
    Number(maxTravelTime) <= 0 ||
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


  // Both result displays receive the same assessment, including request state.
  // Compare the unrounded time to the limit; rounding is for display only.
  const analysis = evaluateFeasibility({
    estimatedTotal,
    budget: Number(tripForm.budget),
    travelTime: Number(distance) / speeds[tripForm.transportation],
    maxTravelTime: Number(maxTravelTime),
    weather,
  });

  return (
    <main>
      <h1>Trip Feasibility Simulator</h1>
         {authReady ? (
  <AccountPanel user={user} />
) : (
  <p role="status">Checking your account…</p>
)}

{authReady && (
    user ? (
      <UserDashboard
        key={savedScenario?.savedAt || "saved-trip"}
        savedTrip={savedScenario}
      />
    ) : (
      <section className="user-dashboard">
        <h2>Your Dashboard</h2>
        <p>Please log in to view your saved trips.</p>
      </section>
    )
  )}

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
            Please complete all required trip details, valid costs, and a positive travel-time limit.
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
      <div className="travel-limit form-group">
        <label htmlFor="maxTravelTime">Maximum Travel Time (hours)</label>
        <input
          id="maxTravelTime"
          type="number"
          min="0.1"
          step="any"
          placeholder="Enter your travel-time limit"
          value={maxTravelTime}
          onChange={(event) => {
            setMaxTravelTime(event.target.value);
            setShowResults(false);
          }}
        />
        <small>Applies to the same journey as the distance entered above.</small>
      </div>
      <div className="calculate-button-container">
        <button
          type="button"
          onClick={() => {
            // Discard any previous forecast before starting a new assessment.
            setWeather(null);
            setAssessmentId((current) => current + 1);
            setShowResults(true);
          }}
        >
          Calculate Feasibility
        </button>
      </div>

      {showResults && !hasInvalidInput && (
        <>
          <h2>Trip Feasibility Results</h2>
          <p>Transportation: ${transportationTotal}</p>
          <p>Lodging: ${lodgingTotal}</p>

          <FeasibilityAnalysis
            analysis={analysis}
            estimatedTotal={estimatedTotal}
            travelTime={Number(distance) / speeds[tripForm.transportation]}
            maxTravelTime={Number(maxTravelTime)}
            weather={weather}
            budget={Number(tripForm.budget)}
          />

          <WeatherDelayChecker
            key={assessmentId}
            destination={tripForm.destination}
            startDate={tripForm.startDate}
            onForecastChange={setWeather}
            endDate={tripForm.endDate}
          />
        </>
      )}
      {showResults && !hasInvalidInput && (
      <TripSummary
       tripForm={tripForm}
       transportationTotal={transportationTotal}
       lodgingTotal={lodgingTotal}
       estimatedTotal={estimatedTotal}
       estimatedTravelTime={estimatedTravelTime}
       analysis={analysis}
       weather={weather}
       maxTravelTime={Number(maxTravelTime)}
       />
      )}
      <ScenarioComparison
        user={user}
        calculationId={assessmentId}
        tripForm={tripForm}
        estimatedTotal={estimatedTotal}
        estimatedTravelTime={estimatedTravelTime}
        showResults={showResults}
        hasInvalidInput={hasInvalidInput}
        savedScenario={savedScenario}
        onSavedScenarioChange={setSavedScenario}
      />

    </main>
  )
}

export default App