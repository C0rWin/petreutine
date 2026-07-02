import React, { useEffect, useRef, useState } from 'react';

import { loadYandexMapsScript } from '../services/yandexMaps';
import AddressAutocomplete from './AddressAutocomplete';

declare global {
  interface Window {
    ymaps: typeof ymaps;
  }
}

interface YandexMapProps {
  onLocationSelect: (location: string, latitude: number, longitude: number) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  initialLocation?: string;
}

// Fallback center (Moscow) used only when we have no post coords and geolocation
// is unavailable or denied.
const MOSCOW_CENTER: [number, number] = [55.751574, 37.573856];

const YandexMap: React.FC<YandexMapProps> = ({
  onLocationSelect,
  initialLatitude,
  initialLongitude,
  initialLocation = '',
}) => {
  const hasInitialCoords =
    typeof initialLatitude === 'number' && typeof initialLongitude === 'number';
  const startCenter: [number, number] = hasInitialCoords
    ? [initialLatitude as number, initialLongitude as number]
    : MOSCOW_CENTER;
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<ymaps.Map | null>(null);
  const [placemark, setPlacemark] = useState<ymaps.Placemark | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialLocation);

  useEffect(() => {
    let currentMap: ymaps.Map | null = null;

    loadYandexMapsScript()
      .then(() => {
        if (!mapRef.current) return;

        try {
          const newMap = new window.ymaps.Map(mapRef.current, {
            center: startCenter,
            zoom: hasInitialCoords ? 15 : 12,
            controls: ['zoomControl', 'geolocationControl'],
          });

          currentMap = newMap;

          const newPlacemark = new window.ymaps.Placemark(
            startCenter,
            {
              hintContent: 'Местоположение питомца',
              balloonContent: initialLocation || 'Выберите местоположение',
            },
            {
              draggable: true,
              preset: 'islands#redDotIcon',
            }
          );

          newMap.geoObjects.add(newPlacemark);

          // Handle placemark drag
          newPlacemark.events.add('dragend', () => {
            const coords = newPlacemark.geometry?.getCoordinates();
            if (coords) {
              reverseGeocode(coords[0], coords[1]);
            }
          });

          // Handle map click
          newMap.events.add('click', (e: ymaps.IEvent) => {
            const coords = e.get('coords') as [number, number];
            newPlacemark.geometry?.setCoordinates(coords);
            reverseGeocode(coords[0], coords[1]);
          });

          setMap(newMap);
          setPlacemark(newPlacemark);
          setIsLoading(false);

          // Auto-focus on the user's current location for new posts (when the
          // caller didn't pass coordinates, e.g. editing an existing post).
          if (!hasInitialCoords && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              position => {
                const { latitude, longitude } = position.coords;
                newPlacemark.geometry?.setCoordinates([latitude, longitude]);
                newMap.setCenter([latitude, longitude], 15);
                window.ymaps
                  .geocode([latitude, longitude])
                  .then(result => {
                    const geo = result.geoObjects.get(0);
                    if (geo) {
                      const address = geo.getAddressLine();
                      setSearchQuery(address);
                      newPlacemark.properties?.set('balloonContent', address);
                      onLocationSelect(address, latitude, longitude);
                    }
                  })
                  .catch(() => {
                    // Geocoding failed; still report the coordinates.
                    onLocationSelect(initialLocation, latitude, longitude);
                  });
              },
              () => {
                // Permission denied or unavailable: keep the default center.
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
          }
        } catch {
          // Error initializing map
          setError('Ошибка инициализации карты');
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        // Failed to load Yandex Maps
        setError(err.message || 'Не удалось загрузить карту');
        setIsLoading(false);
      });

    return () => {
      if (currentMap) {
        currentMap.destroy();
      }
    };
  }, []);

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const result = await window.ymaps.geocode([lat, lon]);
      const firstGeoObject = result.geoObjects.get(0);
      if (firstGeoObject) {
        const address = firstGeoObject.getAddressLine();
        setSearchQuery(address);
        onLocationSelect(address, lat, lon);
        if (placemark) {
          placemark.properties?.set('balloonContent', address);
        }
      }
    } catch {
      // Geocoding error - silently ignore
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !map || !placemark) return;

    try {
      const result = await window.ymaps.geocode(searchQuery);
      const firstGeoObject = result.geoObjects.get(0);
      if (firstGeoObject) {
        const coords = firstGeoObject.geometry?.getCoordinates();
        const bounds = firstGeoObject.properties?.get('boundedBy');

        if (coords) {
          placemark.geometry?.setCoordinates(coords);
          const address = firstGeoObject.getAddressLine();
          placemark.properties?.set('balloonContent', address);
          setSearchQuery(address);
          onLocationSelect(address, coords[0], coords[1]);

          if (bounds) {
            map.setBounds(bounds as [[number, number], [number, number]], { checkZoomRange: true });
          } else {
            map.setCenter(coords, 15);
          }
        }
      }
    } catch {
      // Search error - silently ignore
    }
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation || !map || !placemark) return;

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        placemark.geometry?.setCoordinates([latitude, longitude]);
        map.setCenter([latitude, longitude], 15);
        reverseGeocode(latitude, longitude);
      },
      () => {
        // Geolocation error
        setError('Не удалось определить местоположение');
      }
    );
  };

  // A suggestion was picked in the autocomplete: recenter the map and marker.
  const handleSuggestSelect = (address: string, lat: number, lon: number) => {
    setSearchQuery(address);
    if (placemark) {
      placemark.geometry?.setCoordinates([lat, lon]);
      placemark.properties?.set('balloonContent', address);
    }
    if (map) {
      map.setCenter([lat, lon], 16);
    }
    onLocationSelect(address, lat, lon);
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <AddressAutocomplete
            value={searchQuery}
            onChange={setSearchQuery}
            onSelect={handleSuggestSelect}
            placeholder="Введите адрес или нажмите на карту"
            wrapperClassName="relative flex-1"
            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Найти
          </button>
        </form>
        <button
          type="button"
          onClick={handleGeolocation}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          title="Определить моё местоположение"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        </button>
      </div>

      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        <div
          ref={mapRef}
          className="w-full h-64 rounded-lg border border-gray-300"
          style={{ minHeight: '256px' }}
        />
      </div>

      <p className="text-xs text-gray-500">
        Нажмите на карту или перетащите маркер для выбора точного местоположения
      </p>
    </div>
  );
};

export default YandexMap;
