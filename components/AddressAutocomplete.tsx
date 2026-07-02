import React, { useEffect, useRef, useState } from 'react';

import { loadYandexMapsScript } from '../services/yandexMaps';

interface Suggestion {
  title: string;
  lat: number;
  lon: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  // Fired when a suggestion is picked, with its geocoded coordinates.
  onSelect?: (address: string, latitude: number, longitude: number) => void;
  placeholder?: string;
  className?: string;
  // Class for the positioning wrapper (needs `relative`); pass `flex-1` etc. here
  // when the input lives in a flex row.
  wrapperClassName?: string;
  id?: string;
  required?: boolean;
}

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

// Address autocomplete backed by the Yandex JS geocoder (ymaps.geocode), which
// returns several ranked matches for partial input. No extra Yandex service is
// required beyond the JS API + Geocoder the site already uses.
const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  wrapperClassName = 'relative',
  id,
  required,
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeq = useRef(0);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurRef.current) clearTimeout(blurRef.current);
    },
    []
  );

  const fetchSuggestions = (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const seq = ++reqSeq.current;
    loadYandexMapsScript()
      .then(() => window.ymaps.geocode(trimmed, { results: 5 }))
      .then(res => {
        if (seq !== reqSeq.current) return; // stale response, ignore
        const items: Suggestion[] = [];
        for (let i = 0; i < 5; i++) {
          const geo = res.geoObjects.get(i);
          if (!geo) break;
          const coords = geo.geometry?.getCoordinates();
          if (coords) items.push({ title: geo.getAddressLine(), lat: coords[0], lon: coords[1] });
        }
        setSuggestions(items);
        setOpen(items.length > 0);
      })
      .catch(() => {
        if (seq === reqSeq.current) setSuggestions([]);
      });
  };

  const handleInput = (v: string) => {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), DEBOUNCE_MS);
  };

  const pick = (s: Suggestion) => {
    onChange(s.title);
    setSuggestions([]);
    setOpen(false);
    if (onSelect) onSelect(s.title, s.lat, s.lon);
  };

  return (
    <div className={wrapperClassName}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => {
          // Warm up the maps script so the first suggestion isn't slow.
          loadYandexMapsScript().catch(() => {});
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => {
          // Delay so a click on a suggestion registers before closing.
          blurRef.current = setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {suggestions.map((s, i) => (
            <li key={`${i}-${s.title}`}>
              <button
                type="button"
                // onMouseDown (not onClick) so it fires before the input blur.
                onMouseDown={e => {
                  e.preventDefault();
                  pick(s);
                }}
                className="flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-coral-50"
              >
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{s.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
