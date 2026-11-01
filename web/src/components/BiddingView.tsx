import { useState } from 'react';

type Suit = 'C' | 'D' | 'H' | 'S' | 'N';
type CardSuit = 'S' | 'H' | 'D' | 'C';

const SUITS: Suit[] = ['C', 'D', 'H', 'S', 'N'];

const SUIT_STYLE: Record<Suit, { symbol: string; btn: string }> = {
  C: { symbol: '♣',  btn: 'bg-emerald-600 hover:bg-emerald-500' },
  D: { symbol: '♦',  btn: 'bg-orange-500  hover:bg-orange-400'  },
  H: { symbol: '♥',  btn: 'bg-red-600     hover:bg-red-500'     },
  S: { symbol: '♠',  btn: 'bg-blue-600    hover:bg-blue-500'    },
  N: { symbol: 'NT', btn: 'bg-slate-600   hover:bg-slate-500'   },
};

const CARD_SUIT_COLOR: Record<CardSuit, string> = {
  S: 'text-blue-600',
  H: 'text-red-600',
  D: 'text-orange-500',
  C: 'text-emerald-600',
};

const CARD_SUIT_SYMBOL: Record<CardSuit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

type BidEntry = { seat: 'W' | 'N' | 'E' | 'S'; bid: string };

// Symulowana historia licytacji (tymczasowa)
const MOCK_HISTORY: BidEntry[] = [
  { seat: 'W', bid: '1♠' },
  { seat: 'N', bid: 'PASS' },
  { seat: 'E', bid: '2♥' },
  { seat: 'S', bid: '?' },
];

const SEATS: ('W' | 'N' | 'E' | 'S')[] = ['W', 'N', 'E', 'S'];

function BiddingHistory() {
  const rows: (string | null)[][] = [];
  let current: (string | null)[] = [null, null, null, null];
  MOCK_HISTORY.forEach((entry) => {
    current[SEATS.indexOf(entry.seat)] = entry.bid;
    if (entry.seat === 'S') {
      rows.push([...current]);
      current = [null, null, null, null];
    }
  });
  if (current.some((c) => c !== null)) rows.push([...current]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/80 shadow-lg overflow-hidden w-full max-w-lg">
      <div className="grid grid-cols-4 bg-slate-700/80">
        {SEATS.map((s) => (
          <div key={s} className="px-4 py-2 text-center text-sm font-bold tracking-widest text-slate-300">
            {s}
          </div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-4 border-t border-slate-700/50">
          {row.map((cell, ci) => (
            <div
              key={ci}
              className={`px-4 py-3 text-center text-base font-semibold ${
                cell === 'PASS' ? 'text-slate-400' :
                cell === 'X'   ? 'text-red-400' :
                cell === 'XX'  ? 'text-blue-400' :
                cell === '?'   ? 'text-amber-400 animate-pulse' :
                'text-white'
              }`}
            >
              {cell ?? ''}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function groupBySuit(hand: string[]): CardSuit[] {
  const order: CardSuit[] = ['S', 'H', 'D', 'C'];
  return order.filter((s) => hand.some((c) => c[0] === s));
}

// Zmiana rozmiaru fontu: text-4xl z responsywnym sm:text-5xl
function HandChip({ code }: { code: string }) {
  const suit = code[0] as CardSuit;
  const rank = code.slice(1);
  return (
    <span className="flex items-baseline gap-1 text-4xl sm:text-5xl font-extrabold leading-none whitespace-nowrap">
      <span className="text-slate-900">{rank}</span>
      <span className={CARD_SUIT_COLOR[suit]}>{CARD_SUIT_SYMBOL[suit]}</span>
    </span>
  );
}

export default function BiddingView({ hand, solutionTree }: { hand?: string[], solutionTree?: any }) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [lastBid, setLastBid] = useState<string | null>(null);

  const currentHand = hand || [];

  function placeBid(suit: Suit) {
    if (!selectedLevel) return;
    setLastBid(`${selectedLevel}${SUIT_STYLE[suit].symbol}`);
    setSelectedLevel(null);
  }

  function specialBid(label: string) {
    setLastBid(label);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-5 px-6 pt-6 pb-8">
      {/* Tabela historii licytacji */}
      <BiddingHistory />

      {/* Bidding Box */}
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-2xl">
        <div className="flex gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl === selectedLevel ? null : lvl)}
              className={`h-10 flex-1 rounded-lg text-lg font-extrabold transition-all duration-150 ${
                selectedLevel === lvl
                  ? 'bg-amber-400 text-slate-900 shadow-md scale-105'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {SUITS.map((suit) => (
            <button
              key={suit}
              onClick={() => placeBid(suit)}
              disabled={!selectedLevel}
              className={`h-12 flex-1 rounded-lg text-xl font-extrabold text-white transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${SUIT_STYLE[suit].btn}`}
            >
              {SUIT_STYLE[suit].symbol}
            </button>
          ))}
          <button
            onClick={() => specialBid('PASS')}
            className="h-12 w-24 rounded-lg bg-emerald-600 text-lg font-extrabold text-white transition-all duration-150 hover:bg-emerald-500 active:scale-95"
          >
            PASS
          </button>
        </div>

        <div className="mt-3 flex justify-center gap-3">
          <button
            onClick={() => specialBid('!')}
            className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
          >
            ! ALERT
          </button>
          <button
            onClick={() => specialBid('X')}
            className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500"
          >
            X
          </button>
          <button
            onClick={() => specialBid('XX')}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500"
          >
            XX
          </button>
        </div>
      </div>

      {lastBid && (
        <p className="text-base text-amber-400 font-semibold mb-2">
          Twoja odzywka: <span className="text-white">{lastBid}</span>
        </p>
      )}

      {/* Ręka gracza */}
      <div className="w-full max-w-4xl rounded-3xl bg-white px-10 py-8 shadow-2xl">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {groupBySuit(currentHand).map((suit, si) => {
            const suitCards = currentHand.filter((c) => c[0] === suit);
            return (
              <div key={suit} className={`flex items-center gap-3.5 ${si > 0 ? 'ml-2' : ''}`}>
                {suitCards.map((code) => (
                  <HandChip key={code} code={code} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
