import type { CityInfo } from '@/lib/deckState';
import type { ReactNode } from 'react';
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
  const renderItems = () => {
    const items: ReactNode[] = [];
    let prevColorKey: string | null = null;

    const pushItem = (colorKey: string, node: ReactNode) => {
      const isEventToEpidemic = prevColorKey === 'event' && colorKey === 'epidemic';
      if (prevColorKey !== null && colorKey !== prevColorKey && !isEventToEpidemic) {
        items.push(
          <li key={`break-${items.length}`} className="zoneListBreak" aria-hidden="true" />
        );
      }
      items.push(node);
      prevColorKey = colorKey;
    };

    cities.forEach((city) => {
      const cityInfo = cityInfoMap.get(city.name);
      const colorKey = cityInfo?.color ?? 'none';
      pushItem(
        colorKey,
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
    });

    pushItem(
      'event',
      <li className="zoneListItem" key="PC-event">
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
    );

    pushItem(
      'epidemic',
      <li className="zoneListItem" key="PC-epidemic">
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
    );

    return items;
  };

  return (
    <section className="playerCards">
      <div className="zoneCard" style={{ borderColor: '#8b5cf6' }}>
        <header className="zoneHeader">
          <h2>남은 플레이어 카드</h2>
          <p>도시, 이벤트, 전염 카드를 추적합니다.</p>
        </header>
        <ul className="zoneList zoneListGrid">
          {renderItems()}
        </ul>
      </div>
    </section>
  );
}
