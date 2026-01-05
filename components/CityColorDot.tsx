import type { CityInfo } from '@/lib/deckState';
import { CITY_COLOR_HEX, DEFAULT_CITY_COLOR } from './deckConstants';

type CityColor = CityInfo['color'];

interface CityColorDotProps {
  color?: CityColor;
  className?: string;
}

export function CityColorDot({ color, className }: CityColorDotProps) {
  const colorValue = color ? CITY_COLOR_HEX[color] : DEFAULT_CITY_COLOR;

  return (
    <span
      className={`cityColorDot${className ? ` ${className}` : ''}`}
      style={{ background: colorValue }}
      aria-hidden="true"
    />
  );
}
