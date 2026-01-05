import type { FormEvent } from 'react';
import type { CityInfo } from '@/lib/deckState';
import {
  CITY_COLOR_HEX,
  CITY_COLOR_LABELS,
  CITY_COLOR_ORDER
} from './deckConstants';

type CityColor = CityInfo['color'];

interface NewCityFormProps {
  cityName: string;
  cityCount: string;
  cityColor: CityColor;
  isBusy: boolean;
  showHeading?: boolean;
  withSectionWrapper?: boolean;
  onChangeName: (value: string) => void;
  onChangeCount: (value: string) => void;
  onSelectColor: (color: CityColor) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function NewCityForm({
  cityName,
  cityCount,
  cityColor,
  isBusy,
  showHeading = true,
  withSectionWrapper = true,
  onChangeName,
  onChangeCount,
  onSelectColor,
  onSubmit
}: NewCityFormProps) {
  const isSubmitDisabled =
    isBusy ||
    !cityName.trim() ||
    !Number.isFinite(Number.parseInt(cityCount, 10)) ||
    Number.parseInt(cityCount, 10) <= 0 ||
    !CITY_COLOR_ORDER.includes(cityColor);

  const form = (
    <form onSubmit={onSubmit} className="newCityForm">
      <div className="newCityColorPicker" role="group" aria-label="도시 카드 색상">
        {CITY_COLOR_ORDER.map((color) => (
          <button
            key={color}
            type="button"
            className={`colorChip${cityColor === color ? ' isSelected' : ''}`}
            onClick={() => onSelectColor(color)}
            aria-pressed={cityColor === color}
            disabled={isBusy}
            aria-label={`${CITY_COLOR_LABELS[color]} 색상`}
            title={`${CITY_COLOR_LABELS[color]} 색상`}
          >
            <span
              className="colorChipDot"
              style={{ background: CITY_COLOR_HEX[color] }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <div className="newCityNameRow">
        <input
          type="text"
          value={cityName}
          onChange={(event) => onChangeName(event.target.value)}
          placeholder="도시 이름"
          disabled={isBusy}
          aria-label="새 도시 이름"
        />
      </div>
      <input
        type="number"
        value={cityCount}
        onChange={(event) => onChangeCount(event.target.value)}
        placeholder="카드 장수"
        min={1}
        step={1}
        disabled={isBusy}
        aria-label="감염 카드 장수"
      />
      <button type="submit" disabled={isSubmitDisabled}>
        추가
      </button>
    </form>
  );

  if (!withSectionWrapper) {
    return form;
  }

  return (
    <section className="newCitySection">
      {showHeading && <h2>새롭게 공급망에 연결된 도시 추가</h2>}
      {form}
    </section>
  );
}
