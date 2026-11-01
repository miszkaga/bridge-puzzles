import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Lang = 'pl' | 'en';

const LANG_KEY = 'bridge-lang';

/** Zapisany wybór gracza ma pierwszeństwo nad ustawieniem przeglądarki. */
export function detectLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === 'pl' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

/**
 * Karty trzymamy w bazie w notacji angielskiej (A K Q J), ale polski brydżysta
 * czyta Damę i Waleta jako D i W. To wyłącznie prezentacja — dane zostają te same.
 */
const RANK_LABEL: Record<Lang, Record<string, string>> = {
  pl: { Q: 'D', J: 'W' },
  en: {},
};

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
  'nav.backToMenu': 'Wróć do menu',
  'nav.menu': 'Menu',

  'home.tagline': 'Trenuj licytację, rozgrywkę i obronę. Zdobywaj rangę i punkty Elo.',
  'home.rank': 'Twoja ranga',
  'home.calibrating': 'W trakcie kalibracji',
  'home.earnRank': 'Zdobądź rangę',
  'home.topPlayers': 'Top 30% graczy',
  'home.streak': 'dni w rzędzie',
  'home.eloBoost': 'Elo Boost',
  'home.safetyNet': 'Safety Net — ochrona przed spadkiem',
  'home.soon': 'Wkrótce',

  'tile.puzzle': 'Puzzles',
  'tile.puzzle.sub': 'Pojedyncze kolory, szybkie łamigłówki',
  'tile.defense': 'Obrona',
  'tile.defense.sub': 'Zagraj kartą, która zmyli rozgrywającego',
  'tile.problem': 'Problemy',
  'tile.problem.sub': 'Pełne rozdania do rozwiązania',
  'tile.daily': 'Daily Puzzle',
  'tile.daily.sub': 'Jedno pełne rozdanie dziennie',
  'tile.ranked': 'Rankedy 1v1',
  'tile.ranked.sub': 'Punkty Elo w pojedynku',
  'tile.pairBidding': 'Licytacja w Parze',
  'tile.pairBidding.sub': 'Wspólna licytacja z partnerem',
  'tile.leaderboard': 'Tablica Zwycięzców',
  'tile.leaderboard.sub': 'Najlepsi gracze tygodnia',

  'mode.bidding': 'Licytacja',
  'mode.puzzle': 'Puzzles',
  'mode.problem': 'Problemy',
  'mode.daily': 'Daily Puzzle',
  'mode.play': 'Rozgrywka',
  'mode.declarer': 'Rozgrywka',
  'mode.defense': 'Obrona',
  'mode.ranked': 'Gra Rankingowa',
  'mode.pair-bidding': 'Licytacja w Parze',
  'mode.leaderboard': 'Tablica Zwycięzców',
  'mode.default': 'Trening',

  'game.mode': 'Tryb',
  'game.contract': 'Kontrakt',
  'game.declarer': 'Rozgrywa',
  'game.biddingHeader': 'Licytacja • Rozpoczyna W',
  'game.exit': 'Wyjście',
  'game.shuffling': 'Tasowanie kart… 🃏',
  'game.error': 'Błąd',

  'seat.you': 'Ty',
  'seat.dummy': 'Dziadek',
  'seat.declarer': 'Rozgrywający',
  'seat.partner': 'Partner',
  'seat.defence': 'Obrona',

  'table.solved': 'Rozwiązane!',
  'table.wrong': 'Błędny ruch!',
  'table.solvedShort': 'Rozwiązane',
  'table.wrongShort': 'Błędny ruch',
  'table.alreadyPlayed': 'Rozwiązywałeś już tę zagadkę — ranking bez zmian.',
  'table.noChange': 'Ranking bez zmian.',
  'table.nextPuzzle': 'Następna zagadka',
  'table.next': 'Następna',
  'table.explanation': 'Wyjaśnienie',
  'table.hideSummary': 'Ukryj podsumowanie',
  'table.connectionError': 'Błąd połączenia z serwerem.',
  'table.freeLeftPrefix': 'Bez konta zostało Ci jeszcze',
  'table.freeLastOne': 'To było ostatnie zadanie bez konta',
  'table.freeKeepProgress': ', żeby nie stracić postępu.',
  'table.freeKeepPlaying': ', żeby grać dalej.',

  'wall.title': 'Koniec darmowej puli',
  'wall.body': 'Załóż konto, żeby grać dalej — Twój dotychczasowy postęp i Elo przejdą na nie.',
  'wall.haveAccount': 'Mam już konto',

  'auth.loginTitle': 'Zaloguj się',
  'auth.registerTitle': 'Załóż konto',
  'auth.registerHint': 'Twoje dotychczasowe postępy z tej przeglądarki przejdą na konto.',
  'auth.loginHint': 'Odzyskaj swoje Elo i rozwiązane zadania na dowolnym urządzeniu.',
  'auth.email': 'E-mail',
  'auth.password': 'Hasło',
  'auth.passwordHint': 'minimum 6 znaków',
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
  'nav.backToMenu': 'Back to menu',
  'nav.menu': 'Menu',

  'home.tagline': 'Train bidding, declarer play and defence. Climb the ranks and earn Elo.',
  'home.rank': 'Your rank',
  'home.calibrating': 'Calibrating',
  'home.earnRank': 'Earn your rank',
  'home.topPlayers': 'Top 30% of players',
  'home.streak': 'day streak',
  'home.eloBoost': 'Elo Boost',
  'home.safetyNet': 'Safety Net — protects you from dropping',
  'home.soon': 'Soon',

  'tile.puzzle': 'Puzzles',
  'tile.puzzle.sub': 'Single suits, quick problems',
  'tile.defense': 'Defence',
  'tile.defense.sub': 'Play the card that misleads declarer',
  'tile.problem': 'Problems',
  'tile.problem.sub': 'Full deals to solve',
  'tile.daily': 'Daily Puzzle',
  'tile.daily.sub': 'One full deal every day',
  'tile.ranked': 'Ranked 1v1',
  'tile.ranked.sub': 'Elo on the line',
  'tile.pairBidding': 'Partnership Bidding',
  'tile.pairBidding.sub': 'Bid together with a partner',
  'tile.leaderboard': 'Leaderboard',
  'tile.leaderboard.sub': 'Best players of the week',

  'mode.bidding': 'Bidding',
  'mode.puzzle': 'Puzzles',
  'mode.problem': 'Problems',
  'mode.daily': 'Daily Puzzle',
  'mode.play': 'Declarer play',
  'mode.declarer': 'Declarer play',
  'mode.defense': 'Defence',
  'mode.ranked': 'Ranked',
  'mode.pair-bidding': 'Partnership Bidding',
  'mode.leaderboard': 'Leaderboard',
  'mode.default': 'Practice',

  'game.mode': 'Mode',
  'game.contract': 'Contract',
  'game.declarer': 'Declarer',
  'game.biddingHeader': 'Bidding • W starts',
  'game.exit': 'Exit',
  'game.shuffling': 'Shuffling… 🃏',
  'game.error': 'Error',

  'seat.you': 'You',
  'seat.dummy': 'Dummy',
  'seat.declarer': 'Declarer',
  'seat.partner': 'Partner',
  'seat.defence': 'Defence',

  'table.solved': 'Solved!',
  'table.wrong': 'Wrong card!',
  'table.solvedShort': 'Solved',
  'table.wrongShort': 'Wrong card',
  'table.alreadyPlayed': "You've already solved this puzzle — rating unchanged.",
  'table.noChange': 'Rating unchanged.',
  'table.nextPuzzle': 'Next puzzle',
  'table.next': 'Next',
  'table.explanation': 'Explanation',
  'table.hideSummary': 'Hide summary',
  'table.connectionError': 'Could not reach the server.',
  'table.freeLeftPrefix': 'Without an account you have',
  'table.freeLastOne': 'That was your last puzzle without an account',
  'table.freeKeepProgress': ' to keep your progress.',
  'table.freeKeepPlaying': ' to keep playing.',

  'wall.title': "That's the free set",
  'wall.body': 'Create an account to keep playing — your progress and Elo will move over to it.',
  'wall.haveAccount': 'I already have an account',

  'auth.loginTitle': 'Log in',
  'auth.registerTitle': 'Create an account',
  'auth.registerHint': 'Your progress from this browser will move over to the account.',
  'auth.loginHint': 'Get your Elo and solved puzzles back on any device.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.passwordHint': 'at least 6 characters',
  'auth.haveAccount': 'Already have an account?',
  'auth.noAccount': "Don't have an account?",
  'auth.err.credentials': 'Wrong email or password.',
  'auth.err.exists': 'An account with this email already exists. Log in instead.',
  'auth.err.short': 'Password must be at least 6 characters.',
  'auth.err.email': "That doesn't look like a valid email address.",
};

const DICT: Record<Lang, Record<string, string>> = { pl: PL, en: EN };
export type TKey = keyof typeof PL;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
  cards: (n: number) => string;
  freeLeft: (n: number) => string;
  solvedWithoutAccount: (n: number) => string;
  matchesPlayed: (played: number, total: number) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
    document.documentElement.lang = l;
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
    matchesPlayed: (played, total) =>
      lang === 'pl' ? `Rozegrano ${played}/${total} meczów` : `${played}/${total} matches played`,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n poza I18nProvider');
  return ctx;
}
