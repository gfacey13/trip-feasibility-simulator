function TripInputForm({ form, onFormChange }) {
  const handleChange = (e) => {
    const updatedForm = {
      ...form,
      [e.target.id]: e.target.value,
    };

    if (onFormChange) {
      onFormChange(updatedForm);
    }
  };


  return (
    <div className="trip-input-form">
      <h2>Trip Input Details</h2>
      <div className="form-group">
        <label>Origin:</label>
        <input id="origin" value={form.origin} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Destination:</label>
        <input id="destination" value={form.destination} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Start Date:</label>
        <input type="date" id="startDate" value={form.startDate} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>End Date:</label>
        <input type="date" id="endDate" value={form.endDate} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Budget ($):</label>
        <input type="number" id="budget" value={form.budget} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Number of Travelers:</label>
        <input type="number" id="travelers" value={form.travelers} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Transportation:</label>
        <select id="transportation" value={form.transportation} onChange={handleChange}>
          <option value="">Select one</option>
          <option value="car">Car</option>
          <option value="bus">Bus</option>
          <option value="train">Train</option>
          <option value="plane">Plane</option>
        </select>
      </div>


    </div>
  );
}

export default TripInputForm;