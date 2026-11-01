import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useI18n, type TKey } from '../lib/i18n';
import { colors } from '../theme';

const TILES: { mode: string; title: TKey; sub: TKey; soon?: boolean }[] = [
  { mode: 'defense', title: 'tile.defense', sub: 'tile.defense.sub' },
  { mode: 'puzzle', title: 'tile.puzzle', sub: 'tile.puzzle.sub' },
  { mode: 'problem', title: 'tile.problem', sub: 'tile.problem.sub', soon: true },
  { mode: 'daily', title: 'tile.daily', sub: 'tile.daily.sub', soon: true },
];

export default function HomeScreen({ navigation }: any) {
  const { t, lang, setLang } = useI18n();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>Bridge <Text style={{ color: colors.emerald400 }}>Puzzles</Text></Text>
          <View style={styles.langSwitch}>
            {(['pl', 'en'] as const).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[styles.langBtn, lang === l && styles.langBtnActive]}>
                <Text style={[styles.langText, lang === l && { color: colors.white }]}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.tagline}>{t('home.tagline')}</Text>

        <View style={styles.account}>
          {session ? (
            <>
              <Text style={styles.dim} numberOfLines={1}>{session.user.email}</Text>
              <Pressable onPress={() => supabase.auth.signOut()}>
                <Text style={styles.link}>{t('nav.logout')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => navigation.navigate('Auth', { mode: 'login' })}>
                <Text style={styles.link}>{t('nav.login')}</Text>
              </Pressable>
              <Pressable style={styles.smallBtn} onPress={() => navigation.navigate('Auth', { mode: 'register' })}>
                <Text style={styles.smallBtnText}>{t('nav.register')}</Text>
              </Pressable>
            </>
          )}
        </View>

        {TILES.map((tile) => (
          <Pressable
            key={tile.mode}
            disabled={tile.soon}
            onPress={() => navigation.navigate('Game', { mode: tile.mode })}
            style={[styles.tile, tile.soon && styles.tileSoon]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>{t(tile.title)}</Text>
              <Text style={styles.tileSub}>{t(tile.sub)}</Text>
            </View>
            {tile.soon && <Text style={styles.soonBadge}>{t('home.soon')}</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate900 },
  content: { padding: 18, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.white, fontSize: 26, fontWeight: '900' },
  tagline: { color: colors.slate300, fontSize: 13, lineHeight: 19 },
  langSwitch: { flexDirection: 'row', borderWidth: 1, borderColor: colors.slate600, borderRadius: 8, overflow: 'hidden' },
  langBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  langBtnActive: { backgroundColor: colors.slate600 },
  langText: { color: colors.slate400, fontWeight: '800', fontSize: 11 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dim: { color: colors.slate400, flex: 1 },
  link: { color: colors.emerald400, fontWeight: '700' },
  smallBtn: { backgroundColor: colors.emerald600, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  smallBtnText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  tile: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.slate800, borderWidth: 1, borderColor: colors.slate700,
    borderRadius: 16, padding: 16,
  },
  tileSoon: { opacity: 0.5 },
  tileTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  tileSub: { color: colors.slate400, fontSize: 12, marginTop: 3 },
  soonBadge: { color: colors.slate400, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
