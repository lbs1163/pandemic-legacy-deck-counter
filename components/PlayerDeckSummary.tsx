import type { CityInfo } from '@/lib/deckState';
import { CityColorDot } from './CityColorDot';
import { CITY_COLOR_LABELS, CITY_COLOR_ORDER } from './deckConstants';

type CityColor = CityInfo['color'];

export interface PlayerPileSummary {
  count: number;
  index: number;
  isActive: boolean;
  hasEpidemic: boolean;
}

interface PlayerDeckSummaryProps {
  epidemicProbabilityLabel: string;
  piles: PlayerPileSummary[];
  cityColorTotals: Record<CityColor, number>;
  remainingCityTotal: number;
  remainingPlayerTotal: number;
}

export function PlayerDeckSummary({
  epidemicProbabilityLabel,
  piles,
  cityColorTotals,
  remainingCityTotal,
  remainingPlayerTotal
}: PlayerDeckSummaryProps) {
  const totalShare = remainingPlayerTotal > 0 ? remainingCityTotal / remainingPlayerTotal : 0;
  const totalPercent = Math.max(0, Math.min(100, totalShare * 100));
  return (
    <section className="playerCardsPrediction">
      <div className="deckSummary">
        <span className="deckSummaryTitle">플레이어 카드 덱 더미</span>
        <p className="probability">
          다음 2장 중 전염 카드가 등장할 확률 <strong>{epidemicProbabilityLabel}</strong>
        </p>
        <div className="playerPileGrid">
          {piles.map((pile) => (
            <div
              key={pile.index}
              className={`playerPileItem${pile.isActive ? ' isActive' : ''}${
                pile.hasEpidemic ? ' hasEpidemic' : ''
              }${pile.count === 0 ? ' isEmpty' : ''}`}
            >
              <span className="pileLabel">{pile.index === 0 ? '초기 드로우' : `더미 ${pile.index}`}</span>
              <span className="pileCount">{pile.count}장</span>
            </div>
          ))}
        </div>
        <div className="playerCityTotal">
          <div className="playerCityTotalLabel">
            남은 도시 카드 총합 <strong>{remainingCityTotal}</strong>장
          </div>
          <div className="playerCityTotalBar" aria-hidden="true">
            <span className="playerCityTotalFill" style={{ width: `${totalPercent}%` }} />
          </div>
        </div>
        <div className="playerColorTotals">
          {CITY_COLOR_ORDER.map((color) => (
            <div key={color} className={`playerColorTotalsItem color-${color.toLowerCase()}`}>
              <span>
                <CityColorDot color={color} />
                <span className="colorLabel">{CITY_COLOR_LABELS[color]}</span>
              </span>
              <span className="colorCount">{cityColorTotals[color]} 장</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
