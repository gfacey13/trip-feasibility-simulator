import { useEffect, useRef, useState } from "react";
import "./App.css";
import TravelTime from "./TravelTime";
import TripInputForm from "./TripInputForm";
import ScenarioComparison from "./ScenarioComparison";
import FeasibilityAnalysis from "./FeasibilityAnalysis";
import WeatherDelayChecker from "./WeatherDelayChecker";
import TripSummary from "./TripSummary";
import UserDashboard from "./UserDashboard";
import AccountPanel from "./AccountPanel";
import { evaluateFeasibility } from "./services/evaluateFeasibility";
import { readSavedTrip } from "./services/savedTripStorage";
import { supabase } from "./services/supabaseClient";

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
          // Reuse the existing validator for the account's saved snapshot.
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

      // A response from an old account must not update the current screen.
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

  const invalidDates =
    tripForm.startDate &&
    tripForm.endDate &&
    new Date(`${tripForm.endDate}T00:00:00`) <=
      new Date(`${tripForm.startDate}T00:00:00`);

  const nights =
    tripForm.startDate && tripForm.endDate && !invalidDates
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
          <>
            {tripError && (
              <p className="error-message" role="alert">
                {tripError}
              </p>
            )}

            {tripLoading ? (
              <p role="status">Loading your saved trip…</p>
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
          <label htmlFor="lodgingCost">Lodging Cost Per Night</label>
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
        <p className="error-message">
          Please complete all required trip details, valid costs, and a
          positive travel-time limit.
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
        <label htmlFor="maxTravelTime">
          Maximum Travel Time (hours)
        </label>
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
      />
    </main>
  );
}

export default App;