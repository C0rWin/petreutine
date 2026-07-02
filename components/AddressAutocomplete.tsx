import React, { useEffect, useRef } from 'react';

import { loadYandexMapsScript } from '../services/yandexMaps';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  // Fired when a suggestion is picked; the address is geocoded to coordinates.
  onSelect?: (address: string, latitude: number, longitude: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  id,
  required,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep latest callbacks without re-creating the SuggestView.
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    let suggestView: ymaps.SuggestView | null = null;
    let cancelled = false;

    loadYandexMapsScript()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        try {
          suggestView = new window.ymaps.SuggestView(inputRef.current, { results: 5 });
          suggestView.events.add('select', (e: ymaps.IEvent) => {
            const item = e.get('item') as ymaps.ISuggestItem | undefined;
            const address = item?.value ?? '';
            if (!address) return;
            onChangeRef.current(address);
            // Resolve to coordinates so callers can recenter the map.
            window.ymaps
              .geocode(address)
              .then(res => {
                const geo = res.geoObjects.get(0);
                const coords = geo?.geometry?.getCoordinates();
                if (geo && coords && onSelectRef.current) {
                  onSelectRef.current(geo.getAddressLine(), coords[0], coords[1]);
                }
              })
              .catch(() => {
                // Geocoding failed; the text value is still applied above.
              });
          });
        } catch {
          // Suggest service/tier unavailable: the field still works as a plain
          // text input and geocoding on the map still functions.
        }
      })
      .catch(() => {
        // Maps API failed to load; degrade to a plain input.
      });

    return () => {
      cancelled = true;
      if (suggestView) {
        suggestView.destroy();
      }
    };
  }, []);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      required={required}
      autoComplete="off"
    />
  );
};

export default AddressAutocomplete;
