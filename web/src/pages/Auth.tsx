import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useI18n, type TKey } from '@/lib/i18n';
import LangSwitch from '@/components/LangSwitch';

type Mode = 'login' | 'register';

// Supabase zwraca komunikaty po angielsku — mapujemy te, które gracz realnie zobaczy
const MESSAGES: Record<string, TKey> = {
  'Invalid login credentials': 'auth.err.credentials',
  'User already registered': 'auth.err.exists',
  'Password should be at least 6 characters.': 'auth.err.short',
  'Unable to validate email address: invalid format': 'auth.err.email',
};

export default function Auth() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const { error: authError } = isRegister
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (authError) {
      const key = MESSAGES[authError.message];
      setError(key ? t(key) : authError.message);
      return;
    }
    // Backend dopnie anonimowy postęp do konta przy pierwszym żądaniu z tokenem
    navigate('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} /> {t('nav.backToMenu')}
        </Link>
        <LangSwitch />
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-8 shadow-2xl">
          <h1 className="text-2xl font-extrabold text-white">
            {isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {isRegister
              ? t('auth.registerHint')
              : t('auth.loginHint')}
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('auth.email')}</span>
              <div className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 focus-within:border-emerald-500">
                <Mail size={18} className="text-slate-500" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent py-3 text-white outline-none placeholder:text-slate-600"
                  placeholder="ty@example.com"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('auth.password')}</span>
              <div className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 focus-within:border-emerald-500">
                <Lock size={18} className="text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent py-3 text-white outline-none placeholder:text-slate-600"
                  placeholder={isRegister ? t('auth.passwordHint') : ''}
                />
              </div>
            </label>

            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy && <Loader2 size={18} className="animate-spin" />}
              {isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
            <button
              onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(null); }}
              className="font-bold text-emerald-400 transition hover:text-emerald-300"
            >
              {isRegister ? t('auth.loginTitle') : t('auth.registerTitle')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
