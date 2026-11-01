import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { LogOut, Lock } from 'lucide-react';
import BiddingView from '@/components/BiddingView';
import TableView from '@/components/TableView';
import { apiFetch, getUserId, RegistrationRequired } from '@/lib/api';
import { useI18n, type TKey } from '@/lib/i18n';
import LangSwitch from '@/components/LangSwitch';


/** Ekran pokazywany, gdy gość wyczerpał pulę zadań bez konta. */
function RegistrationWall({ wall }: { wall: RegistrationRequired }) {
  const { t, solvedWithoutAccount } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800/80 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
          <Lock size={30} />
        </div>
        <h2 className="text-2xl font-extrabold text-white">{t('wall.title')}</h2>
        <p className="mt-3 text-slate-300">
          {solvedWithoutAccount(wall.solved)} {t('wall.body')}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            to="/auth?mode=register"
            className="rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-500"
          >
            {t('nav.register')}
          </Link>
          <Link
            to="/auth"
            className="rounded-xl border border-slate-600 py-3 font-bold text-slate-200 transition hover:bg-slate-700"
          >
            {t('wall.haveAccount')}
          </Link>
          <Link to="/" className="py-2 text-sm text-slate-400 transition hover:text-white">
            {t('nav.backToMenu')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Game() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const mode = params.get('mode') ?? 'play';
  const modeLabel = t((`mode.${mode}` as TKey)) || t('mode.default');
  const isBidding = mode === 'bidding' || mode === 'pair-bidding';

  const [puzzle, setPuzzle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wall, setWall] = useState<RegistrationRequired | null>(null);

  // Kolejne zadanie pobieramy w miejscu, bez przeładowania strony — przeładowanie
  // wyrzucało całą aplikację i budowało ją od zera, co kosztowało sekundy.
  const fetchPuzzle = useCallback(async () => {
    try {
      setLoading(true);
      setWall(null);
      setError(null);
      // user_id pozwala serwerowi podać najpierw to, czego gracz jeszcze nie widział
      const response = await apiFetch(`/api/puzzles/random?mode=${mode}&user_id=${getUserId()}`);
      if (!response.ok) throw new Error('Błąd pobierania danych z serwera');

      const data = await response.json();
      setPuzzle(data);
    } catch (err: any) {
      if (err instanceof RegistrationRequired) setWall(err);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { fetchPuzzle(); }, [fetchPuzzle]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white text-xl">{t('game.shuffling')}</div>;
  if (wall) return <RegistrationWall wall={wall} />;
  if (error) return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-red-500 text-xl">{t('game.error')}: {error}</div>;

  return (
    <div className={`flex min-h-screen flex-col ${isBidding ? 'bg-slate-900' : 'bg-green-800'}`}>
      <header className={`flex items-center justify-between px-4 py-4 shadow-lg sm:px-6 ${isBidding ? 'bg-slate-800' : 'bg-emerald-950/70'}`}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <span className={`rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wider ${isBidding ? 'bg-slate-700 text-slate-200' : 'bg-emerald-700 text-emerald-50'}`}>
            {t('game.mode')}: {modeLabel}
          </span>
          <span className={`text-sm font-semibold sm:text-lg ${isBidding ? 'text-slate-100' : 'text-emerald-50'}`}>
            {isBidding
              ? t('game.biddingHeader')
              : `${t('game.contract')}: ${puzzle?.contract ?? '—'} | ${t('game.declarer')}: ${puzzle?.declarer ?? '—'}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
        <LangSwitch />
        <button
          onClick={() => navigate('/')}
          className={`flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors sm:px-4 ${isBidding ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-700 hover:bg-emerald-600'}`}
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">{t('game.exit')}</span>
        </button>
        </div>
      </header>

      {/* Wstrzykiwanie całego obiektu puzzle do TableView */}
      {isBidding ? (
        <BiddingView 
          hand={puzzle?.solution_tree?.hands?.S} 
          solutionTree={puzzle?.solution_tree?.solution_tree} 
        />
      ) : (
        <TableView
          puzzle={puzzle}
          onNext={fetchPuzzle}
        />
      )}
    </div>
  );
}
