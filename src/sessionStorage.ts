const SESSION_KEY = 'distance-calculator-session';
const THEME_KEY = 'distance-calculator-theme';
const FAVOURITES_KEY = 'distance-calculator-favourites';

export type StoredFavourite = { id: string; name: string; position: [number, number] };
const MAX_FAVOURITES = 9;

function isValidFavourite(x: unknown): x is StoredFavourite {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as StoredFavourite).id === 'string' &&
    typeof (x as StoredFavourite).name === 'string' &&
    isValidLatLng((x as StoredFavourite).position)
  );
}

export function loadFavourites(): StoredFavourite[] {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidFavourite).slice(0, MAX_FAVOURITES);
  } catch {
    return [];
  }
}

export function saveFavourites(favourites: StoredFavourite[]): void {
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites.slice(0, MAX_FAVOURITES)));
  } catch {
    // ignore
  }
}

export type StoredPerson = { id: string; name: string; position: [number, number] };
export type StoredSession = {
  people: StoredPerson[];
  meetingPoint: [number, number] | null;
};

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredSession;
    if (!Array.isArray(data.people) || !data.people.every(isValidPerson)) return null;
    if (data.meetingPoint !== null && !isValidLatLng(data.meetingPoint)) return null;
    return data;
  } catch {
    return null;
  }
}

function isValidPerson(p: unknown): p is StoredPerson {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as StoredPerson).id === 'string' &&
    typeof (p as StoredPerson).name === 'string' &&
    isValidLatLng((p as StoredPerson).position)
  );
}

function isValidLatLng(x: unknown): x is [number, number] {
  return Array.isArray(x) && x.length === 2 && typeof x[0] === 'number' && typeof x[1] === 'number';
}

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode
  }
}

export type Theme = 'dark' | 'light';

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {
    // ignore
  }
  return 'dark';
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}
