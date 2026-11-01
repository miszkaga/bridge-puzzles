import { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import PlayingCard from './PlayingCard';
import { colors, cardSize, type CardSize } from '../theme';

export type Seat = 'N' | 'E' | 'S' | 'W';
export type PlacedCard = { code: string; position: Seat };
export type Slots = { top: Seat; bottom: Seat; left: Seat; right: Seat };

export const SEATS: Seat[] = ['N', 'E', 'S', 'W'];
export const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/**
 * Gracz na dole, reszta zgodnie z ruchem wskazówek zegara: dół → lewo → góra → prawo.
 * Dzięki temu partnerzy siedzą naprzeciw siebie, tak jak przy stole.
 */
export function resolveSlots(hero: Seat): Slots {
  const i = SEATS.indexOf(hero);
  return {
    bottom: hero,
    left: SEATS[(i + 1) % 4],
    top: SEATS[(i + 2) % 4],
    right: SEATS[(i + 3) % 4],
  };
}

/**
 * Wachlarz kart. Poziomo dla ręki gracza i dziadka na górze, pionowo dla pozycji
 * bocznych — na telefonie cztery karty obok siebie po prostu się nie mieszczą,
 * a pionowy stos zajmuje szerokość jednej karty.
 *
 * Nachodzenie kart jest liczone z realnej, zmierzonej szerokości kontenera
 * (onLayout), nie ze sztywnej wartości — im więcej kart, tym mocniej się
 * zachodzą, żeby cała ręka zawsze zmieściła się bez przewijania. Dolny limit
 * pilnuje, żeby przy naprawdę dużej liczbie kart wciąż był widoczny róg każdej.
 */
const MIN_SLIVER = 14;

export function HandFan({ cards, label, note, size = 'md', faceDown, onCardPress, disabled, labelBelow, vertical }: {
  cards: string[]; label: string; note?: string; size?: CardSize;
  faceDown?: boolean; onCardPress?: (code: string) => void; disabled?: boolean;
  labelBelow?: boolean; vertical?: boolean;
}) {
  const dim = cardSize[size];
  const [containerSize, setContainerSize] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const size = vertical ? e.nativeEvent.layout.height : e.nativeEvent.layout.width;
    setContainerSize(size);
  };

  const axisSize = vertical ? dim.h : dim.w;
  const defaultStep = vertical ? axisSize * 0.38 : axisSize * 0.5;
  const n = cards.length;
  let step = defaultStep;
  if (containerSize > 0 && n > 1) {
    const fitStep = (containerSize - axisSize) / (n - 1);
    step = Math.min(defaultStep, Math.max(MIN_SLIVER, fitStep));
  }
  const overlapValue = Math.round(step - axisSize);
  const overlap = vertical ? { marginTop: overlapValue } : { marginLeft: overlapValue };

  const caption = (
    <View style={styles.caption}>
      <Text style={styles.label}>{label}</Text>
      {!!note && <Text style={styles.note}>{note}</Text>}
    </View>
  );

  return (
    <View style={styles.handWrap}>
      {!labelBelow && caption}
      <View style={vertical ? styles.fanVertical : styles.fan} onLayout={onLayout}>
        {cards.map((code, i) => (
          <PlayingCard
            key={code}
            code={code}
            size={size}
            faceDown={faceDown}
            disabled={disabled}
            onPress={onCardPress ? () => onCardPress(code) : undefined}
            style={i > 0 ? overlap : undefined}
          />
        ))}
      </View>
      {labelBelow && caption}
    </View>
  );
}

/** Stół: trzy rzędy po trzy pola, bo React Native nie zna CSS Grid. */
export function TrickArea({ trick, slots }: { trick: PlacedCard[]; slots: Slots }) {
  const placed: Record<Seat, PlacedCard | null> = { N: null, E: null, S: null, W: null };
  trick.forEach((c) => { placed[c.position] = c; });

  const slot = (seat: Seat) =>
    placed[seat]
      ? <PlayingCard code={placed[seat]!.code} size="md" />
      : <View style={[styles.placeholder, { width: cardSize.md.w, height: cardSize.md.h }]} />;

  return (
    <View style={styles.trick}>
      <View style={styles.trickRow}>
        <View style={styles.cell} />
        <View style={styles.cell}>{slot(slots.top)}</View>
        <View style={styles.cell} />
      </View>
      <View style={styles.trickRow}>
        <View style={styles.cell}>{slot(slots.left)}</View>
        <View style={styles.cell}><View style={styles.pin} /></View>
        <View style={styles.cell}>{slot(slots.right)}</View>
      </View>
      <View style={styles.trickRow}>
        <View style={styles.cell} />
        <View style={styles.cell}>{slot(slots.bottom)}</View>
        <View style={styles.cell} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  handWrap: { alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0, width: '100%' },
  fan: { flexDirection: 'row', justifyContent: 'center', width: '100%' },
  fanVertical: { flexDirection: 'column', alignItems: 'center', height: '100%' },
  caption: { alignItems: 'center' },
  label: { color: colors.emerald300, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  note: { color: 'rgba(110,231,183,0.6)', fontSize: 10 },

  trick: {
    backgroundColor: colors.trickBg,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.trickBorder,
    padding: 8,
    gap: 4,
    flexShrink: 0,
  },
  trickRow: { flexDirection: 'row', gap: 4 },
  cell: { width: cardSize.md.w, height: cardSize.md.h, alignItems: 'center', justifyContent: 'center' },
  pin: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(16,185,129,0.5)', backgroundColor: 'rgba(4,120,87,0.4)' },
  placeholder: {
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(4,120,87,0.4)',
    backgroundColor: 'rgba(6,78,59,0.15)',
  },
});
