import type { CityInfo } from '@/lib/deckState';
import { CityColorDot } from './CityColorDot';

interface PlayerCardsProps {
  cities: { name: string; count: number }[];
  eventCount: number;
  epidemicCount: number;
  isBusy: boolean;
  canTriggerEpidemic: boolean;
  cityInfoMap: Map<string, CityInfo>;
  onDrawCity: (cityName: string) => void;
  onDrawEvent: () => void;
  onOpenEpidemic: () => void;
}

export function PlayerCards({
  cities,
  eventCount,
  epidemicCount,
  isBusy,
  canTriggerEpidemic,
  cityInfoMap,
  onDrawCity,
  onDrawEvent,
  onOpenEpidemic
}: PlayerCardsProps) {
  return (
    <section className="playerCards">
      <div className="zoneCard" style={{ borderColor: '#8b5cf6' }}>
        <header className="zoneHeader">
          <h2>남은 플레이어 카드</h2>
          <p>도시, 이벤트, 전염 카드를 추적합니다.</p>
        </header>
        <ul className="zoneList zoneListGrid">
          {cities.map((city) => {
            const cityInfo = cityInfoMap.get(city.name);
            return (
              <li key={`PC-${city.name}`} className="zoneListItem">
                <div className="zoneCityText">
                  <CityColorDot color={cityInfo?.color} />
                  <span className="cityName">{city.name}</span>
                  <span className="cityCount">
                    {city.count}
                    <span className="countUnit">장</span>
                  </span>
                </div>
                <button
                  className="addButton"
                  onClick={() => onDrawCity(city.name)}
                  disabled={isBusy}
                  aria-label={`${city.name} 도시 카드 드로우`}
                >
                  -
                </button>
              </li>
            );
          })}
          <li className="zoneListItem">
            <div className="zoneCityText">
              <span className="cityColorDot cityColorDotEvent" aria-hidden="true" />
              <span className="cityName">이벤트</span>
              <span className="cityCount">
                {eventCount}
                <span className="countUnit">장</span>
              </span>
            </div>
            <button
              className="addButton"
              onClick={onDrawEvent}
              disabled={isBusy || eventCount <= 0}
              aria-label="이벤트 카드 드로우"
            >
              -
            </button>
          </li>
          <li className="zoneListItem">
            <div className="zoneCityText">
              <span className="cityColorDot cityColorDotEpidemic" aria-hidden="true" />
              <span className="cityName">전염 카드</span>
              <span className="cityCount">
                {epidemicCount}
                <span className="countUnit">장</span>
              </span>
            </div>
            <button
              className="addButton"
              onClick={onOpenEpidemic}
              disabled={isBusy || !canTriggerEpidemic}
              aria-label="전염 카드 드로우"
            >
              -
            </button>
          </li>
        </ul>
      </div>
    </section>
  );
}
