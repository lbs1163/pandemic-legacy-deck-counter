import { CITY_COLOR_ORDER } from '@/lib/deckState';
import type { CityInfo } from '@/lib/deckState';

type CityColor = CityInfo['color'];

export const CITY_COLOR_LABELS: Record<CityColor, string> = {
  Red: '빨강',
  Blue: '파랑',
  Yellow: '노랑',
  Black: '검정'
};

export const CITY_COLOR_HEX: Record<CityColor, string> = {
  Red: '#f87171',
  Blue: '#60a5fa',
  Yellow: '#facc15',
  Black: '#9ca3af'
};

export const DEFAULT_CITY_COLOR = '#6b7280';

export { CITY_COLOR_ORDER };

export const ZONE_INFO = {
  A: {
    title: '버려진 감염 카드',
    description: '이미 공개된 감염 카드',
    accent: '#f87171'
  },
  B: {
    title: '다시 섞인 감염 카드',
    description: '전염 카드 후 위쪽에 쌓인 카드 (위 레이어부터 순서대로)',
    accent: '#fb923c'
  },
  C: {
    title: '미공개 감염 카드',
    description: '아직 공개되지 않은 감염 카드',
    accent: '#60a5fa'
  },
  D: {
    title: '게임 종료 영역',
    description: '다음 새 게임 시작 시 덱에 합류할 카드',
    accent: '#a78bfa'
  },
  E: {
    title: '제거된 감염 카드',
    description: '게임에서 제외된 카드 (필요 시 A/B/C로 복구)',
    accent: '#22c55e'
  }
} as const;
