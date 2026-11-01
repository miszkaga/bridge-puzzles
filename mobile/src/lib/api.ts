import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { API_URL } from './config';
import { getLang } from './i18n';

const USER_KEY = 'bridge-user-id';

let cachedUserId: string | null = null;

/**
 * Identyfikator gościa, jeden na instalację aplikacji. Pozwala grać bez konta,
 * a przy pierwszym logowaniu backend dopina go do konta, żeby postęp nie przepadł.
 *
 * Trzymamy go też w pamięci, bo AsyncStorage jest asynchroniczne, a potrzebujemy
 * identyfikatora synchronicznie przy budowaniu żądań.
 */
export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  let id = await AsyncStorage.getItem(USER_KEY);
  if (!id) {
    // crypto.randomUUID nie jest dostępne w każdym silniku RN
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    await AsyncStorage.setItem(USER_KEY, id);
  }
  cachedUserId = id;
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

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Lang', getLang());

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 403) {
    const body = await res.clone().json().catch(() => ({}));
    if (body?.error === 'registration_required') throw new RegistrationRequired(body);
  }
  return res;
}
