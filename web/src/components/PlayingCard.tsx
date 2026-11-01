import { Spade, Heart, Diamond, Club } from 'lucide-react';
import { useI18n, rankLabel } from '@/lib/i18n';

export type Suit = 'S' | 'H' | 'D' | 'C';

const SUIT_META: Record<Suit, { Icon: typeof Spade; color: string }> = {
  S: { Icon: Spade,   color: 'text-slate-900' },
  H: { Icon: Heart,   color: 'text-red-600'   },
  D: { Icon: Diamond, color: 'text-red-600'   },
  C: { Icon: Club,    color: 'text-slate-900' },
};

export function parseCardCode(code: string): { suit: Suit; rank: string } {
  return { suit: code[0] as Suit, rank: code.slice(1) };
}

// DODANO: nowy rozmiar 'xl' dla dużych ekranów
type Size = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  code: string;
  size?: Size;
  hover?: boolean;
  className?: string;
  /** Karta leżąca rewersem do góry — tak jak ręce przeciwników przy stole. */
  faceDown?: boolean;
  onClick?: () => void;
};

// Zaktualizowane wymiary
const DIM: Record<Size, { card: string; corner: string; cornerIcon: number; centerIcon: number }> = {
  sm: { card: 'w-14 h-20',  corner: 'text-sm',  cornerIcon: 12, centerIcon: 20 },
  md: { card: 'w-20 h-28',  corner: 'text-base', cornerIcon: 14, centerIcon: 28 },
  lg: { card: 'w-24 h-36',  corner: 'text-xl',  cornerIcon: 18, centerIcon: 36 },
  xl: { card: 'w-28 h-40',  corner: 'text-2xl', cornerIcon: 22, centerIcon: 48 }, // OGROMNE KARTY
};

export default function PlayingCard({ code, size = 'xl', hover = false, className = '', faceDown = false, onClick }: Props) {
  const { lang } = useI18n();
  const d = DIM[size];

  const frame = [
    'relative rounded-xl border shadow-md font-bold select-none flex-shrink-0',
    'transition-all duration-150 ease-out',
    d.card,
    hover ? 'hover:-translate-y-8 hover:z-50 hover:shadow-2xl cursor-pointer' : '',
    className,
  ];

  // Rewers nie ma koloru ani wartości, więc kodu karty nawet nie parsujemy
  if (faceDown) {
    return (
      <div onClick={onClick} className={[...frame, 'border-blue-300/30 bg-gradient-to-br from-blue-800 to-blue-950'].join(' ')}>
        <div
          className="absolute inset-1.5 rounded-lg border border-blue-300/25"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent 0 5px, rgba(255,255,255,0.10) 5px 10px)',
          }}
        />
      </div>
    );
  }

  const { suit, rank: dbRank } = parseCardCode(code);
  // Baza trzyma A K Q J; polski brydżysta czyta Damę i Waleta jako D i W
  const rank = rankLabel(dbRank, lang);
  const { Icon, color } = SUIT_META[suit];

  return (
    <div
      onClick={onClick}
      className={[...frame, 'bg-white border-gray-200'].join(' ')}
    >
      <div className="absolute top-1.5 left-2 flex flex-col items-center leading-none gap-0.5">
        <span className={`${d.corner} font-extrabold leading-none ${color}`}>{rank}</span>
        <Icon className={color} size={d.cornerIcon} strokeWidth={2.5} />
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className={`${color} opacity-90`} size={d.centerIcon} strokeWidth={2} />
      </div>

      <div className="absolute bottom-1.5 right-2 flex flex-col items-center leading-none gap-0.5 rotate-180">
        <span className={`${d.corner} font-extrabold leading-none ${color}`}>{rank}</span>
        <Icon className={color} size={d.cornerIcon} strokeWidth={2.5} />
      </div>
    </div>
  );
}
