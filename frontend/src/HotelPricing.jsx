import { formatMoney } from "./services/formatMoney";
import { useEffect, useRef, useState } from "react";
import { getHotelRates } from "./services/hotelService";
import { validRoomOccupancies } from "./services/hotelRooms";
import HotelRoomBreakdown from "./HotelRoomBreakdown";

function HotelPricing({ tripForm, selectedHotel, onSelect, rooms, onRoomsChange }) {
  const [countryCode, setCountryCode] = useState(tripForm.destinationCity?.countryCode ?? "");
  const [guestNationality, setGuestNationality] = useState("");
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

  function changeRoom(index, update) {
    clearSearch();
    onRoomsChange(
      rooms.map((room, roomIndex) =>
        roomIndex === index ? update(room) : room,
      ),
    );
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
      travelers < 1
    ) {
      setError(
        "Enter a destination city, valid stay dates, and a positive whole-number traveler count first.",
      );
      return;
    }

    if (
      !/^[A-Z]{2}$/.test(countryCode) ||
      !/^[A-Z]{2}$/.test(guestNationality)
    ) {
      setError("Enter both two-letter country codes.");
      return;
    }

    if (
      rooms.some(
        (room) =>
          room.adults.trim() === "" ||
          room.children.some((age) => age.trim() === ""),
      )
    ) {
      setError("Enter the adult count and an age for every child.");
      return;
    }
    const occupancies = rooms.map((room) => ({
      adults: Number(room.adults),
      children: room.children.map(Number),
    }));
    const assigned = occupancies.reduce(
      (sum, room) => sum + room.adults + room.children.length,
      0,
    );
    if (!validRoomOccupancies(occupancies) || assigned !== travelers) {
      setError(
        `Assign all ${travelers} travelers across the rooms. Each room needs an adult, supports up to 8 guests, and children's ages must be 0–17.`,
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
          occupancies,
        },
        controller.signal,
      );

      if (controller.signal.aborted || activeRequest.current !== controller) {
        return;
      }

      setRates(result.rates);
      setStatus("success");
    } catch (requestError) {
      if (controller.signal.aborted || activeRequest.current !== controller) {
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
    <details className="hotel-options">
      <summary>Hotel test pricing <small>Optional / explore room prices</small></summary>
      <section className="hotel-pricing" aria-labelledby="hotel-pricing-heading">
      <h3 id="hotel-pricing-heading">Hotel Test Pricing — Optional</h3>

      <p>
        Search LiteAPI sandbox prices for your room arrangement. Prices are test
        estimates. Transportation remains user-entered.
      </p>

      <p>
        Use a city name such as Boston in Destination. Assign every traveler to
        a room. Nightly prices are averages; the total covers the full stay and
        reported additional fees.
      </p>

      <div className="field-grid">
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
          Enter two-letter country codes, such as US, GB, or CA. This
          nationality applies to every room.
        </small>
      </div>

      </div>
      <p>
        Room arrangement for {tripForm.travelers || "your"} travelers. Add up to
        8 rooms, with up to 8 guests per room.
      </p>
      <div className="room-grid">
      {rooms.map((room, index) => (
        <fieldset key={index} className="room-card">
          <legend>Room {index + 1}</legend>
          <div className="form-group room-adults">
          <label htmlFor={`room-adults-${index}`}>Adults</label>
          <input
            id={`room-adults-${index}`}
            type="number"
            min="1"
            max="8"
            step="1"
            value={room.adults}
            onChange={(event) =>
              changeRoom(index, (current) => ({
                ...current,
                adults: event.target.value,
              }))
            }
          />
          </div>
          {room.children.map((age, childIndex) => (
            <div key={childIndex} className="child-row">
              <div className="form-group">
              <label htmlFor={`room-${index}-child-${childIndex}`}>
                Child {childIndex + 1} age (0–17)
              </label>
              <input
                id={`room-${index}-child-${childIndex}`}
                type="number"
                min="0"
                max="17"
                step="1"
                value={age}
                onChange={(event) =>
                  changeRoom(index, (current) => ({
                    ...current,
                    children: current.children.map((value, ageIndex) =>
                      ageIndex === childIndex ? event.target.value : value,
                    ),
                  }))
                }
              />
              </div>
              <button
                type="button"
                className="danger"
                onClick={() =>
                  changeRoom(index, (current) => ({
                    ...current,
                    children: current.children.filter(
                      (_value, ageIndex) => ageIndex !== childIndex,
                    ),
                  }))
                }
              >
                Remove child {childIndex + 1}
              </button>
            </div>
          ))}
          <div className="actions">
          <button
            type="button"
            disabled={Number(room.adults) + room.children.length >= 8}
            onClick={() =>
              changeRoom(index, (current) => ({
                ...current,
                children: [...current.children, ""],
              }))
            }
          >
            Add child
          </button>
          <button
            type="button"
            disabled={rooms.length === 1}
            onClick={() => {
              clearSearch();
              onRoomsChange(
                rooms.filter((_room, roomIndex) => roomIndex !== index),
              );
            }}
          >
            Remove room {index + 1}
          </button>
          </div>
        </fieldset>
      ))}
      </div>
      <div className="actions">
      <button
        type="button"
        disabled={rooms.length >= 8}
        onClick={() => {
          clearSearch();
          onRoomsChange([...rooms, { adults: "1", children: [] }]);
        }}
      >
        Add room
      </button>

      <button
        type="button"
        className="primary"
        disabled={status === "loading"}
        onClick={searchHotels}
      >
        {status === "loading"
          ? "Searching hotels..."
          : "Search Hotel Test Prices"}
      </button>

      <button type="button" onClick={clearSearch}>
        Use Manual Lodging
      </button>

      </div>
      <div aria-live="polite" aria-busy={status === "loading"}>
        {status === "loading" && <p role="status">Searching for hotel prices for your room arrangement...</p>}
        {error && <p className="error-message" role="alert">{error}</p>}

        {status === "success" && (
          <>
            <p>
              Select a hotel to use its total for the entire stay. Reported
              additional fees are included below.
            </p>

            <ul className="hotel-rates">
              {rates.map((rate, index) => (
                <li key={`${rate.hotelName}-${index}`}>
                  <p>
                    <strong>{rate.hotelName}</strong>
                    {" \u2014 "}{formatMoney(rate.total)} USD for the whole stay (
                    {formatMoney(rate.additionalFees)} in additional fees)
                  </p>
                  <HotelRoomBreakdown rooms={rate.rooms} nights={rate.nights} />
                  <button
                    type="button"
                    className="primary"
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
          <p className="selected-hotel">
            Using {selectedHotel.hotelName}: {formatMoney(selectedHotel.total)}{" "}
            USD. Manual lodging is saved but is not used while this hotel is
            selected.
          </p>
        )}
      </div>
      </section>
    </details>
  );
}

export default HotelPricing;
