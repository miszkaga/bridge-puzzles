import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

if (!SUPABASE_ANON_KEY) {
  console.error('Brak EXPO_PUBLIC_SUPABASE_ANON_KEY — logowanie nie zadziała.');
}

/**
 * Na telefonie sesję trzyma AsyncStorage zamiast localStorage. Wyłączamy też
 * detectSessionInUrl — w aplikacji natywnej nie ma adresu URL do przeszukania.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
