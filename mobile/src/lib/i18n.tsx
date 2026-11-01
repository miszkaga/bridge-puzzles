import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'pl' | 'en';

const LANG_KEY = 'bridge-lang';

/** Ustawienie systemowe telefonu; przy braku Intl schodzimy do angielskiego. */
function deviceLang(): Lang {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  } catch {
    return 'en';
  }
}

/** Baza trzyma A K Q J; polski brydżysta czyta Damę i Waleta jako D i W. */
const RANK_LABEL: Record<Lang, Record<string, string>> = { pl: { Q: 'D', J: 'W' }, en: {} };
export const rankLabel = (rank: string, lang: Lang) => RANK_LABEL[lang][rank] ?? rank;

/** Liczebniki: polski ma trzy formy (1 / 2-4 / 5+), angielski dwie. */
function plural(lang: Lang, n: number, forms: string[]): string {
  if (lang === 'en') return n === 1 ? forms[0] : forms[1];
  const last = n % 10;
  const teen = n % 100 >= 12 && n % 100 <= 14;
  if (n === 1) return forms[0];
  if (!teen && last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

const PL = {
  'nav.login': 'Zaloguj się',
  'nav.register': 'Załóż konto',
  'nav.logout': 'Wyloguj się',
  'nav.back': 'Wróć',
  'nav.menu': 'Menu',

  'home.tagline': 'Trenuj licytację, rozgrywkę i obronę. Zdobywaj rangę i punkty Elo.',
  'home.rank': 'Twoja ranga',
  'home.calibrating': 'W trakcie kalibracji',
  'home.soon': 'Wkrótce',

  'tile.puzzle': 'Puzzles',
  'tile.puzzle.sub': 'Pojedyncze kolory, szybkie łamigłówki',
  'tile.defense': 'Obrona',
  'tile.defense.sub': 'Zagraj kartą, która zmyli rozgrywającego',
  'tile.problem': 'Problemy',
  'tile.problem.sub': 'Pełne rozdania do rozwiązania',
  'tile.daily': 'Daily Puzzle',
  'tile.daily.sub': 'Jedno pełne rozdanie dziennie',

  'mode.puzzle': 'Puzzles',
  'mode.defense': 'Obrona',
  'mode.problem': 'Problemy',
  'mode.daily': 'Daily Puzzle',
  'mode.default': 'Trening',

  'game.contract': 'Kontrakt',
  'game.declarer': 'Rozgrywa',
  'game.shuffling': 'Tasowanie kart…',
  'game.error': 'Błąd',

  'seat.you': 'Ty',
  'seat.dummy': 'Dziadek',
  'seat.declarer': 'Rozgrywający',
  'seat.partner': 'Partner',
  'seat.defence': 'Obrona',

  'table.solved': 'Rozwiązane!',
  'table.wrong': 'Błędny ruch!',
  'table.alreadyPlayed': 'Rozwiązywałeś już tę zagadkę — ranking bez zmian.',
  'table.noChange': 'Ranking bez zmian.',
  'table.nextPuzzle': 'Następna zagadka',
  'table.connectionError': 'Błąd połączenia z serwerem.',
  'table.showDeal': 'Obejrzyj rozdanie',
  'table.summary': 'Podsumowanie',

  'wall.title': 'Koniec darmowej puli',
  'wall.body': 'Załóż konto, żeby grać dalej — Twój postęp i Elo przejdą na nie.',
  'wall.haveAccount': 'Mam już konto',

  'auth.loginTitle': 'Zaloguj się',
  'auth.registerTitle': 'Załóż konto',
  'auth.registerHint': 'Twoje dotychczasowe postępy przejdą na konto.',
  'auth.loginHint': 'Odzyskaj swoje Elo i rozwiązane zadania na dowolnym urządzeniu.',
  'auth.email': 'E-mail',
  'auth.password': 'Hasło',
  'auth.haveAccount': 'Masz już konto?',
  'auth.noAccount': 'Nie masz konta?',
  'auth.err.credentials': 'Nieprawidłowy e-mail lub hasło.',
  'auth.err.exists': 'Konto na ten adres już istnieje. Zaloguj się.',
  'auth.err.short': 'Hasło musi mieć co najmniej 6 znaków.',
  'auth.err.email': 'To nie wygląda na poprawny adres e-mail.',
};

const EN: Record<keyof typeof PL, string> = {
  'nav.login': 'Log in',
  'nav.register': 'Sign up',
  'nav.logout': 'Log out',
  'nav.back': 'Back',
  'nav.menu': 'Menu',

  'home.tagline': 'Train bidding, declarer play and defence. Climb the ranks and earn Elo.',
  'home.rank': 'Your rank',
  'home.calibrating': 'Calibrating',
  'home.soon': 'Soon',

  'tile.puzzle': 'Puzzles',
  'tile.puzzle.sub': 'Single suits, quick problems',
  'tile.defense': 'Defence',
  'tile.defense.sub': 'Play the card that misleads declarer',
  'tile.problem': 'Problems',
  'tile.problem.sub': 'Full deals to solve',
  'tile.daily': 'Daily Puzzle',
  'tile.daily.sub': 'One full deal every day',

  'mode.puzzle': 'Puzzles',
  'mode.defense': 'Defence',
  'mode.problem': 'Problems',
  'mode.daily': 'Daily Puzzle',
  'mode.default': 'Practice',

  'game.contract': 'Contract',
  'game.declarer': 'Declarer',
  'game.shuffling': 'Shuffling…',
  'game.error': 'Error',

  'seat.you': 'You',
  'seat.dummy': 'Dummy',
  'seat.declarer': 'Declarer',
  'seat.partner': 'Partner',
  'seat.defence': 'Defence',

  'table.solved': 'Solved!',
  'table.wrong': 'Wrong card!',
  'table.alreadyPlayed': "You've already solved this puzzle — rating unchanged.",
  'table.noChange': 'Rating unchanged.',
  'table.nextPuzzle': 'Next puzzle',
  'table.connectionError': 'Could not reach the server.',
  'table.showDeal': 'View the deal',
  'table.summary': 'Summary',

  'wall.title': "That's the free set",
  'wall.body': 'Create an account to keep playing — your progress and Elo move over to it.',
  'wall.haveAccount': 'I already have an account',

  'auth.loginTitle': 'Log in',
  'auth.registerTitle': 'Create an account',
  'auth.registerHint': 'Your progress so far will move over to the account.',
  'auth.loginHint': 'Get your Elo and solved puzzles back on any device.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.haveAccount': 'Already have an account?',
  'auth.noAccount': "Don't have an account?",
  'auth.err.credentials': 'Wrong email or password.',
  'auth.err.exists': 'An account with this email already exists. Log in instead.',
  'auth.err.short': 'Password must be at least 6 characters.',
  'auth.err.email': "That doesn't look like a valid email address.",
};

const DICT: Record<Lang, Record<string, string>> = { pl: PL, en: EN };
export type TKey = keyof typeof PL;

/** Backend czyta nagłówek X-Lang, więc język musi być dostępny poza Reactem. */
let currentLang: Lang = deviceLang();
export const getLang = (): Lang => currentLang;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
  cards: (n: number) => string;
  freeLeft: (n: number) => string;
  solvedWithoutAccount: (n: number) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang);

  // AsyncStorage jest asynchroniczne — startujemy od języka systemu i podmieniamy,
  // gdy okaże się, że gracz kiedyś wybrał inny
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((saved) => {
      if (saved === 'pl' || saved === 'en') {
        currentLang = saved;
        setLangState(saved);
      }
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    currentLang = l;
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback((key: TKey) => DICT[lang][key] ?? key, [lang]);

  const value: Ctx = {
    lang,
    setLang,
    t,
    cards: (n) => `${n} ${plural(lang, n, lang === 'pl' ? ['karta', 'karty', 'kart'] : ['card', 'cards'])}`,
    freeLeft: (n) =>
      lang === 'pl'
        ? `${n} ${plural(lang, n, ['zadanie', 'zadania', 'zadań'])}`
        : `${n} ${plural(lang, n, ['puzzle left', 'puzzles left'])}`,
    solvedWithoutAccount: (n) =>
      lang === 'pl'
        ? `Rozwiązałeś ${n} ${plural(lang, n, ['zadanie', 'zadania', 'zadań'])} bez konta.`
        : `You've solved ${n} ${plural(lang, n, ['puzzle', 'puzzles'])} without an account.`,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n poza I18nProvider');
  return ctx;
}
