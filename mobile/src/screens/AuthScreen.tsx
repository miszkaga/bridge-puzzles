import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useI18n, type TKey } from '../lib/i18n';
import { colors } from '../theme';

const MESSAGES: Record<string, TKey> = {
  'Invalid login credentials': 'auth.err.credentials',
  'User already registered': 'auth.err.exists',
  'Password should be at least 6 characters.': 'auth.err.short',
  'Unable to validate email address: invalid format': 'auth.err.email',
};

export default function AuthScreen({ route, navigation }: any) {
  const { t } = useI18n();
  const [isRegister, setIsRegister] = useState(route.params?.mode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null); setBusy(true);
    const { error: authError } = isRegister
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (authError) {
      const key = MESSAGES[authError.message];
      setError(key ? t(key) : authError.message);
      return;
    }
    navigation.navigate('Home');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>← {t('nav.back')}</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.title}>{isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}</Text>
          <Text style={styles.hint}>{isRegister ? t('auth.registerHint') : t('auth.loginHint')}</Text>

          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
            placeholderTextColor={colors.slate600}
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholderTextColor={colors.slate600}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.primaryBtn} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.primaryBtnText}>{isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}</Text>}
          </Pressable>

          <Pressable onPress={() => { setIsRegister(!isRegister); setError(null); }} style={{ marginTop: 14 }}>
            <Text style={styles.switch}>
              {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
              <Text style={{ color: colors.emerald400, fontWeight: '800' }}>
                {isRegister ? t('auth.loginTitle') : t('auth.registerTitle')}
              </Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate900 },
  wrap: { flex: 1, justifyContent: 'center', padding: 20, gap: 14 },
  back: { color: colors.slate400 },
  card: { backgroundColor: colors.slate800, borderWidth: 1, borderColor: colors.slate700, borderRadius: 16, padding: 20 },
  title: { color: colors.white, fontSize: 22, fontWeight: '900' },
  hint: { color: colors.slate400, fontSize: 13, marginTop: 6, lineHeight: 18 },
  label: { color: colors.slate400, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(15,23,42,0.6)', borderWidth: 1, borderColor: colors.slate600,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: colors.white,
  },
  error: { color: colors.red400, fontSize: 13, marginTop: 12 },
  primaryBtn: { backgroundColor: colors.emerald600, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: colors.white, fontWeight: '800' },
  switch: { color: colors.slate400, textAlign: 'center', fontSize: 13 },
});
