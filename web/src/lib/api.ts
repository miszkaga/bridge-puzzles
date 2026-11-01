import { supabase } from '@/lib/supabase';
import { detectLang } from '@/lib/i18n';

/**
 * Pusty adres oznacza "ten sam origin" — żądania idą na /api/... i trafiają
 * w proxy dev-serwera Vite, które przekazuje je do backendu. Dzięki temu przy
 * tunelowaniu wystarczy wystawić jeden port i nie ma tematu CORS-a.
 *
 * VITE_API_URL nadpisuje to zachowanie, gdy backend stoi gdzie indziej.
 */
export const API_URL = import.meta.env.VITE_API_URL ?? '';

const USER_KEY = 'bridge-user-id';

/**
 * Identyfikator gościa losowany raz na przeglądarkę. Pozwala grać bez konta,
 * a przy pierwszym logowaniu backend dopina go do konta, żeby postęp zrobiony
 * przed rejestracją nie przepadł.
 */
/**
 * crypto.randomUUID istnieje tylko w bezpiecznym kontekście (HTTPS albo localhost).
 * Na zwykłym HTTP jest niezdefiniowane, więc trzymamy zapasowy generator —
 * identyfikator gościa nie jest sekretem, wystarczy że jest unikalny.
 */
function randomId(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getUserId(): string {
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

/** Rzucane, gdy backend odbił żądanie ścianą rejestracji. */
export class RegistrationRequired extends Error {
  solved: number;
  limit: number;
  constructor(payload: { message?: string; solved?: number; limit?: number }) {
    super(payload.message ?? 'Załóż konto, żeby grać dalej.');
    this.name = 'RegistrationRequired';
    this.solved = payload.solved ?? 0;
    this.limit = payload.limit ?? 0;
  }
}

/**
 * Dokleja token sesji, jeśli gracz jest zalogowany. Backend rozstrzyga
 * tożsamość po tokenie, a identyfikator gościa traktuje tylko jako zapasowy.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // Wyjaśnienia zagadek przychodzą z serwera, więc język musi jechać razem z żądaniem.
  // Accept-Language jest w fetchu zabroniony do nadpisania, stąd własny nagłówek.
  headers.set('X-Lang', detectLang());

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 403) {
    const body = await res.clone().json().catch(() => ({}));
    if (body?.error === 'registration_required') throw new RegistrationRequired(body);
  }
  return res;
}
