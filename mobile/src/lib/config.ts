import Constants from 'expo-constants';

/**
 * Telefon nie dosięgnie "localhost" — to jego własna pętla zwrotna, nie komputera
 * deweloperskiego. Expo podaje jednak adres, spod którego serwuje bundle
 * (np. 172.16.202.45:8081), więc wyciągamy z niego host i doklejamy port backendu.
 *
 * Dzięki temu nie trzeba nic wpisywać ręcznie ani przy zmianie sieci.
 */
function devApiUrl(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;

  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : 'http://localhost:3000';
}

/** EXPO_PUBLIC_API_URL nadpisuje wykrywanie — przyda się, gdy backend stanie w chmurze. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL || devApiUrl();

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
