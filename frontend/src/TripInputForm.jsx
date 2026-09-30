import { useState } from "react";

function TripInputForm({ onFormChange }) {
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    startDate: "",
    endDate: "",
    budget: "",
    travelers: "",
    transportation: "",
  });

  const handleChange = (e) => {
    const updatedForm = {
      ...form,
      [e.target.id]: e.target.value,
    };

    setForm(updatedForm);

    if (onFormChange) {
      onFormChange(updatedForm);
    }
  };

  const handleSubmit = () => {
    const errors = [];
    if (!form.origin) errors.push("Origin is required.");
    if (!form.destination) errors.push("Destination is required.");
    if (!form.startDate) errors.push("Start date is required.");
    if (!form.endDate) errors.push("End date is required.");
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      errors.push("End date must be after start date.");
    if (!form.budget || form.budget <= 0)
      errors.push("Budget must be greater than 0.");
    if (!form.travelers || form.travelers <= 0)
      errors.push("Number of travelers must be at least 1.");
    if (!form.transportation)
      errors.push("Transportation type is required.");

    if (errors.length > 0) {
      alert(errors.join("\n"));
      return;
    }

    alert("Trip details submitted successfully!");
  };

  return (
    <div>
      <h2>Trip Input Details</h2>

      <label>Origin:</label>
      <input id="origin" value={form.origin} onChange={handleChange} />

      <label>Destination:</label>
      <input id="destination" value={form.destination} onChange={handleChange} />

      <label>Start Date:</label>
      <input type="date" id="startDate" value={form.startDate} onChange={handleChange} />

      <label>End Date:</label>
      <input type="date" id="endDate" value={form.endDate} onChange={handleChange} />

      <label>Budget ($):</label>
      <input type="number" id="budget" value={form.budget} onChange={handleChange} />

      <label>Number of Travelers:</label>
      <input type="number" id="travelers" value={form.travelers} onChange={handleChange} />

      <label>Transportation:</label>
      <select id="transportation" value={form.transportation} onChange={handleChange}>
        <option value="">Select one</option>
        <option value="car">Car</option>
        <option value="bus">Bus</option>
        <option value="train">Train</option>
        <option value="plane">Plane</option>
      </select>

      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}

export default TripInputForm;