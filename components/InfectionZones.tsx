import type { ReactNode } from 'react';
import type { CityCardsSnapshot, CityInfo } from '@/lib/deckState';
import { CityColorDot } from './CityColorDot';
import { ZONE_INFO } from './deckConstants';

interface ZoneCardProps {
  title: string;
  description: string;
  accent: string;
  children: ReactNode;
}

function ZoneCard({ title, description, accent, children }: ZoneCardProps) {
  return (
    <div className="zoneCard" style={{ borderColor: accent }}>
      <header className="zoneHeader">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </div>
  );
}

interface InfectionZonesProps {
  zoneA: CityCardsSnapshot[];
  zoneBLayers: CityCardsSnapshot[][];
  zoneC: CityCardsSnapshot[];
  zoneD: CityCardsSnapshot[];
  removed: CityCardsSnapshot[];
  isBusy: boolean;
  cityInfoMap: Map<string, CityInfo>;
  onIncrement: (cityName: string) => void;
  onRemoveDiscard: (cityName: string) => void;
  onReturnRemoved: (cityName: string, zone: 'A' | 'B' | 'C') => void;
}

export function InfectionZones({
  zoneA,
  zoneBLayers,
  zoneC,
  zoneD,
  removed,
  isBusy,
  cityInfoMap,
  onIncrement,
  onRemoveDiscard,
  onReturnRemoved,
}: InfectionZonesProps) {
  const renderZoneList = (
    zone: CityCardsSnapshot[],
    action?: (name: string) => void,
    removeAction?: (name: string) => void
  ) => (
    <ul className="zoneList">
      {zone.map((city) => {
        const cityInfo = cityInfoMap.get(city.name);
        return (
          <li key={city.name} className="zoneListItem">
            <div className="zoneCityText">
              <CityColorDot color={cityInfo?.color} />
              <span className="cityName">{city.name}</span>
              <span className="cityCount">
                {city.count}
                <span className="countUnit">장</span>
              </span>
            </div>
            {(action || removeAction) && (
              <div className="zoneActions">
                {removeAction && (
                  <button
                    className="removeButton"
                    onClick={() => removeAction(city.name)}
                    disabled={isBusy || city.count <= 0}
                  >
                    -
                  </button>
                )}
                {action && (
                  <button className="addButton" onClick={() => action(city.name)} disabled={isBusy}>
                    +
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="zones">
      <ZoneCard {...ZONE_INFO.A}>
        {renderZoneList(zoneA, onIncrement, onRemoveDiscard)}
      </ZoneCard>

      <ZoneCard {...ZONE_INFO.B}>
        {zoneBLayers.length === 0 ? (
          <p className="emptyMessage">B 영역에 카드가 없습니다.</p>
        ) : (
          <div className="layerList">
            {zoneBLayers.map((layer, index) => {
              const layerLabel = index === 0 ? 'B1 · 상단' : `B${index + 1}`;
              return (
                <div key={index} className="layerBlock">
                  <div className="layerHeader">
                    <span>{layerLabel}</span>
                    <span>{1}장</span>
                  </div>
                  {renderZoneList(layer)}
                </div>
              );
            })}
          </div>
        )}
      </ZoneCard>

      <ZoneCard {...ZONE_INFO.C}>{renderZoneList(zoneC)}</ZoneCard>

      <ZoneCard {...ZONE_INFO.D}>
        {zoneD.length === 0 ? (
          <p className="emptyMessage">표시할 카드가 없습니다.</p>
        ) : (
          renderZoneList(zoneD)
        )}
      </ZoneCard>

      <ZoneCard {...ZONE_INFO.E}>
        {removed.length === 0 ? (
          <p className="emptyMessage">제거된 감염 카드가 없습니다.</p>
        ) : (
          <ul className="zoneList">
            {removed.map((city) => {
              const cityInfo = cityInfoMap.get(city.name);
              return (
                <li key={city.name} className="zoneListItem">
                  <div className="zoneCityText">
                    <CityColorDot color={cityInfo?.color} />
                    <span className="cityName">{city.name}</span>
                    <span className="cityCount">
                      {city.count}
                      <span className="countUnit">장</span>
                    </span>
                  </div>
                  <div className="returnButtons">
                    {(['A', 'B', 'C'] as const).map((zoneKey) => (
                      <button
                        key={zoneKey}
                        className="returnButton"
                        disabled={isBusy}
                        onClick={() => onReturnRemoved(city.name, zoneKey)}
                      >
                        {zoneKey}로
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ZoneCard>
    </section>
  );
}
