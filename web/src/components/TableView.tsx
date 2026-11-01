import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trophy, XCircle, ArrowRight, X, BookOpen } from 'lucide-react';
import PlayingCard from '@/components/PlayingCard';
import { apiFetch, getUserId } from '@/lib/api';
import { useI18n, type TKey } from '@/lib/i18n';

type Seat = 'N' | 'E' | 'S' | 'W';
type PlacedCard = { code: string; position: Seat };
type Slots = { top: Seat; bottom: Seat; left: Seat; right: Seat };

/**
 * Tempo animacji w ms. Dokładka przeciwnika jest jedyną informacją, na którą
 * gracz musi zdążyć spojrzeć — reszta to czysty przestój, więc trzymamy ją krótko.
 */
const TIMING = {
  replyDrop: 110,   // od naszego kliknięcia do wyłożenia karty przeciwnika
  replyRead: 320,   // ile jeszcze widać stół, zanim ruszymy dalej
  summary: 220,     // od ostatniej karty do podsumowania
};

const SEATS: Seat[] = ['N', 'E', 'S', 'W'];
const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const emptyHands = (): Record<Seat, string[]> => ({ N: [], E: [], S: [], W: [] });

/**
 * Gracz siedzi na dole, a pozostałe pozycje układają się zgodnie z ruchem
 * wskazówek zegara: dół → lewo → góra → prawo. Dzięki temu partnerzy zawsze
 * siedzą naprzeciw siebie (N-S oraz E-W), a gracz po lewej dokłada po nas.
 */
function resolveSlots(hero: Seat): Slots {
  const i = SEATS.indexOf(hero);
  return {
    bottom: hero,
    left: SEATS[(i + 1) % 4],
    top: SEATS[(i + 2) % 4],
    right: SEATS[(i + 3) % 4],
  };
}

function seatKey(seat: Seat, hero: Seat, dummy: Seat, declarer: Seat, isDefense: boolean): TKey {
  if (seat === hero) return 'seat.you';
  if (seat === dummy) return 'seat.dummy';
  if (seat === declarer) return 'seat.declarer';
  return isDefense ? 'seat.partner' : 'seat.defence';
}

// Karty nachodzą na siebie w poziomie, o połowę szerokości — jeden kolor leży
// wtedy w jednej linii na osi X. Ręce boczne są mniejsze, żeby zmieściły się
// w węższej kolumnie obok stołu.
const FAN_OVERLAP: Record<'lg' | 'xl', string> = { lg: '-ml-12', xl: '-ml-14' };

function HandFan({ cards, label, note, rotate, size = 'xl', className = '', faceDown, onCardClick, disabled }: {
  cards: string[]; label: string; note?: string; rotate?: boolean; size?: 'lg' | 'xl';
  className?: string; faceDown?: boolean; onCardClick?: (code: string) => void; disabled?: boolean;
}) {
  const clickable = !!onCardClick && !disabled;
  const caption = (
    <div className="flex flex-col items-center gap-1">
      <p className="text-sm font-bold uppercase tracking-widest text-emerald-300/80">{label}</p>
      {note && <span className="text-xs text-emerald-300/60">{note}</span>}
    </div>
  );

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {!rotate && caption}
      <div className="flex justify-center">
        {cards.map((code, i) => (
          <PlayingCard
            key={code}
            code={code}
            size={size}
            faceDown={faceDown}
            hover={clickable}
            className={`${i > 0 ? FAN_OVERLAP[size] : ''} ${disabled ? 'cursor-not-allowed' : ''}`}
            onClick={() => { if (clickable) onCardClick!(code); }}
          />
        ))}
      </div>
      {rotate && caption}
    </div>
  );
}

