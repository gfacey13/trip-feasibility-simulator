import CityAutocomplete from "./CityAutocomplete";

function TripInputForm({ form, onFormChange, showErrors = false }) {
  const errors = {
    origin: !form.origin.trim() ? "Enter your starting city." : "",
    destination: !form.destination.trim() ? "Enter your destination city." : "",
    startDate: !form.startDate ? "Choose a departure date." : "",
    endDate: !form.endDate || form.endDate <= form.startDate ? "Choose a return date after departure." : "",
    budget: !form.budget || Number(form.budget) <= 0 ? "Enter a budget greater than zero." : "",
    travelers: !form.travelers || !Number.isInteger(Number(form.travelers)) || Number(form.travelers) < 1 ? "Enter a positive whole number of travelers." : "",
    transportation: !form.transportation ? "Choose a transportation method." : "",
  };
  const fields = [
    ["origin", "Origin", "text", "e.g. Norfolk"],
    ["destination", "Destination", "text", "e.g. Boston"],
    ["startDate", "Start Date", "date"],
    ["endDate", "End Date", "date"],
    ["budget", "Budget ($)", "number", "Your total trip budget"],
    ["travelers", "Number of Travelers", "number", "Adults and children"],
  ];
  const invalid = (id) => showErrors && Boolean(errors[id]);
  return (
    <div className="trip-input-form">
      <h2 id="trip-input-heading">Trip Input Details</h2>
      <p className="section-intro">Start with the essentials. You can analyze a trip as a guest and log in to save it.</p>
      {fields.map(([id, label, type, placeholder]) => ["origin", "destination"].includes(id) ? (
        <CityAutocomplete key={id} id={id} label={label} value={form[id]} selectedCity={form[`${id}City`]}
          invalid={invalid(id)} error={errors[id]}
          onChange={(value) => onFormChange?.({ ...form, [id]: value, [`${id}City`]: null })}
          onSelect={(city) => onFormChange?.({ ...form, [id]: city.label, [`${id}City`]: city })} />
      ) : (
        <div className="form-group" key={id}>
          <label htmlFor={id}>{label}</label>
          <input id={id} type={type} placeholder={placeholder} value={form[id]}
            min={id === "travelers" ? "1" : id === "budget" ? "0.01" : id === "endDate" ? form.startDate : undefined}
            step={id === "travelers" ? "1" : id === "budget" ? "0.01" : undefined}
            aria-invalid={invalid(id)} aria-describedby={invalid(id) ? `${id}-error` : undefined}
            onChange={(event) => onFormChange?.({ ...form, [id]: event.target.value })} />
          {invalid(id) && <small id={`${id}-error`} className="field-error">{errors[id]}</small>}
        </div>
      ))}
      <div className="form-group">
        <label htmlFor="transportation">Transportation</label>
        <select id="transportation" value={form.transportation} aria-invalid={invalid("transportation")}
          aria-describedby={invalid("transportation") ? "transportation-error" : undefined}
          onChange={(event) => onFormChange?.({ ...form, transportation: event.target.value })}>
          <option value="">Select one</option>
          <option value="car">Car</option><option value="bus">Bus</option><option value="train">Train</option><option value="plane">Plane</option>
        </select>
        {invalid("transportation") && <small id="transportation-error" className="field-error">{errors.transportation}</small>}
      </div>
    </div>
  );
}
export default TripInputForm;
