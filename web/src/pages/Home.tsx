import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Puzzle, FileStack, CalendarDays, Swords, MessageSquare,
  Trophy, Flame, TrendingUp, Shield, ArrowRight, Crown, LogOut,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { apiFetch, getUserId } from '@/lib/api';
import { useI18n, type TKey } from '@/lib/i18n';
import LangSwitch from '@/components/LangSwitch';

/** Stan rankingu gracza — Elo, ile zadań rozwiązano, czy kalibracja się skończyła. */
function useRankStats() {
  const { session } = useSession();
  const [stats, setStats] = useState<{ state: RankState; elo: number | null; played: number; total: number }>({
    state: 'calibrating', elo: null, played: 0, total: 10,
  });

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/user/stats?user_id=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session]);

  return stats;
}

/* ---------- Rank section ---------- */

type RankState = 'calibrating' | 'ranked';

function RankSection({ state, elo, played, total }: {
  state: RankState; elo?: number; played?: number; total?: number;
}) {
  const { t, matchesPlayed } = useI18n();
  const pct = state === 'calibrating' && played && total ? Math.round((played / total) * 100) : 0;

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-800/70 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${state === 'ranked' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
          <Crown size={30} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t('home.rank')}</p>
          {state === 'ranked' ? (
            <p className="text-2xl font-extrabold text-white">Elo <span className="text-amber-400">{elo}</span></p>
          ) : (
            <p className="text-lg font-bold text-slate-200">{t('home.calibrating')}</p>
          )}
        </div>
      </div>

      {state === 'calibrating' ? (
        <div className="flex-1 sm:max-w-xs">
          <div className="mb-1.5 flex justify-between text-xs text-slate-400">
            <span>{matchesPlayed(played ?? 0, total ?? 0)}</span>
            <span>{t('home.earnRank')}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-700">
            <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <TrendingUp size={18} className="text-emerald-400" />
          <span>{t('home.topPlayers')}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Gamification top bar ---------- */

/** Pasek konta: adres e-mail i wylogowanie albo zachęta do rejestracji. */
function AccountBar() {
  const { session, email, loading } = useSession();
  const { t } = useI18n();
  if (loading) return null;

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link to="/auth" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white">
          {t('nav.login')}
        </Link>
        <Link to="/auth?mode=register" className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-emerald-500">
          {t('nav.register')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-slate-300 sm:inline">{email}</span>
      <button
        onClick={() => supabase.auth.signOut()}
        title={t('nav.logout')}
        className="rounded-lg border border-slate-600 p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}

function GamificationBar() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3.5 py-2">
        <Flame size={20} className="text-orange-400" />
        <span className="text-sm font-extrabold text-orange-300">5</span>
        <span className="hidden text-xs text-orange-300/70 sm:inline">{t('home.streak')}</span>
      </div>

      <div className="flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-3 py-2" title="Elo Boost">
        <TrendingUp size={18} className="text-emerald-400" />
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-3 py-2" title={t('home.safetyNet')}>
        <Shield size={18} className="text-blue-400" />
      </div>
    </div>
  );
}

/* ---------- Mode tiles ---------- */

type Accent = 'dark' | 'gold' | 'soon';

type ModeTileProps = {
  title: string;
  subtitle: string;
  icon: typeof Puzzle;
  mode: string;
  accent: Accent;
};

function ModeTile({ title, subtitle, icon: Icon, mode, accent }: ModeTileProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const isSoon = accent === 'soon';

  const styles: Record<Accent, string> = {
    dark: 'bg-slate-800/90 border border-slate-700 hover:border-slate-500',
    gold: 'bg-gradient-to-br from-amber-500/20 to-amber-700/10 border-2 border-amber-400/70 hover:border-amber-300',
    soon: 'bg-slate-800/40 border border-slate-700/50 cursor-not-allowed',
  };

  const iconWrap: Record<Accent, string> = {
    dark: 'bg-slate-700 text-white group-hover:bg-slate-600',
    gold: 'bg-amber-500/30 text-amber-300 group-hover:bg-amber-500/40',
    soon: 'bg-slate-700/60 text-slate-500',
  };

  return (
    <button
      onClick={() => !isSoon && navigate(`/game?mode=${mode}`)}
      disabled={isSoon}
      className={`group relative flex flex-col items-center justify-center gap-4 rounded-2xl p-7 text-center shadow-xl transition-all duration-300 ${styles[accent]} ${!isSoon && 'hover:scale-[1.03] hover:shadow-2xl'}`}
    >
      {isSoon && (
        <span className="absolute right-3 top-3 rounded-full bg-slate-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {t('home.soon')}
        </span>
      )}
      <div className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300 ${iconWrap[accent]}`}>
        <Icon size={30} strokeWidth={2} />
      </div>
      <div>
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {!isSoon && (
        <ArrowRight
          size={18}
          className="absolute top-5 right-5 text-slate-500 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100"
        />
      )}
    </button>
  );
}

/* ---------- Page ---------- */

export default function Home() {
  const { t } = useI18n();
  const rank = useRankStats();
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-4 py-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8">
        {/* Header + gamification */}
        <header className="flex w-full flex-col items-center gap-5">
          <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Bridge <span className="text-emerald-400">Puzzles</span>
            </h1>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <GamificationBar />
              <AccountBar />
              <LangSwitch />
            </div>
          </div>
          <p className="text-center text-base text-slate-300">
{t('home.tagline')}
          </p>
        </header>

        {/* Rank section */}
        <RankSection state={rank.state} elo={rank.elo ?? undefined} played={rank.played} total={rank.total} />

        {/* Mode tiles */}
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ModeTile title={t('tile.puzzle')} subtitle={t('tile.puzzle.sub')} icon={Puzzle} mode="puzzle" accent="dark" />
          <ModeTile title={t('tile.defense')} subtitle={t('tile.defense.sub')} icon={Shield} mode="defense" accent="dark" />
          <ModeTile title={t('tile.problem')} subtitle={t('tile.problem.sub')} icon={FileStack} mode="problem" accent="dark" />
          <ModeTile title={t('tile.daily')} subtitle={t('tile.daily.sub')} icon={CalendarDays} mode="daily" accent="gold" />
          <ModeTile title={t('tile.ranked')} subtitle={t('tile.ranked.sub')} icon={Swords} mode="ranked" accent="soon" />
          
          {/* ODBLOKOWANY KAFELEK - Zmiana accent na "dark" */}
          <ModeTile title={t('tile.pairBidding')} subtitle={t('tile.pairBidding.sub')} icon={MessageSquare} mode="pair-bidding" accent="dark" />
          
          <ModeTile title={t('tile.leaderboard')} subtitle={t('tile.leaderboard.sub')} icon={Trophy} mode="leaderboard" accent="dark" />
        </div>
      </div>
    </div>
  );
}
