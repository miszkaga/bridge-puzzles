import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Lepiej głośno przy starcie niż cicha awaria przy pierwszym logowaniu
  console.error('Brak VITE_SUPABASE_URL lub VITE_SUPABASE_ANON_KEY w pliku .env');
}

/**
 * Klient używa klucza anon — jawnego z założenia. Nie ma prawa czytać tabel gry,
 * bo RLS jest włączone bez polityk; służy wyłącznie do logowania i rejestracji.
 * Wszystkie dane rozgrywki chodzą przez backend.
 */
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
