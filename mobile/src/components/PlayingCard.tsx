import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, suitColor, suitSymbol, cardSize, type CardSize } from '../theme';
import { useI18n, rankLabel } from '../lib/i18n';

type Props = {
  code: string;
  size?: CardSize;
  faceDown?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: object;
};

export function parseCardCode(code: string) {
  return { suit: code[0], rank: code.slice(1) };
}

export default function PlayingCard({ code, size = 'md', faceDown, disabled, onPress, style }: Props) {
  const { lang } = useI18n();
  const dim = cardSize[size];

  if (faceDown) {
    return (
      <View style={[styles.card, { width: dim.w, height: dim.h, backgroundColor: colors.cardBack, borderColor: 'rgba(255,255,255,0.25)' }, style]}>
        <View style={styles.backInner} />
      </View>
    );
  }

  const { suit, rank: dbRank } = parseCardCode(code);
  const rank = rankLabel(dbRank, lang);
  const tint = suitColor[suit] ?? colors.slate900;

  const face = (
    <View style={[styles.card, { width: dim.w, height: dim.h }, disabled && styles.disabled, style]}>
      <View style={styles.corner}>
        <Text style={[styles.rank, { color: tint, fontSize: dim.w * 0.32 }]}>{rank}</Text>
        <Text style={[styles.suitSmall, { color: tint, fontSize: dim.w * 0.26 }]}>{suitSymbol[suit]}</Text>
      </View>
      <Text style={[styles.suitBig, { color: tint, fontSize: dim.w * 0.52 }]}>{suitSymbol[suit]}</Text>
    </View>
  );

  // Bez onPress karta jest tylko obrazkiem — nie chcemy łapać dotknięć na stole
  if (!onPress) return face;

  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardFace,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  backInner: {
    position: 'absolute',
    top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.cardBackPattern,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  corner: { position: 'absolute', top: 3, left: 4, alignItems: 'center' },
  rank: { fontWeight: '800', lineHeight: undefined },
  suitSmall: { marginTop: -2 },
  suitBig: { opacity: 0.9 },
  disabled: { opacity: 1 },
  // Dotknięcie zastępuje hover, którego na telefonie nie ma
  pressed: { transform: [{ translateY: -10 }] },
});
