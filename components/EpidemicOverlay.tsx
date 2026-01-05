import type { CityCardsSnapshot } from '@/lib/deckState';

interface EpidemicOverlayProps {
  isOpen: boolean;
  candidates: CityCardsSnapshot[];
  isBusy: boolean;
  onSelect: (cityName: string) => void;
  onClose: () => void;
}

export function EpidemicOverlay({
  isOpen,
  candidates,
  isBusy,
  onSelect,
  onClose
}: EpidemicOverlayProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="overlayCard">
        <header>
          <h2>전염 카드 발동</h2>
          <p>덱 맨 아래에서 뽑은 도시를 선택하세요.</p>
        </header>
        {candidates.length === 0 ? (
          <p className="emptyMessage">덱에 남은 C 영역 카드가 없습니다.</p>
        ) : (
          <ul className="candidateList">
            {candidates.map((city) => (
              <li key={`epidemic-${city.name}`}>
                <button onClick={() => onSelect(city.name)} disabled={isBusy}>
                  <span>{city.name}</span>
                  <span>{city.count}장</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="closeOverlay" onClick={onClose} disabled={isBusy}>
          닫기
        </button>
      </div>
    </div>
  );
}