function TrickArea({ trick, slots }: { trick: PlacedCard[]; slots: Slots }) {
  const placed: Record<Seat, PlacedCard | null> = { N: null, E: null, S: null, W: null };
  trick.forEach((c) => { placed[c.position] = c; });

  const cell = 'flex items-center justify-center';
  const slot = (seat: Seat) =>
    placed[seat] ? <PlayingCard code={placed[seat]!.code} size="xl" /> : <Placeholder />;

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-4 rounded-[2.5rem] bg-emerald-900/40 p-6 shadow-inner border-2 border-emerald-700/30 backdrop-blur-sm">
      <div className={cell} />
      <div className={cell}>{slot(slots.top)}</div>
      <div className={cell} />
      <div className={cell}>{slot(slots.left)}</div>
      <div className={cell}>
        <div className="h-6 w-6 rounded-full border-2 border-emerald-500/50 bg-emerald-700/40 shadow-inner" />
      </div>
      <div className={cell}>{slot(slots.right)}</div>
      <div className={cell} />
      <div className={cell}>{slot(slots.bottom)}</div>
      <div className={cell} />
    </div>
  );
}

function Placeholder() {
  return <div className="w-28 h-40 rounded-xl border-2 border-dashed border-emerald-700/40 bg-emerald-800/10" />;
}

