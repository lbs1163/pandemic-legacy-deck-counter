import type { CityInfo } from '@/lib/deckState';
import { useMemo, useState } from 'react';
import type { CityProbability } from './utils';
import { CityColorDot } from './CityColorDot';
import { Stepper } from './Stepper';

type CityColor = CityInfo['color'];

interface InfectionPredictionProps {
  numDraw: number;
  predictEpidemic: boolean;
  canTriggerEpidemic: boolean;
  probabilities: CityProbability[];
  probabilityFormatter: Intl.NumberFormat;
  cityInfoMap: Map<string, CityInfo>;
  onChangeNumDraw: (value: number) => void;
  onTogglePredict: (checked: boolean) => void;
}

type SortKey = 'city' | 'total' | number;
type SortDirection = 'asc' | 'desc' | null;

export function InfectionPrediction({
  numDraw,
  predictEpidemic,
  canTriggerEpidemic,
  probabilities,
  probabilityFormatter,
  cityInfoMap,
  onChangeNumDraw,
  onTogglePredict
}: InfectionPredictionProps) {
  const getCityColor = (name: string): CityColor | undefined => cityInfoMap.get(name)?.color;
  const [sortState, setSortState] = useState<{ key: SortKey | null; direction: SortDirection }>({
    key: null,
    direction: null
  });

  const getProbabilityForDraw = (city: CityProbability, drawIndex: number) =>
    city.probs.find((entry) => entry.draw === drawIndex)?.probability ?? 0;

  const rows = useMemo(
    () =>
      probabilities.map((city, index) => {
        const total = Array.from({ length: numDraw }, (_, i) =>
          getProbabilityForDraw(city, i + 1)
        ).reduce((acc, value) => acc + value, 0);
        return { city, total, index };
      }),
    [numDraw, probabilities]
  );

  const sortedRows = useMemo(() => {
    if (!sortState.key || !sortState.direction) {
      return rows;
    }

    const compare = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortState.key === 'city') {
        aValue = a.city.name;
        bValue = b.city.name;
      } else if (sortState.key === 'total') {
        aValue = a.total;
        bValue = b.total;
      } else {
        aValue = getProbabilityForDraw(a.city, sortState.key);
        bValue = getProbabilityForDraw(b.city, sortState.key);
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue, 'ko');
        if (result !== 0) {
          return sortState.direction === 'asc' ? result : -result;
        }
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (aValue !== bValue) {
          return sortState.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
      }

      return a.index - b.index;
    };

    return [...rows].sort(compare);
  }, [rows, sortState.direction, sortState.key]);

  const handleSort = (key: SortKey) => {
    setSortState((current) => {
      if (current.key !== key) {
        return { key, direction: 'desc' };
      }
      if (current.direction === 'desc') {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key: null, direction: null };
      }
      return { key, direction: 'desc' };
    });
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortState.key !== key || !sortState.direction) return '';
    return sortState.direction === 'asc' ? '↑' : '↓';
  };

  return (
    <section className="infectionCardsPrediction">
      <div className="deckSummary">
        <span className="deckSummaryTitle">감염 카드 덱 더미</span>
        <div className="deckSummaryControls">
          <div className="deckSummaryLabel">
            <span>드로우 수</span>
            <Stepper
              value={numDraw}
              onChange={onChangeNumDraw}
              min={1}
              max={6}
              ariaLabel="드로우 수 조절"
              decrementLabel="드로우 수 감소"
              incrementLabel="드로우 수 증가"
            />
          </div>
          {canTriggerEpidemic && (
            <label className="togglePredict">
              <input
                type="checkbox"
                checked={predictEpidemic}
                onChange={(event) => onTogglePredict(event.target.checked)}
              />
              <span>전염 발생 후 기준</span>
            </label>
          )}
        </div>
        <table className="probabilityTable">
          <thead>
            <tr>
              <th scope="col">
                <button
                  type="button"
                  className="sortableHeader"
                  onClick={() => handleSort('city')}
                  aria-label="도시 이름 정렬"
                >
                  도시 {renderSortIndicator('city')}
                </button>
              </th>
              {Array.from({ length: numDraw }, (_, index) => (
                <th key={`draw-${index + 1}`} scope="col">
                  <button
                    type="button"
                    className="sortableHeader"
                    onClick={() => handleSort(index + 1)}
                    aria-label={`${index + 1}장만 나올 확률 정렬`}
                  >
                    {index + 1}장만 {renderSortIndicator(index + 1)}
                  </button>
                </th>
              ))}
              <th scope="col">
                <button
                  type="button"
                  className="sortableHeader"
                  onClick={() => handleSort('total')}
                  aria-label="확률 총합 정렬"
                >
                  1장 이상 {renderSortIndicator('total')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(({ city, total }) => {
              const totalFill = Math.max(0, Math.min(100, total * 100));
              return (
                <tr key={`prob-${city.name}`}>
                  <th scope="row">
                    <div className="probCity">
                      <CityColorDot color={getCityColor(city.name)} />
                      <span>{city.name}</span>
                    </div>
                  </th>
                  {Array.from({ length: numDraw }, (_, index) => {
                    const drawIndex = index + 1;
                    const prob = getProbabilityForDraw(city, drawIndex);
                    let fillPercent = Math.max(0, Math.min(100, prob * 100));
                    if (prob > 0) fillPercent = Math.max(1, fillPercent);
                    return (
                      <td
                        key={`prob-${city.name}-${drawIndex}`}
                        style={{
                          background: `linear-gradient(90deg, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.4) ${fillPercent}%, transparent ${fillPercent}%, transparent 100%)`
                        }}
                      >
                        {probabilityFormatter.format(prob)}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      background: `linear-gradient(90deg, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.4) ${totalFill}%, transparent ${totalFill}%, transparent 100%)`
                    }}
                  >
                    {probabilityFormatter.format(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
