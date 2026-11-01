import { Dimensions } from 'react-native';

export const colors = {
  felt: '#166534',        // zielone sukno stołu
  feltDark: '#052e16',
  trickBg: 'rgba(6, 78, 59, 0.45)',
  trickBorder: 'rgba(4, 120, 87, 0.35)',

  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',

  emerald600: '#059669',
  emerald500: '#10b981',
  emerald400: '#34d399',
  emerald300: '#6ee7b7',

  amber400: '#fbbf24',
  red400: '#f87171',
  red500: '#ef4444',
  white: '#ffffff',

  cardFace: '#ffffff',
  cardBorder: '#e5e7eb',
  cardBack: '#1e3a8a',
  cardBackPattern: 'rgba(255,255,255,0.12)',
};

export const suitColor: Record<string, string> = {
  S: '#1e293b', // pik
  C: '#1e293b', // trefl
  H: '#dc2626', // kier
  D: '#dc2626', // karo
};

export const suitSymbol: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

/**
 * Karty skalują się do szerokości ekranu. Na stole muszą zmieścić się trzy w rzędzie
 * plus odstępy, a w ręce gracza do sześciu przy zakryciu o połowę — stąd te proporcje.
 */
const { width } = Dimensions.get('window');

const base = Math.max(44, Math.min(72, Math.floor((width - 48) / 4.4)));

export const cardSize = {
  sm: { w: Math.round(base * 0.72), h: Math.round(base * 0.72 * 1.4) },
  md: { w: base, h: Math.round(base * 1.4) },
  lg: { w: Math.round(base * 1.18), h: Math.round(base * 1.18 * 1.4) },
};

export type CardSize = keyof typeof cardSize;
