export type Coordinates = {
  lat: number;
  lng: number;
};

export type StaticMapOptions = {
  center: Coordinates;
  zoom?: number;
  width?: number;
  height?: number;
  markerLabel?: string;
};

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function isValidCoordinate(value: number) {
  return Number.isFinite(value);
}

export function getDistanceMiles(a: Coordinates, b: Coordinates): number {
  if (!isValidCoordinate(a.lat) || !isValidCoordinate(a.lng)) return NaN;
  if (!isValidCoordinate(b.lat) || !isValidCoordinate(b.lng)) return NaN;

  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(hav));
}

export function getDistanceKm(a: Coordinates, b: Coordinates): number {
  const miles = getDistanceMiles(a, b);
  return Number.isFinite(miles) ? miles * 1.609344 : NaN;
}

export function getStaticMapUrl(options: StaticMapOptions): string | null {
  const provider = (process.env.NEXT_PUBLIC_MAPS_PROVIDER ?? '').toLowerCase();
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY ?? '';
  const zoom = options.zoom ?? 14;
  const width = options.width ?? 640;
  const height = options.height ?? 360;
  const { lat, lng } = options.center;

  if (!apiKey) return null;

  if (provider === 'google') {
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: String(zoom),
      size: `${width}x${height}`,
      key: apiKey,
    });
    if (options.markerLabel) {
      params.set('markers', `label:${options.markerLabel}|${lat},${lng}`);
    }
    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }

  if (provider === 'mapbox') {
    const style = process.env.NEXT_PUBLIC_MAPS_STYLE_ID ?? 'mapbox/streets-v12';
    const marker = options.markerLabel
      ? `pin-s-${encodeURIComponent(options.markerLabel)}(${lng},${lat})`
      : `pin-s(${lng},${lat})`;
    return (
      `https://api.mapbox.com/styles/v1/${style}/static/` +
      `${marker}/${lng},${lat},${zoom}/${width}x${height}?access_token=${apiKey}`
    );
  }

  return null;
}

export async function geocodeAddress(_address: string): Promise<Coordinates | null> {
  const address = _address.trim();
  if (!address) return null;

  const provider = (process.env.NEXT_PUBLIC_MAPS_PROVIDER ?? '').toLowerCase();
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY ?? '';
  if (!apiKey || provider !== 'google') return null;

  const params = new URLSearchParams({
    address,
    key: apiKey,
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };

    if (payload.status !== 'OK' || !payload.results?.length) return null;
    const location = payload.results[0]?.geometry?.location;
    if (!location) return null;
    if (!isValidCoordinate(location.lat ?? NaN)) return null;
    if (!isValidCoordinate(location.lng ?? NaN)) return null;
    return { lat: location.lat as number, lng: location.lng as number };
  } catch {
    return null;
  }
}

export async function reverseGeocode(_coords: Coordinates): Promise<string | null> {
  if (!isValidCoordinate(_coords.lat) || !isValidCoordinate(_coords.lng)) {
    return null;
  }

  const provider = (process.env.NEXT_PUBLIC_MAPS_PROVIDER ?? '').toLowerCase();
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY ?? '';
  if (!apiKey || provider !== 'google') return null;

  const params = new URLSearchParams({
    latlng: `${_coords.lat},${_coords.lng}`,
    key: apiKey,
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      status?: string;
      results?: Array<{ formatted_address?: string }>;
    };
    if (payload.status !== 'OK' || !payload.results?.length) return null;
    const address = payload.results[0]?.formatted_address?.trim();
    return address ? address : null;
  } catch {
    return null;
  }
}
