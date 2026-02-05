import type { CityInfo } from '@/lib/deckState';
import type { ReactNode } from 'react';
import { CityColorDot } from './CityColorDot';

interface PlayerCardsProps {
  cities: { name: string; count: number }[];
  removedCities: { name: string; count: number }[];
  drawnCities: { name: string; count: number }[];
  eventCount: number;
  epidemicCount: number;
  drawnEventCount: number;
  drawnEpidemicCount: number;
  isBusy: boolean;
  canTriggerEpidemic: boolean;
  canDiscardEpidemic: boolean;
  cityInfoMap: Map<string, CityInfo>;
  onDrawCity: (cityName: string) => void;
  onRemoveCity: (cityName: string) => void;
  onReturnRemovedCity: (cityName: string) => void;
  onDrawEvent: () => void;
  onOpenEpidemic: () => void;
  onDiscardEpidemic: () => void;
}

export function PlayerCards({
  cities,
  removedCities,
  drawnCities,
  eventCount,
  epidemicCount,
  drawnEventCount,
  drawnEpidemicCount,
  isBusy,
  canTriggerEpidemic,
  canDiscardEpidemic,
  cityInfoMap,
  onDrawCity,
  onRemoveCity,
  onReturnRemovedCity,
  onDrawEvent,
  onOpenEpidemic,
  onDiscardEpidemic
}: PlayerCardsProps) {
  const removedCityMap = new Map(removedCities.map((city) => [city.name, city.count]));
  const remainingCityMap = new Map(cities.map((city) => [city.name, city.count]));
  const drawnCityMap = new Map(drawnCities.map((city) => [city.name, city.count]));
  const visibleRemovedCities = removedCities.filter((city) => city.count > 0);

  const renderDrawnItems = () => {
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
      const remainingCount = remainingCityMap.get(city.name) ?? 0;
      const drawnCount = drawnCityMap.get(city.name) ?? 0;
      const removedCount = removedCityMap.get(city.name) ?? 0;
      const canRemove = (cityInfo?.playerCardsCount ?? 0) > removedCount;
      const canDiscardDrawn = drawnCount > 0;
      pushItem(
        colorKey,
        <li key={`PC-${city.name}`} className="zoneListItem">
          <div className="zoneCityText">
            <CityColorDot color={cityInfo?.color} />
            <span className="cityName">{city.name}</span>
            <span className="cityCount">
              {drawnCount}
              <span className="countUnit">장</span>
            </span>
          </div>
          <div className="zoneActions">
            <button
              className="removeButton"
              onClick={() => onRemoveCity(city.name)}
              disabled={isBusy || !canDiscardDrawn}
              aria-label={`${city.name} 도시 카드 제거`}
            >
              -
            </button>
            <button
              className="addButton"
              onClick={() => onDrawCity(city.name)}
              disabled={isBusy || remainingCount <= 0 || !canRemove}
              aria-label={`${city.name} 도시 카드 드로우`}
            >
              +
            </button>
          </div>
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
            {drawnEventCount}
            <span className="countUnit">장</span>
          </span>
        </div>
        <div className="zoneActions">
          <button
            className="addButton"
            onClick={onDrawEvent}
            disabled={isBusy || eventCount <= 0}
            aria-label="이벤트 카드 드로우"
          >
            +
          </button>
        </div>
      </li>
    );

    pushItem(
      'epidemic',
      <li className="zoneListItem" key="PC-epidemic">
        <div className="zoneCityText">
          <span className="cityColorDot cityColorDotEpidemic" aria-hidden="true" />
          <span className="cityName">전염 카드</span>
          <span className="cityCount">
            {drawnEpidemicCount}
            <span className="countUnit">장</span>
          </span>
        </div>
        <div className="zoneActions">
          <button
            className="addButton"
            onClick={onOpenEpidemic}
            disabled={isBusy || !canTriggerEpidemic}
            aria-label="전염 카드 드로우"
          >
            +
          </button>
          <button
            className="removeButton"
            onClick={onDiscardEpidemic}
            disabled={isBusy || !canDiscardEpidemic}
            aria-label="전염 카드 효과 없이 버리기"
          >
            효과 없이 버리기
          </button>
        </div>
      </li>
    );

    return items;
  };

  const renderRemainingItems = () => {
    const items: ReactNode[] = [];
    let prevColorKey: string | null = null;

    const pushItem = (colorKey: string, node: ReactNode) => {
      const isEventToEpidemic = prevColorKey === 'event' && colorKey === 'epidemic';
      if (prevColorKey !== null && colorKey !== prevColorKey && !isEventToEpidemic) {
        items.push(
          <li key={`break-remaining-${items.length}`} className="zoneListBreak" aria-hidden="true" />
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
        <li key={`PC-remaining-${city.name}`} className="zoneListItem">
          <div className="zoneCityText">
            <CityColorDot color={cityInfo?.color} />
            <span className="cityName">{city.name}</span>
            <span className="cityCount">
              {city.count}
              <span className="countUnit">장</span>
            </span>
          </div>
        </li>
      );
    });

    pushItem(
      'event',
      <li className="zoneListItem" key="PC-remaining-event">
        <div className="zoneCityText">
          <span className="cityColorDot cityColorDotEvent" aria-hidden="true" />
          <span className="cityName">이벤트</span>
          <span className="cityCount">
            {eventCount}
            <span className="countUnit">장</span>
          </span>
        </div>
      </li>
    );

    pushItem(
      'epidemic',
      <li className="zoneListItem" key="PC-remaining-epidemic">
        <div className="zoneCityText">
          <span className="cityColorDot cityColorDotEpidemic" aria-hidden="true" />
          <span className="cityName">전염 카드</span>
          <span className="cityCount">
            {epidemicCount}
            <span className="countUnit">장</span>
          </span>
        </div>
      </li>
    );

    return items;
  };

  return (
    <section className="playerCards">
      <div className="zoneCard" style={{ borderColor: '#f87171' }}>
        <header className="zoneHeader">
          <h2>드로우한 플레이어 카드</h2>
          <p>이번 게임에서 드로우된 카드</p>
        </header>
        <ul className="zoneList zoneListGrid">
          {renderDrawnItems()}
        </ul>
      </div>
      <div className="zoneCard" style={{ borderColor: '#8b5cf6' }}>
        <header className="zoneHeader">
          <h2>남은 플레이어 카드</h2>
          <p>도시, 이벤트, 전염 카드를 추적합니다.</p>
        </header>
        <ul className="zoneList zoneListGrid">
          {renderRemainingItems()}
        </ul>
      </div>
      <div className="zoneCard" style={{ borderColor: '#22c55e' }}>
        <header className="zoneHeader">
          <h2>제거된 플레이어 카드</h2>
          <p>새 게임 시작 시 제외될 도시 카드</p>
        </header>
        {visibleRemovedCities.length === 0 ? (
          <p className="emptyMessage">제거된 도시 카드가 없습니다.</p>
        ) : (
          <ul className="zoneList">
            {visibleRemovedCities.map((city) => {
              const cityInfo = cityInfoMap.get(city.name);
              return (
                <li key={`PC-removed-${city.name}`} className="zoneListItem">
                  <div className="zoneCityText">
                    <CityColorDot color={cityInfo?.color} />
                    <span className="cityName">{city.name}</span>
                    <span className="cityCount">
                      {city.count}
                      <span className="countUnit">장</span>
                    </span>
                  </div>
                  <button
                    className="returnButton"
                    onClick={() => onReturnRemovedCity(city.name)}
                    disabled={isBusy}
                    aria-label={`${city.name} 도시 카드 복구`}
                  >
                    복구
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
