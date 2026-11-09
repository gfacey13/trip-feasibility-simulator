import { useEffect, useRef, useState } from 'react';
import { searchCities } from './services/cityService';

export default function CityAutocomplete({ id, label, value, selectedCity, onChange, onSelect, invalid, error }) {
  const [lookup, setLookup] = useState({ query: '', cities: [], status: 'idle' });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const request = useRef(0);
  const selected = selectedCity?.label === value;
  useEffect(() => {
    const generation = ++request.current;
    if (!open || selected || value.trim().length < 3) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLookup({ query: value, cities: [], status: 'loading' });
      try {
        const cities = await searchCities(value, controller.signal);
        if (!controller.signal.aborted && generation === request.current) setLookup({ query: value, cities, status: 'success' });
      } catch {
        if (!controller.signal.aborted && generation === request.current) setLookup({ query: value, cities: [], status: 'error' });
      }
    }, 300);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [value, open, selected]);
  useEffect(() => {
    const city = lookup.query === value ? lookup.cities[active] : null;
    if (open && city) document.getElementById(`${id}-city-${city.id}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open, lookup, value, id]);
  const current = lookup.query === value ? lookup : { cities: [], status: 'idle' };
  const expanded = open && !selected && value.trim().length >= 3;
  function choose(city) { onSelect(city); setOpen(false); setActive(-1); }
  function keyDown(event) {
    if (event.key === 'Escape') { setOpen(false); setActive(-1); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      setActive((index) => current.cities.length ? index < 0 ? (event.key === 'ArrowDown' ? 0 : current.cities.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + current.cities.length) % current.cities.length : -1);
    } else if (event.key === 'Enter' && expanded && current.cities[active]) {
      event.preventDefault(); choose(current.cities[active]);
    } else if (event.key === 'Tab') { setOpen(false); setActive(-1); }
  }
  return (
    <div className="form-group city-autocomplete" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
    }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} role="combobox" aria-autocomplete="list" autoComplete="off"
        aria-expanded={expanded} aria-controls={`${id}-cities`}
        aria-activedescendant={expanded && current.cities[active] ? `${id}-city-${current.cities[active].id}` : undefined}
        aria-invalid={invalid} aria-describedby={`${id}-city-help${invalid ? ` ${id}-error` : ''}`}
        placeholder={id === 'origin' ? 'Search your starting city' : 'Search your destination city'}
        value={value} onFocus={() => setOpen(true)} onKeyDown={keyDown}
        onChange={(event) => { setActive(-1); setOpen(true); onChange(event.target.value); }} />
      <small id={`${id}-city-help`}>{selected ? `Selected: ${selectedCity.label}` : 'Type at least 3 letters, then choose a city or keep your own entry.'}</small>
      {invalid && <small className="field-error" id={`${id}-error`}>{error}</small>}
      {expanded && <div className="city-suggestions">
        <ul id={`${id}-cities`} role="listbox" aria-label={`${label} city suggestions`}>
          {current.cities.map((city,index) => <li key={city.id} role="option" id={`${id}-city-${city.id}`} aria-selected={index === active}
            onPointerDown={(event) => event.preventDefault()} onClick={() => choose(city)}>
            <strong>{city.name}</strong><span>{[city.region,city.country].filter(Boolean).join(', ')}</span>
          </li>)}
        </ul>
        <p role="status">{current.status === 'error' ? 'City search is unavailable. You can still enter a city manually.'
          : current.status === 'success' && !current.cities.length ? 'No matching cities. Try a longer name or add a region.'
          : current.status === 'success' ? `${current.cities.length} suggestions. Use arrow keys and Enter to choose.` : 'Searching cities...'}</p>
        <small>Locations by <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Open-Meteo</a> / GeoNames</small>
      </div>}
    </div>
  );
}
