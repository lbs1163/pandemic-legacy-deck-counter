import type { CityInfo } from '@/lib/deckState';
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
              <th scope="col">도시</th>
              {Array.from({ length: numDraw }, (_, index) => (
                <th key={`draw-${index + 1}`} scope="col">
                  {index + 1}장째
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {probabilities.map((city) => (
              <tr key={`prob-${city.name}`}>
                <th scope="row">
                  <div className="probCity">
                    <CityColorDot color={getCityColor(city.name)} />
                    <span>{city.name}</span>
                  </div>
                </th>
                {Array.from({ length: numDraw }, (_, index) => {
                  const drawIndex = index + 1;
                  const prob =
                    city.probs.find((entry) => entry.draw === drawIndex)?.probability ?? 0;
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
