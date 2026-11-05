import { useEffect, useRef, useState } from "react";
import { getHotelRates } from "./services/hotelService";

function HotelPricing({ tripForm, selectedHotel, onSelect }) {
  const [countryCode, setCountryCode] = useState("");
  const [guestNationality, setGuestNationality] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [rates, setRates] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const activeRequest = useRef(null);

  useEffect(() => {
    return () => {
      activeRequest.current?.abort();
    };
  }, []);

  function clearSearch() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setRates([]);
    setStatus("idle");
    setError("");
    onSelect(null);
  }

  async function searchHotels() {
    clearSearch();

    const travelers = Number(tripForm.travelers);

    if (
      !tripForm.destination.trim() ||
      !tripForm.startDate ||
      !tripForm.endDate ||
      tripForm.endDate <= tripForm.startDate ||
      !Number.isInteger(travelers) ||
      travelers < 1 ||
      travelers > 8
    ) {
      setError(
        "Enter a destination city, valid stay dates, and 1–8 travelers first."
      );
      return;
    }

    if (
      !/^[A-Z]{2}$/.test(countryCode) ||
      !/^[A-Z]{2}$/.test(guestNationality) ||
      !confirmed
    ) {
      setError(
        "Enter both two-letter country codes and confirm the room arrangement."
      );
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setStatus("loading");

    try {
      const result = await getHotelRates(
        {
          ...tripForm,
          countryCode,
          guestNationality,
          hotelSingleRoomAdults: confirmed,
        },
        controller.signal
      );

      if (
        controller.signal.aborted ||
        activeRequest.current !== controller
      ) {
        return;
      }

      setRates(result.rates);
      setStatus("success");
    } catch (requestError) {
      if (
        controller.signal.aborted ||
        activeRequest.current !== controller
      ) {
        return;
      }

      setError(requestError.message);
      setStatus("error");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  }

  return (
    <section className="hotel-pricing" aria-labelledby="hotel-pricing-heading">
      <h2 id="hotel-pricing-heading">Hotel Test Pricing — Optional</h2>

      <p>
        Search LiteAPI sandbox prices for one room. These are test estimates,
        not booking quotes. Transportation remains user-entered.
      </p>

      <p>
        Use a city name in Destination. For children or multiple rooms,
        enter the combined lodging cost per night manually.
      </p>

      <div className="form-group">
        <label htmlFor="hotelCountry">Destination Country Code</label>
        <input
          id="hotelCountry"
          value={countryCode}
          maxLength={2}
          placeholder="Example: US"
          onChange={(event) => {
            clearSearch();
            setCountryCode(event.target.value.trim().toUpperCase());
          }}
        />
      </div>

      <div className="form-group">
        <label htmlFor="guestNationality">Guest Nationality Code</label>
        <input
          id="guestNationality"
          value={guestNationality}
          maxLength={2}
          placeholder="Example: US"
          onChange={(event) => {
            clearSearch();
            setGuestNationality(event.target.value.trim().toUpperCase());
          }}
        />
        <small>
          Enter two-letter country codes, such as US, GB, or CA.
          If travelers need different nationality pricing, use manual lodging.
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="hotelSingleRoomAdults">
          <input
            id="hotelSingleRoomAdults"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => {
              clearSearch();
              setConfirmed(event.target.checked);
            }}
          />
          All travelers are adults sharing one room and use the nationality
          entered above.
        </label>
      </div>

      <button
        type="button"
        disabled={status === "loading"}
        onClick={searchHotels}
      >
        {status === "loading" ? "Searching hotels..." : "Search Hotel Test Prices"}
      </button>

      <button type="button" onClick={clearSearch}>
        Use Manual Lodging
      </button>

      <div aria-live="polite">
        {error && <p className="error-message">{error}</p>}

        {status === "success" && (
          <>
            <p>
              Select a hotel to use its total for the entire stay.
              Reported additional fees are included below.
            </p>

            <ul>
              {rates.map((rate, index) => (
                <li key={`${rate.hotelName}-${index}`}>
                  <p>
                    <strong>{rate.hotelName}</strong>
                    {" — "}${rate.total.toFixed(2)} USD for the whole stay
                    {" "}(${rate.additionalFees.toFixed(2)} in additional fees)
                  </p>
                  <button
                    type="button"
                    aria-pressed={selectedHotel === rate}
                    onClick={() => onSelect(rate)}
                  >
                    {selectedHotel === rate ? "Selected" : "Use This Hotel"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {selectedHotel && (
          <p>
            Using {selectedHotel.hotelName}: $
            {selectedHotel.total.toFixed(2)} USD.
            Manual lodging is saved but is not used while this hotel is selected.
          </p>
        )}
      </div>
    </section>
  );
}

export default HotelPricing;