import type { FormEvent } from 'react';
import type { CityInfo } from '@/lib/deckState';
import { NewCityForm } from './NewCityForm';

type CityColor = CityInfo['color'];

interface NewCityOverlayProps {
  isOpen: boolean;
  cityName: string;
  cityCount: string;
  cityColor: CityColor;
  isBusy: boolean;
  onChangeName: (value: string) => void;
  onChangeCount: (value: string) => void;
  onSelectColor: (color: CityColor) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function NewCityOverlay({
  isOpen,
  cityName,
  cityCount,
  cityColor,
  isBusy,
  onChangeName,
  onChangeCount,
  onSelectColor,
  onSubmit,
  onClose
}: NewCityOverlayProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="overlayCard">
        <header>
          <h2>공급망 도시 추가</h2>
          <p>새롭게 공급망에 연결된 도시를 등록하세요.</p>
        </header>
        <NewCityForm
          cityName={cityName}
          cityCount={cityCount}
          cityColor={cityColor}
          isBusy={isBusy}
          showHeading={false}
          withSectionWrapper={false}
          onChangeName={onChangeName}
          onChangeCount={onChangeCount}
          onSelectColor={onSelectColor}
          onSubmit={onSubmit}
        />
        <button className="closeOverlay" onClick={onClose} disabled={isBusy}>
          닫기
        </button>
      </div>
    </div>
  );
}
