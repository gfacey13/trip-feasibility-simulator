import { formatMoney } from "./services/formatMoney";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import TravelTime from "./TravelTime";
import TripInputForm from "./TripInputForm";
import ScenarioComparison from "./ScenarioComparison";
import FeasibilityAnalysis from "./FeasibilityAnalysis";
import WeatherDelayChecker from "./WeatherDelayChecker";
import TripSummary from "./TripSummary";
import HotelPricing from "./HotelPricing";
import { countRoomTravelers, roomsForTravelers } from "./services/hotelRooms";
import UserDashboard from "./UserDashboard";
import AccountPanel from "./AccountPanel";
import { evaluateFeasibility } from "./services/evaluateFeasibility";
import { useSavedTrip } from "./services/useSavedTrip";
import { supabase } from "./services/supabaseClient";

const speeds = {
  car: 60,
  bus: 45,
  train: 80,
  plane: 500,
};

function validNumber(value, minimum) {
  return (
    value != null &&
    String(value).trim() !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= minimum
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [editingScenario, setEditingScenario] = useState(null);
  const currentUserId = useRef(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const {
    savedScenario, savedTrips, loading: tripLoading, error: tripError,
    retryLoad, saveTrip, deleteTrip,
  } = useSavedTrip(user);

  const [transportationCost, setTransportationCost] = useState("");
  const [lodgingCost, setLodgingCost] = useState("");
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [hotelRooms, setHotelRooms] = useState(() => roomsForTravelers(""));
  const [showResults, setShowResults] = useState(false);
  const [distance, setDistance] = useState("");
  const [maxTravelTime, setMaxTravelTime] = useState("");
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

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      const nextId = nextUser?.id ?? null;
      if (currentUserId.current !== nextId) {
        currentUserId.current = nextId;
        setEditingScenario(null);
      }
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const hasDates = Boolean(tripForm.startDate && tripForm.endDate);
  const startTime = Date.parse(`${tripForm.startDate}T00:00:00Z`);
  const endTime = Date.parse(`${tripForm.endDate}T00:00:00Z`);

  const invalidDates =
    hasDates &&
    (!Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime <= startTime);

  const nights =
    hasDates && !invalidDates
      ? Math.round((endTime - startTime) / 86400000)
      : 0;

  const hasInvalidInput =
    !validNumber(maxTravelTime, 0) ||
    Number(maxTravelTime) <= 0 ||
    !validNumber(distance, 0) ||
    Number(distance) <= 0 ||
    !validNumber(tripForm.travelers, 1) ||
    !Number.isInteger(Number(tripForm.travelers)) ||
    tripForm.origin.trim() === "" ||
    tripForm.destination.trim() === "" ||
    !hasDates ||
    invalidDates ||
    nights < 1 ||
    !validNumber(tripForm.budget, 0) ||
    Number(tripForm.budget) <= 0 ||
    !speeds[tripForm.transportation] ||
    !validNumber(transportationCost, 0) ||
    (!selectedHotel && !validNumber(lodgingCost, 0));

  const transportationTotal = hasInvalidInput
    ? 0
    : Number(tripForm.travelers) * Number(transportationCost);

  // Selected hotel prices already cover the whole stay.
  const lodgingTotal = hasInvalidInput
    ? 0
    : selectedHotel
      ? selectedHotel.total
      : nights * Number(lodgingCost);

  const estimatedTotal = transportationTotal + lodgingTotal;

  const travelTime = speeds[tripForm.transportation]
    ? Number(distance) / speeds[tripForm.transportation]
    : null;

  const estimatedTravelTime =
    Number.isFinite(travelTime) && travelTime > 0
      ? travelTime.toFixed(1)
      : null;

  const analysis = evaluateFeasibility({
    estimatedTotal,
    budget: Number(tripForm.budget),
    travelTime,
    maxTravelTime: Number(maxTravelTime),
    weather,
  });

  function selectHotel(hotel) {
    setSelectedHotel(hotel);
    setShowResults(false);
  }

  const costDescription = selectedHotel
    ? "Transportation uses your entered price. Lodging uses a LiteAPI sandbox whole-stay estimate, including reported additional fees."
    : "Estimated costs use the transportation and lodging prices you entered.";

  return (
    <main id="main-content">
      <a className="skip-link" href="#plan-trip">Skip to trip planner</a>
      <nav className="site-nav" aria-label="Main navigation">
        <a className="brand" href="#main-content"><span className="brand-mark" aria-hidden="true">T</span> Trip Feasibility</a>
        <div className="nav-links">
          <a href="#plan-trip">Plan a trip</a>
          <a href="#saved-trips">Saved trips</a>
          <a href="#scenario-comparison">Scenarios</a>
          <a href="#traveler-account">Account</a>
        </div>
      </nav>
      <header className="hero">
        <div>
          <p className="eyebrow">A little planning. A clearer journey.</p>
          <h1>Trip Feasibility Simulator</h1>
          <p>Bring your budget, travel time, and destination weather together. Explore your options before you go.</p>
        </div>
        <aside className="hero-note" aria-label="How it works">
          <strong>Your next trip, in perspective.</strong>
          <p>Plan a route. Compare the costs. Save the option that works for you.</p>
        </aside>
      </header>

      {authReady ? (
        <AccountPanel key={`account-${user?.id ?? "guest"}`} user={user} />
      ) : (
        <p role="status">Checking your account...</p>
      )}

      <div id="saved-trips">
      {authReady && (
        user ? (
          <>
            {tripError && (
              <p className="error-message" role="alert">
                {tripError} <button type="button" onClick={retryLoad}>Retry</button>
              </p>
            )}

            {tripLoading ? (
              <p role="status">Loading your saved trip...</p>
            ) : tripError ? null : (
              <UserDashboard
                accountSaved
                key={`dashboard-${user.id}`}
                savedTrips={savedTrips}
                onDeleteTrip={async (id) => {
                  await deleteTrip(id);
                  setEditingScenario((current) => current?.scenario.persistedId === id ? null : current);
                }}
                onEditTrip={(scenario) => {
                  setEditingScenario({ ownerId: user.id, requestId: crypto.randomUUID(), scenario });
                  const editor = document.getElementById("scenario-comparison");
                  editor?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                  editor?.focus({ preventScroll: true });
                }}
              />
            )}
          </>
        ) : (
          <section className="user-dashboard">
            <h2>Your Dashboard</h2>
            <p>Please log in to view your saved trips.</p>
          </section>
        )
      )}

      </div>
      <section id="plan-trip" className="panel" aria-labelledby="trip-input-heading">
      <p className="section-label">01 / Build your trip</p>
      <TripInputForm
        showErrors={showResults}
        form={tripForm}
        onFormChange={(updatedForm) => {
          if (updatedForm.travelers !== tripForm.travelers) {
            setHotelRooms(roomsForTravelers(updatedForm.travelers));
          }
          setTripForm(updatedForm);
          setSelectedHotel(null);
          setShowResults(false);
          setWeather(null);
        }}
      />

      <div className="section-divider">
        <p className="section-label">02 / Set your costs</p>
        <h3>Transportation &amp; lodging</h3>
        <p className="section-intro">Enter your own prices, or explore optional hotel test pricing below. All costs are in USD.</p>
      </div>

      <div className="cost-inputs">
        <div className="form-group">
          <label htmlFor="transportationCost">
            Transportation Cost Per Traveler
          </label>
          <input
            aria-invalid={showResults && !validNumber(transportationCost, 0)}
            aria-describedby={showResults && !validNumber(transportationCost, 0) ? "transportation-cost-error" : undefined}
            id="transportationCost"
            type="number"
            min="0"
            step="any"
            placeholder="Enter transportation cost"
            value={transportationCost}
            onChange={(event) => {
              setTransportationCost(event.target.value);
              setShowResults(false);
            }}
          />
          {showResults && !validNumber(transportationCost, 0) && <small id="transportation-cost-error" className="field-error">Enter a transportation price of zero or more per traveler.</small>}
        </div>

        <div className="form-group">
          <span id="nights-label">Number of Nights</span>
          <output aria-labelledby="nights-label" className="calculated-value">
            {nights || "Calculated from dates"}
          </output>
        </div>

        <div className="form-group">
          <label htmlFor="lodgingCost">Manual Lodging Cost Per Night</label>
          <input
            aria-invalid={showResults && !selectedHotel && !validNumber(lodgingCost, 0)}
            aria-describedby="lodging-help"
            id="lodgingCost"
            type="number"
            min="0"
            step="any"
            placeholder="Enter total lodging cost per night"
            value={lodgingCost}
            disabled={Boolean(selectedHotel)}
            onChange={(event) => {
              setLodgingCost(event.target.value);
              setShowResults(false);
            }}
          />
          <small id="lodging-help">
            Include all rooms and estimated taxes or fees. If a hotel is
            selected, choose Use Manual Lodging to edit this amount.
          </small>
        </div>
      </div>

      <HotelPricing
        key={JSON.stringify({ destination: tripForm.destination, country: tripForm.destinationCity?.countryCode, startDate: tripForm.startDate, endDate: tripForm.endDate })}
        tripForm={tripForm}
        selectedHotel={selectedHotel}
        rooms={hotelRooms}
        onRoomsChange={(nextRooms) => {
          setHotelRooms(nextRooms);
          const travelers = countRoomTravelers(nextRooms);
          if (travelers !== null) {
            setTripForm((current) => ({ ...current, travelers: String(travelers) }));
          }
          setSelectedHotel(null);
          setShowResults(false);
          setWeather(null);
        }}
        onSelect={selectHotel}
      />

      {showResults && hasInvalidInput && !invalidDates && (
        <p className="error-message" role="alert">
          Complete the trip details, valid costs, distance, and a positive
          travel-time limit. Enter manual lodging or select a hotel.
        </p>
      )}

      {invalidDates && (
        <p className="error-message" role="alert">End date must be after start date.</p>
      )}

      <div className="section-divider">
        <p className="section-label">03 / Check your journey</p>
        <h3>Distance &amp; travel limits</h3>
        <p className="section-intro">Use the distance for the journey you are assessing, then set the longest travel time you would accept.</p>
      </div>
      <div className="travel-fields">
      <TravelTime
        showErrors={showResults}
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
          aria-invalid={showResults && (!validNumber(maxTravelTime, 0) || Number(maxTravelTime) <= 0)}
          aria-describedby="travel-limit-help"
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
        <small id="travel-limit-help">
          Enter a limit greater than zero. Applies to the same journey as the distance entered above.
        </small>
      </div>

      </div>
      <div className="calculate-button-container">
        <p>Ready? Review your costs, travel time, and destination forecast.</p>
        <button
          type="button"
          className="primary"
          onClick={() => {
            setWeather(null);
            setEditingScenario(null);
            setAssessmentId((current) => current + 1);
            setShowResults(true);
            if (hasInvalidInput) {
              const invalidField = [
                ["origin", tripForm.origin.trim() !== ""],
                ["destination", tripForm.destination.trim() !== ""],
                ["startDate", Boolean(tripForm.startDate) && Number.isFinite(startTime)],
                ["endDate", hasDates && !invalidDates],
                ["budget", validNumber(tripForm.budget, 0) && Number(tripForm.budget) > 0],
                ["travelers", validNumber(tripForm.travelers, 1) && Number.isInteger(Number(tripForm.travelers))],
                ["transportation", Boolean(speeds[tripForm.transportation])],
                ["transportationCost", validNumber(transportationCost, 0)],
                ["lodgingCost", Boolean(selectedHotel) || validNumber(lodgingCost, 0)],
                ["distance", validNumber(distance, 0) && Number(distance) > 0],
                ["maxTravelTime", validNumber(maxTravelTime, 0) && Number(maxTravelTime) > 0],
              ].find(([, valid]) => !valid)?.[0];
              document.getElementById(invalidField)?.focus();
            }
          }}
        >
          Calculate Feasibility
        </button>
      </div>

      </section>
      {showResults && !hasInvalidInput && (
        <section className="results-panel" aria-labelledby="trip-results-heading">
          <p className="section-label">Your trip, at a glance</p>
          <h2 id="trip-results-heading">Trip Feasibility Results</h2>
          <p>{costDescription}</p>
          <p>Transportation: {formatMoney(transportationTotal)}</p>
          <p>Lodging: {formatMoney(lodgingTotal)}</p>

          {selectedHotel && (
            <p>
              Hotel: {selectedHotel.hotelName} — sandbox test price,
              not a booking quote.
            </p>
          )}

          <FeasibilityAnalysis
            analysis={analysis}
            estimatedTotal={estimatedTotal}
            travelTime={travelTime}
            maxTravelTime={Number(maxTravelTime)}
            weather={weather}
            budget={Number(tripForm.budget)}
          />

          <WeatherDelayChecker
            key={assessmentId}
            destination={tripForm.destination}
            startDate={tripForm.startDate}
            endDate={tripForm.endDate}
            onForecastChange={setWeather}
          />

          <TripSummary
            tripForm={tripForm}
            transportationTotal={transportationTotal}
            lodgingTotal={lodgingTotal}
            estimatedTotal={estimatedTotal}
            estimatedTravelTime={estimatedTravelTime}
            analysis={analysis}
            weather={weather}
            maxTravelTime={Number(maxTravelTime)}
            selectedHotel={selectedHotel}
          />
        </section>
      )}

      <ScenarioComparison
        key={`scenarios-${user?.id ?? "guest"}`}
        user={user}
        calculationId={assessmentId}
        tripForm={tripForm}
        estimatedTotal={estimatedTotal}
        estimatedTravelTime={estimatedTravelTime}
        showResults={showResults}
        hasInvalidInput={hasInvalidInput}
        savedScenario={savedScenario}
        editingScenario={editingScenario?.ownerId === user?.id ? editingScenario : null}
        tripBusy={!authReady || tripLoading || Boolean(tripError)}
        onSaveTrip={saveTrip}
        onDeleteTrip={deleteTrip}
        reportContext={{
          tripForm, transportationTotal, lodgingTotal, estimatedTotal,
          estimatedTravelTime, maxTravelTime, analysis, weather,
        }}
        selectedHotel={selectedHotel}
      />
      <footer className="site-footer">Plan with estimates, travel with perspective. Hotel prices are sandbox test estimates; live transportation delays are not included.</footer>
    </main>
  );
}

export default App;