export default function TableView({ puzzle, onNext }: { puzzle?: any; onNext?: () => void }) {
  const navigate = useNavigate();
  const { t, cards, freeLeft: freeLeftText } = useI18n();
  const puzzleId = puzzle?.id;

  const tree = puzzle?.solution_tree ?? {};
  const declarerSeat: Seat = (tree.declarer ?? puzzle?.declarer ?? 'S') as Seat;
  const defenderSeat: Seat | null = (tree.defender ?? null) as Seat | null;
  const isDefense = !!defenderSeat;
  const heroSeat: Seat = defenderSeat ?? declarerSeat;
  const dummySeat: Seat = PARTNER[declarerSeat];
  const slots = resolveSlots(heroSeat);
  // Broniąc gramy wyłącznie własną ręką — dziadek należy do przeciwnika.
  const playableSeats: Seat[] = isDefense ? [heroSeat] : [heroSeat, dummySeat];

  const [hands, setHands] = useState<Record<Seat, string[]>>(emptyHands);
  const [trick, setTrick] = useState<PlacedCard[]>([]);
  const [movePath, setMovePath] = useState<string[]>([]);
  const [playedCodes, setPlayedCodes] = useState<string[]>([]);

  const [isWaiting, setIsWaiting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [finalMessage, setFinalMessage] = useState<string | null>(null);
  const [eloResult, setEloResult] = useState<any>(null);
  // Ile zadań bez konta jeszcze zostało; null gdy gracz jest zalogowany
  const [freeLeft, setFreeLeft] = useState<number | null>(null);
  // Podsumowanie da się zamknąć, żeby obejrzeć odkryte rozdanie
  const [showSummary, setShowSummary] = useState(true);
  const [revealAll, setRevealAll] = useState(false);

  useEffect(() => {
    if (!puzzle) return;

    const historyLog: string[] = tree.history || [];
    const played = historyLog.map((entry: string) => entry.split(':')[1]);

    const next = emptyHands();
    for (const seat of SEATS) {
      next[seat] = (tree.hands?.[seat] || []).filter((c: string) => !played.includes(c));
    }
    setHands(next);
    setPlayedCodes(played);

    setTrick(historyLog.map((entry: string) => {
      const [pos, code] = entry.split(':');
      return { position: pos as Seat, code };
    }));

    setMovePath([]);
    setFeedback(null);
    setIsWaiting(false);
    setIsFinished(false);
    setFinalMessage(null);
    setEloResult(null);
    setShowSummary(true);
    setRevealAll(false);
  }, [puzzle]);

  const handlePlayCard = async (code: string, seat: Seat) => {
    if (isWaiting || !puzzleId || isFinished) return;
    setIsWaiting(true);
    setFeedback(null);

    setTrick((prev) => (prev.length >= 4 ? [{ code, position: seat }] : [...prev, { code, position: seat }]));
    setHands((prev) => ({ ...prev, [seat]: prev[seat].filter((c) => c !== code) }));

    const newPath = [...movePath, code];
    setMovePath(newPath);
    const playedNow = [...playedCodes, code];
    setPlayedCodes(playedNow);

    try {
      const res = await apiFetch('/api/puzzles/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle_id: puzzleId, user_id: getUserId(), move_path: newPath }),
      });
      const result = await res.json();

      const reply: PlacedCard | null = result.auto_reply
        ? { code: result.auto_reply.card, position: result.auto_reply.seat as Seat }
        : null;

      // Czas potrzebny, by gracz zobaczył dokładkę przeciwnika. Bez niej nie ma na co czekać.
      const revealDelay = reply ? TIMING.replyRead : 0;
      const allPlayed = reply ? [...playedNow, reply.code] : playedNow;

      if (reply) {
        setTimeout(() => {
          setTrick((prev) => (prev.length >= 4 ? [reply] : [...prev, reply]));
          setHands((prev) => ({ ...prev, [reply.position]: prev[reply.position].filter((c) => c !== reply.code) }));
          setPlayedCodes(allPlayed);
        }, TIMING.replyDrop);
      }

      if (result.finished) {
        // Odpalone od razu, żeby dwie rundy do Supabase leciały równolegle
        // z animacją odsłaniania rozdania, a nie przed nią.
        const settlePromise = apiFetch('/api/puzzles/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ puzzle_id: puzzleId, user_id: getUserId(), move_path: newPath }),
        }).then((r) => r.json()).catch(() => null);

        setTimeout(async () => {
          // Po zakończeniu serwer dosyła komplet rąk — odkrywamy całe rozdanie
          if (result.hands) {
            const full = emptyHands();
            for (const seat of SEATS) {
              full[seat] = (result.hands[seat] || []).filter((c: string) => !allPlayed.includes(c));
            }
            setHands(full);
            setRevealAll(true);
          }
          setIsSuccess(result.is_correct);
          setFinalMessage(result.message ?? null);

          const settled = await settlePromise;
          setEloResult(settled?.result ?? null);
          setFreeLeft(typeof settled?.free_left === 'number' ? settled.free_left : null);
          setIsFinished(true);
          setShowSummary(true);
        }, revealDelay + TIMING.summary);
        return;
      }

      if (result.message) {
        setTimeout(() => {
          setFeedback({ type: result.is_correct ? 'success' : 'error', text: result.message });
        }, revealDelay);
      }
      setTimeout(() => setIsWaiting(false), revealDelay);
    } catch (error) {
      setFeedback({ type: 'error', text: t('table.connectionError') });
      setIsWaiting(false);
    }
  };

  const labelFor = (seat: Seat) => `${t(seatKey(seat, heroSeat, dummySeat, declarerSeat, isDefense))} (${seat})`;
  // Serwer przysyła tylko te ręce, które gracz ma prawo widzieć — do końca zagadki
  const isVisible = (seat: Seat) => revealAll || Array.isArray(tree.hands?.[seat]);
  const clickHandler = (seat: Seat) =>
    playableSeats.includes(seat) && !isFinished ? (code: string) => handlePlayCard(code, seat) : undefined;

  // Zakryte ręce pokazujemy rewersem do góry, tak jak przy stole
  const backsFor = (seat: Seat) =>
    Array.from({ length: tree.hand_counts?.[seat] ?? 0 }, (_, i) => `back-${seat}-${i}`);

  const renderHand = (seat: Seat, opts: { size?: 'lg' | 'xl'; rotate?: boolean; className?: string }) => {
    const shown = isVisible(seat);
    const count = shown ? hands[seat].length : (tree.hand_counts?.[seat] ?? 0);
    return (
      <HandFan
        cards={shown ? hands[seat] : backsFor(seat)}
        label={labelFor(seat)}
        note={cards(count)}
        faceDown={!shown}
        size={opts.size}
        rotate={opts.rotate}
        className={opts.className}
        onCardClick={shown ? clickHandler(seat) : undefined}
        disabled={isWaiting || isFinished}
      />
    );
  };

  return (
    <div className="relative flex flex-1 flex-col gap-4 p-4 min-h-0 lg:flex-row">

      {/* Stół. Gdy panel wyniku jest otwarty, ta kolumna po prostu się zwęża. */}
      <div className="flex flex-1 min-w-0 flex-col items-center justify-between gap-6">
        {feedback && !isFinished && (
          <div className={`absolute top-1/4 z-40 px-8 py-3 rounded-2xl font-bold text-lg shadow-2xl animate-bounce ${feedback.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-500 text-white'}`}>
            {feedback.text}
          </div>
        )}

        {renderHand(slots.top, {})}

        <div className="flex w-full max-w-[1200px] items-center justify-between gap-8 flex-1 min-h-0">
          {renderHand(slots.left, { size: 'lg', className: 'flex-1' })}
          <TrickArea trick={trick} slots={slots} />
          {renderHand(slots.right, { size: 'lg', className: 'flex-1' })}
        </div>

        {renderHand(slots.bottom, { rotate: true })}
      </div>

      {/* Pasek po zamknięciu podsumowania — pozwala wrócić do wyjaśnienia */}
      {isFinished && !showSummary && (
        <div className="absolute top-2 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-2 shadow-xl backdrop-blur-sm">
          <span className={`text-sm font-bold ${isSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
            {isSuccess ? t('table.solvedShort') : t('table.wrongShort')}
          </span>
          <button
            onClick={() => setShowSummary(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-600"
          >
            <BookOpen size={14} /> {t('table.explanation')}
          </button>
          <button
            onClick={() => onNext?.()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
          >
            {t('table.next')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-600"
          >
            {t('nav.menu')}
          </button>
        </div>
      )}

      {/* Panel wyniku jest osobną kolumną, nie nakładką — plansza zwęża się o jego
          szerokość, dzięki czemu całe rozdanie widać bez zamykania czegokolwiek. */}
      {isFinished && showSummary && (
        <aside className="w-full shrink-0 self-stretch lg:w-[26rem]">
          <div className="relative flex flex-col gap-4 rounded-2xl border border-slate-600 bg-slate-800 p-5 shadow-2xl">
            <button
              onClick={() => setShowSummary(false)}
              aria-label={t('table.hideSummary')}
              className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 pr-8">
              {isSuccess ? (
                <div className="rounded-full bg-emerald-500/20 p-2.5 text-emerald-400">
                  <Trophy size={24} />
                </div>
              ) : (
                <div className="rounded-full bg-red-500/20 p-2.5 text-red-400">
                  <XCircle size={24} />
                </div>
              )}
              <h2 className="text-xl font-extrabold text-white">
                {isSuccess ? t('table.solved') : t('table.wrong')}
              </h2>
            </div>

            {finalMessage && (
              <p className="max-h-[22rem] overflow-y-auto text-[0.95rem] leading-relaxed text-slate-200">{finalMessage}</p>
            )}

            {eloResult?.already_played ? (
              <p className="text-sm text-slate-400">{t('table.alreadyPlayed')}</p>
            ) : eloResult && eloResult.elo_change !== undefined ? (
              <div className="flex items-baseline justify-between rounded-xl bg-slate-900/60 px-4 py-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Elo</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-slate-400">{eloResult.old_elo}</span>
                  <ArrowRight className="self-center text-slate-600" size={14} />
                  <span className="text-xl font-black text-white">{eloResult.new_elo}</span>
                  <span className={`text-sm font-bold ${eloResult.elo_change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {eloResult.elo_change > 0 ? '+' : ''}{eloResult.elo_change}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">{t('table.noChange')}</p>
            )}

            {freeLeft !== null && (
              <p className={`text-xs leading-relaxed ${freeLeft <= 3 ? 'text-amber-400' : 'text-slate-400'}`}>
                {freeLeft > 0 ? t('table.freeLeftPrefix') : t('table.freeLastOne')}
                {freeLeft > 0 && <span className="font-bold"> {freeLeftText(freeLeft)}</span>}
                {'. '}
                <Link to="/auth?mode=register" className="font-bold text-emerald-400 hover:text-emerald-300">
                  {t('nav.register')}
                </Link>
                {freeLeft > 0 ? t('table.freeKeepProgress') : t('table.freeKeepPlaying')}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => onNext?.()}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500"
              >
                {t('table.nextPuzzle')}
              </button>
              <button
                onClick={() => navigate('/')}
                className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
              >
                {t('nav.menu')}
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
