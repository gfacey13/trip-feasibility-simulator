import { useEffect, useRef, useState } from "react";
import "./App.css";
import TravelTime from "./TravelTime";
import TripInputForm from "./TripInputForm";
import ScenarioComparison from "./ScenarioComparison";
import FeasibilityAnalysis from "./FeasibilityAnalysis";
import WeatherDelayChecker from "./WeatherDelayChecker";
import TripSummary from "./TripSummary";
import HotelPricing from "./HotelPricing";
import UserDashboard from "./UserDashboard";
import AccountPanel from "./AccountPanel";
import { evaluateFeasibility } from "./services/evaluateFeasibility";
import { readSavedTrip } from "./services/savedTripStorage";
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
  const [authReady, setAuthReady] = useState(!supabase);
  const [savedScenario, setSavedScenario] = useState(null);
  const [tripError, setTripError] = useState("");
  const [tripLoading, setTripLoading] = useState(false);
  const [tripBusy, setTripBusy] = useState(false);

  const currentUserId = useRef(null);
  const requestVersion = useRef(0);
  const mutationBusy = useRef(false);

  const [transportationCost, setTransportationCost] = useState("");
  const [lodgingCost, setLodgingCost] = useState("");
  const [selectedHotel, setSelectedHotel] = useState(null);
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
        requestVersion.current += 1;
        mutationBusy.current = false;

        setSavedScenario(null);
        setTripError("");
        setTripBusy(false);
        setTripLoading(Boolean(nextId));
      }

      setUser(nextUser);
      setAuthReady(true);
    });

    return () => {
      requestVersion.current += 1;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!supabase || !userId) return;

    let active = true;
    const version = ++requestVersion.current;

    async function loadPreferredTrip() {
      try {
        const { data, error } = await supabase
          .from("preferred_trips")
          .select("scenario")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;

        let trip = null;

        if (data) {
          trip = readSavedTrip({
            getItem: () => JSON.stringify(data.scenario),
          });

          if (!trip) {
            throw new Error("Invalid saved trip.");
          }
        }

        if (
          active &&
          version === requestVersion.current &&
          currentUserId.current === userId
        ) {
          setSavedScenario(trip);
        }
      } catch {
        if (
          active &&
          version === requestVersion.current &&
          currentUserId.current === userId
        ) {
          setTripError(
            "Your saved trip could not be loaded. Refresh the page to try again."
          );
        }
      } finally {
        if (
          active &&
          version === requestVersion.current &&
          currentUserId.current === userId
        ) {
          setTripLoading(false);
        }
      }
    }

    loadPreferredTrip();

    return () => {
      active = false;
    };
  }, [userId]);

  async function changePreferredTrip(nextTrip) {
    const ownerId = user?.id;

    if (!supabase || !ownerId || currentUserId.current !== ownerId) {
      throw new Error("Please log in to manage your saved trip.");
    }

    if (tripLoading || mutationBusy.current) {
      throw new Error("Please wait for the current trip request to finish.");
    }

    let validatedTrip = null;

    if (nextTrip !== null) {
      validatedTrip = readSavedTrip({
        getItem: () => JSON.stringify(nextTrip),
      });

      if (!validatedTrip) {
        throw new Error("Enter valid trip details before saving.");
      }
    }

    mutationBusy.current = true;
    setTripBusy(true);
    setTripError("");
    const version = ++requestVersion.current;

    try {
      const { data: account, error: accountError } =
        await supabase.auth.getUser();

      if (
        accountError ||
        account.user?.id !== ownerId ||
        currentUserId.current !== ownerId ||
        version !== requestVersion.current
      ) {
        throw new Error("Your account changed. Please try again.");
      }

      if (validatedTrip === null) {
        const { error } = await supabase
          .from("preferred_trips")
          .delete()
          .eq("user_id", ownerId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("preferred_trips")
          .upsert(
            { user_id: ownerId, scenario: validatedTrip },
            { onConflict: "user_id" }
          );

        if (error) throw error;
      }

      // Ignore responses belonging to an earlier account or request.
      if (
        version === requestVersion.current &&
        currentUserId.current === ownerId
      ) {
        setSavedScenario(validatedTrip);
      }
    } finally {
      if (version === requestVersion.current) {
        mutationBusy.current = false;
        setTripBusy(false);
      }
    }
  }

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
    <main>
      <h1>Trip Feasibility Simulator</h1>

      {authReady ? (
        <AccountPanel user={user} />
      ) : (
        <p role="status">Checking your account...</p>
      )}

      {authReady && (
        user ? (
          <>
            {tripError && (
              <p className="error-message" role="alert">
                {tripError}
              </p>
            )}

            {tripLoading ? (
              <p role="status">Loading your saved trip...</p>
            ) : tripError ? null : (
              <UserDashboard
                key={`${user.id}-${savedScenario?.savedAt || "empty"}`}
                savedTrip={savedScenario}
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

      <TripInputForm
        onFormChange={(updatedForm) => {
          setTripForm(updatedForm);
          setSelectedHotel(null);
          setShowResults(false);
          setWeather(null);
        }}
      />

      <p>
        Enter transportation and manual lodging costs, or select a hotel test
        price below.
      </p>

      <div className="cost-inputs">
        <div className="form-group">
          <label htmlFor="transportationCost">
            Transportation Cost Per Traveler
          </label>
          <input
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
        </div>

        <div className="form-group">
          <p>Number of Nights</p>
          <p className="calculated-value">
            {nights || "Calculated from dates"}
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="lodgingCost">Manual Lodging Cost Per Night</label>
          <input
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
          <small>
            Include all rooms and estimated taxes or fees. If a hotel is
            selected, choose Use Manual Lodging to edit this amount.
          </small>
        </div>
      </div>

      <HotelPricing
        key={JSON.stringify(tripForm)}
        tripForm={tripForm}
        selectedHotel={selectedHotel}
        onSelect={selectHotel}
      />

      {showResults && hasInvalidInput && !invalidDates && (
        <p className="error-message">
          Complete the trip details, valid costs, distance, and a positive
          travel-time limit. Enter manual lodging or select a hotel.
        </p>
      )}

      {invalidDates && (
        <p className="error-message">End date must be after start date.</p>
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
        <small>
          Applies to the same journey as the distance entered above.
        </small>
      </div>

      <div className="calculate-button-container">
        <button
          type="button"
          onClick={() => {
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
          <p>{costDescription}</p>
          <p>Transportation: ${transportationTotal.toFixed(2)}</p>
          <p>Lodging: ${lodgingTotal.toFixed(2)}</p>

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
        </>
      )}

      <ScenarioComparison
        key={user?.id || "guest"}
        user={user}
        calculationId={assessmentId}
        tripForm={tripForm}
        estimatedTotal={estimatedTotal}
        estimatedTravelTime={estimatedTravelTime}
        showResults={showResults}
        hasInvalidInput={hasInvalidInput}
        savedScenario={savedScenario}
        tripBusy={tripBusy || tripLoading}
        onSavedScenarioChange={changePreferredTrip}
        selectedHotel={selectedHotel}
      />
    </main>
  );
}

export default App;