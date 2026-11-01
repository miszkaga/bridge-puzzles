import { useI18n, type Lang } from '@/lib/i18n';

const LANGS: { code: Lang; label: string }[] = [
  { code: 'pl', label: 'PL' },
  { code: 'en', label: 'EN' },
];

/** Przełącznik języka. Wybór zapisuje się w przeglądarce i wygrywa z jej ustawieniem. */
export default function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div className={`flex overflow-hidden rounded-lg border border-slate-600 ${className}`}>
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`px-2.5 py-1.5 text-xs font-bold transition ${
            lang === code ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
