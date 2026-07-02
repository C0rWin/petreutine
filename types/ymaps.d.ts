declare namespace ymaps {
  interface IEvent {
    get(name: string): unknown;
  }

  interface IGeometry {
    getCoordinates(): [number, number] | undefined;
    setCoordinates(coords: [number, number]): void;
  }

  interface IProperties {
    set(key: string, value: unknown): void;
    get(key: string): unknown;
  }

  interface IGeoObject {
    geometry?: IGeometry;
    properties?: IProperties;
    getAddressLine(): string;
  }

  interface IGeoObjectCollection {
    get(index: number): IGeoObject | undefined;
  }

  interface IGeocodeResult {
    geoObjects: IGeoObjectCollection;
  }

  class Map {
    constructor(
      element: HTMLElement | string,
      options: {
        center: [number, number];
        zoom: number;
        controls?: string[];
      }
    );
    geoObjects: {
      add(object: Placemark): void;
      remove(object: Placemark): void;
    };
    events: {
      add(type: string, callback: (e: IEvent) => void): void;
    };
    setCenter(center: [number, number], zoom?: number): void;
    setBounds(
      bounds: [[number, number], [number, number]],
      options?: { checkZoomRange?: boolean }
    ): void;
    destroy(): void;
  }

  class Placemark {
    constructor(
      coordinates: [number, number],
      properties?: {
        hintContent?: string;
        balloonContent?: string;
      },
      options?: {
        draggable?: boolean;
        preset?: string;
      }
    );
    geometry?: IGeometry;
    properties?: IProperties;
    events: {
      add(type: string, callback: (e?: IEvent) => void): void;
    };
  }

  function ready(callback: () => void): void;
  function geocode(
    request: string | [number, number],
    options?: { results?: number; boundedBy?: [[number, number], [number, number]] }
  ): Promise<IGeocodeResult>;
}
