import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    ymaps: typeof ymaps;
  }
}

const YANDEX_MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY || '';

// Track script loading state globally to avoid duplicate loads
let ymapsLoadPromise: Promise<void> | null = null;

function loadYandexMapsScript(): Promise<void> {
  if (ymapsLoadPromise) {
    return ymapsLoadPromise;
  }

  if (window.ymaps) {
    return Promise.resolve();
  }

  ymapsLoadPromise = new Promise((resolve, reject) => {
    if (!YANDEX_MAPS_API_KEY) {
      reject(new Error('Yandex Maps API ключ не настроен'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      // Wait for ymaps to be ready
      window.ymaps.ready(() => resolve());
    };
    script.onerror = () => reject(new Error('Не удалось загрузить Yandex Maps API'));
    document.head.appendChild(script);
  });

  return ymapsLoadPromise;
}

interface YandexMapProps {
  onLocationSelect: (location: string, latitude: number, longitude: number) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  initialLocation?: string;
}

const YandexMap: React.FC<YandexMapProps> = ({
  onLocationSelect,
  initialLatitude = 55.751574,
  initialLongitude = 37.573856,
  initialLocation = '',
}) => {
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
            center: [initialLatitude, initialLongitude],
            zoom: 12,
            controls: ['zoomControl', 'geolocationControl'],
          });

          currentMap = newMap;

          const newPlacemark = new window.ymaps.Placemark(
            [initialLatitude, initialLongitude],
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
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Введите адрес или нажмите на карту"
            className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
