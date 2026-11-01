import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HandFan, TrickArea, resolveSlots, SEATS, PARTNER, type Seat, type PlacedCard } from '../components/Table';
import { apiFetch, getUserId, RegistrationRequired } from '../lib/api';
import { useI18n, type TKey } from '../lib/i18n';
import { colors } from '../theme';

const TIMING = { replyDrop: 110, replyRead: 320, summary: 220 };
const emptyHands = (): Record<Seat, string[]> => ({ N: [], E: [], S: [], W: [] });

function seatKey(seat: Seat, hero: Seat, dummy: Seat, declarer: Seat, isDefense: boolean): TKey {
  if (seat === hero) return 'seat.you';
  if (seat === dummy) return 'seat.dummy';
  if (seat === declarer) return 'seat.declarer';
  return isDefense ? 'seat.partner' : 'seat.defence';
}

export default function GameScreen({ route, navigation }: any) {
  const mode: string = route.params?.mode ?? 'defense';
  const { t, cards, freeLeft: freeLeftText, solvedWithoutAccount } = useI18n();

  const [puzzle, setPuzzle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wall, setWall] = useState<RegistrationRequired | null>(null);

  const [hands, setHands] = useState<Record<Seat, string[]>>(emptyHands);
  const [trick, setTrick] = useState<PlacedCard[]>([]);
  const [movePath, setMovePath] = useState<string[]>([]);
  const [playedCodes, setPlayedCodes] = useState<string[]>([]);

  const [isWaiting, setIsWaiting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [finalMessage, setFinalMessage] = useState<string | null>(null);
  const [eloResult, setEloResult] = useState<any>(null);
  const [freeLeft, setFreeLeft] = useState<number | null>(null);
  const [revealAll, setRevealAll] = useState(false);

  const fetchPuzzle = useCallback(async () => {
    try {
      setLoading(true); setWall(null); setError(null);
      const uid = await getUserId();
      const res = await apiFetch(`/api/puzzles/random?mode=${mode}&user_id=${uid}`);
      if (!res.ok) throw new Error(t('game.error'));
      setPuzzle(await res.json());
    } catch (err: any) {
      if (err instanceof RegistrationRequired) setWall(err);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode, t]);

  useEffect(() => { fetchPuzzle(); }, [fetchPuzzle]);

  const tree = puzzle?.solution_tree ?? {};
  const declarerSeat: Seat = (tree.declarer ?? 'S') as Seat;
  const defenderSeat: Seat | null = (tree.defender ?? null) as Seat | null;
  const isDefense = !!defenderSeat;
  const heroSeat: Seat = defenderSeat ?? declarerSeat;
  const dummySeat: Seat = PARTNER[declarerSeat];
  const slots = resolveSlots(heroSeat);
  const playableSeats: Seat[] = isDefense ? [heroSeat] : [heroSeat, dummySeat];

  useEffect(() => {
    if (!puzzle) return;
    const history: string[] = tree.history || [];
    const played = history.map((e) => e.split(':')[1]);

    const next = emptyHands();
    for (const seat of SEATS) next[seat] = (tree.hands?.[seat] || []).filter((c: string) => !played.includes(c));
    setHands(next);
    setPlayedCodes(played);
    setTrick(history.map((e) => { const [pos, code] = e.split(':'); return { position: pos as Seat, code }; }));

    setMovePath([]); setIsWaiting(false); setIsFinished(false);
    setFinalMessage(null); setEloResult(null); setFreeLeft(null); setRevealAll(false);
  }, [puzzle]);

  const playCard = async (code: string, seat: Seat) => {
    if (isWaiting || isFinished || !puzzle?.id) return;
    setIsWaiting(true);

    setTrick((prev) => (prev.length >= 4 ? [{ code, position: seat }] : [...prev, { code, position: seat }]));
    setHands((prev) => ({ ...prev, [seat]: prev[seat].filter((c) => c !== code) }));

    const newPath = [...movePath, code];
    setMovePath(newPath);
    const playedNow = [...playedCodes, code];
    setPlayedCodes(playedNow);

    try {
      const uid = await getUserId();
      const res = await apiFetch('/api/puzzles/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle_id: puzzle.id, user_id: uid, move_path: newPath }),
      });
      const result = await res.json();

      const reply: PlacedCard | null = result.auto_reply
        ? { code: result.auto_reply.card, position: result.auto_reply.seat as Seat }
        : null;
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
        setTimeout(() => {
          if (result.hands) {
            // Karty wracają do macierzystych rąk (bez odejmowania zagranej) —
            // oszczędza miejsce i nie trzeba już ściskać rąk przeciwników pod planszę.
            const full = emptyHands();
            for (const seat2 of SEATS) full[seat2] = result.hands[seat2] || [];
            setHands(full);
            setRevealAll(true);
          }
          setIsSuccess(result.is_correct);
          setFinalMessage(result.message ?? null);
          setEloResult(result.result ?? null);
          setFreeLeft(typeof result.free_left === 'number' ? result.free_left : null);
          setIsFinished(true);
        }, revealDelay + TIMING.summary);
        return;
      }
      setTimeout(() => setIsWaiting(false), revealDelay);
    } catch {
      setError(t('table.connectionError'));
      setIsWaiting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.emerald400} />
        <Text style={styles.dim}>{t('game.shuffling')}</Text>
      </SafeAreaView>
    );
  }

  if (wall) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.wallTitle}>{t('wall.title')}</Text>
        <Text style={styles.wallBody}>{solvedWithoutAccount(wall.solved)} {t('wall.body')}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Auth', { mode: 'register' })}>
          <Text style={styles.primaryBtnText}>{t('nav.register')}</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={() => navigation.navigate('Auth', { mode: 'login' })}>
          <Text style={styles.ghostBtnText}>{t('wall.haveAccount')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: colors.red400 }}>{t('game.error')}: {error}</Text>
      </SafeAreaView>
    );
  }

  const isVisible = (seat: Seat) => revealAll || Array.isArray(tree.hands?.[seat]);
  const labelFor = (seat: Seat) => `${t(seatKey(seat, heroSeat, dummySeat, declarerSeat, isDefense))} (${seat})`;
  const countFor = (seat: Seat) => (isVisible(seat) ? hands[seat].length : tree.hand_counts?.[seat] ?? 0);
  const backsFor = (seat: Seat) =>
    Array.from({ length: tree.hand_counts?.[seat] ?? 0 }, (_, i) => `back-${seat}-${i}`);

  const renderHand = (seat: Seat, opts: { size?: 'sm' | 'md' | 'lg'; labelBelow?: boolean; vertical?: boolean } = {}) => {
    const shown = isVisible(seat);
    return (
      <HandFan
        cards={shown ? hands[seat] : backsFor(seat)}
        label={labelFor(seat)}
        note={cards(countFor(seat))}
        size={opts.size ?? 'md'}
        faceDown={!shown}
        labelBelow={opts.labelBelow}
        vertical={opts.vertical}
        disabled={isWaiting || isFinished}
        onCardPress={shown && playableSeats.includes(seat) && !isFinished ? (code) => playCard(code, seat) : undefined}
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {t('game.contract')}: {puzzle?.contract ?? '—'}  ·  {t('game.declarer')}: {puzzle?.declarer ?? '—'}
        </Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.headerLink}>{t('nav.menu')}</Text>
        </Pressable>
      </View>

      <View style={styles.board}>
        {renderHand(slots.top, { size: 'sm' })}
        <View style={styles.middle}>
          <View style={styles.sideSlot}>{renderHand(slots.left, { size: 'sm' })}</View>
          {/* Po odkryciu rozdania karty wracają do macierzystych rąk, więc plansza
              nie ma już czego pokazywać — znika, zwalniając miejsce dla rąk. */}
          {!revealAll && <TrickArea trick={trick} slots={slots} />}
          <View style={styles.sideSlot}>{renderHand(slots.right, { size: 'sm' })}</View>
        </View>
        {renderHand(slots.bottom, { size: 'lg', labelBelow: true })}
      </View>

      {isFinished && (
        <View style={styles.summary}>
          <Text style={[styles.summaryTitle, { color: isSuccess ? colors.emerald400 : colors.red400 }]}>
            {isSuccess ? t('table.solved') : t('table.wrong')}
          </Text>

          {!!finalMessage && (
            <ScrollView style={styles.summaryScroll}>
              <Text style={styles.summaryText}>{finalMessage}</Text>
            </ScrollView>
          )}

          {eloResult?.already_played ? (
            <Text style={styles.dim}>{t('table.alreadyPlayed')}</Text>
          ) : eloResult?.elo_change !== undefined ? (
            <View style={styles.eloRow}>
              <Text style={styles.eloLabel}>Elo</Text>
              <Text style={styles.dim}>{eloResult.old_elo}</Text>
              <Text style={styles.eloNew}>{eloResult.new_elo}</Text>
              <Text style={{ color: eloResult.elo_change > 0 ? colors.emerald400 : colors.red400, fontWeight: '800' }}>
                {eloResult.elo_change > 0 ? '+' : ''}{eloResult.elo_change}
              </Text>
            </View>
          ) : (
            <Text style={styles.dim}>{t('table.noChange')}</Text>
          )}

          {freeLeft !== null && (
            <Text style={[styles.freeLeft, freeLeft <= 3 && { color: colors.amber400 }]}>
              {freeLeftText(freeLeft)}
            </Text>
          )}

          <Pressable style={styles.primaryBtn} onPress={fetchPuzzle}>
            <Text style={styles.primaryBtnText}>{t('table.nextPuzzle')}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.felt },
  center: { flex: 1, backgroundColor: colors.slate900, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  dim: { color: colors.slate400 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(5,46,22,0.7)',
  },
  headerText: { color: '#d1fae5', fontWeight: '700', fontSize: 13 },
  headerLink: { color: '#a7f3d0', fontWeight: '700', fontSize: 13 },

  board: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  middle: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 6, gap: 4 },
  sideSlot: { flex: 1, minWidth: 0, alignSelf: 'stretch' },

  summary: {
    backgroundColor: colors.slate800,
    borderTopWidth: 1, borderColor: colors.slate600,
    padding: 16, gap: 10,
  },
  summaryTitle: { fontSize: 18, fontWeight: '800' },
  summaryScroll: { maxHeight: 120 },
  summaryText: { color: colors.slate300, fontSize: 13, lineHeight: 19 },
  eloRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eloLabel: { color: colors.slate400, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  eloNew: { color: colors.white, fontSize: 18, fontWeight: '900' },
  freeLeft: { color: colors.slate400, fontSize: 12 },

  primaryBtn: { backgroundColor: colors.emerald600, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: '800' },
  ghostBtn: { borderWidth: 1, borderColor: colors.slate600, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  ghostBtnText: { color: colors.slate300, fontWeight: '700' },

  wallTitle: { color: colors.white, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  wallBody: { color: colors.slate300, textAlign: 'center', lineHeight: 20 },
});
