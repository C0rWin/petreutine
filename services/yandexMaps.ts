// Shared Yandex Maps JS API loader. Ensures the script is injected once and
// reused across the map picker, the read-only map and the address autocomplete.

const YANDEX_MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY || '';

let ymapsLoadPromise: Promise<void> | null = null;

export function loadYandexMapsScript(): Promise<void> {
  if (ymapsLoadPromise) {
    return ymapsLoadPromise;
  }

  // Script already present (e.g. loaded by another component) — just wait for ready.
  if (typeof window !== 'undefined' && window.ymaps && window.ymaps.ready) {
    ymapsLoadPromise = new Promise<void>(resolve => window.ymaps.ready(() => resolve()));
    return ymapsLoadPromise;
  }

  ymapsLoadPromise = new Promise<void>((resolve, reject) => {
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
