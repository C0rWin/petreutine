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
      window.ymaps.ready(() => resolve());
    };
    script.onerror = () => reject(new Error('Не удалось загрузить Yandex Maps API'));
    document.head.appendChild(script);
  });

  return ymapsLoadPromise;
}

interface LocationMapProps {
  latitude: number;
  longitude: number;
  location: string;
  type: 'LOST' | 'FOUND';
}

const LocationMap: React.FC<LocationMapProps> = ({ latitude, longitude, location, type }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let currentMap: ymaps.Map | null = null;

    loadYandexMapsScript()
      .then(() => {
        if (!mapRef.current) return;

        try {
          const map = new window.ymaps.Map(mapRef.current, {
            center: [latitude, longitude],
            zoom: 15,
            controls: ['zoomControl', 'fullscreenControl'],
          });

          currentMap = map;

          // Create placemark with appropriate color
          const placemark = new window.ymaps.Placemark(
            [latitude, longitude],
            {
              hintContent: location,
              balloonContent: `<strong>${type === 'LOST' ? 'Место пропажи' : 'Место находки'}</strong><br/>${location}`,
            },
            {
              preset: type === 'LOST' ? 'islands#redDotIcon' : 'islands#greenDotIcon',
            }
          );

          map.geoObjects.add(placemark);
          setIsLoading(false);
        } catch {
          // Error initializing map
          setError('Ошибка загрузки карты');
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
  }, [latitude, longitude, location, type]);

  if (error) {
    return (
      <div className="bg-gray-100 rounded-lg p-4 text-gray-500 text-sm text-center">
        <svg
          className="w-8 h-8 mx-auto mb-2 text-gray-400"
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
        {error}
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      <div
        ref={mapRef}
        className="w-full h-48 rounded-lg border border-gray-200"
        style={{ minHeight: '192px' }}
      />
    </div>
  );
};

export default LocationMap;
