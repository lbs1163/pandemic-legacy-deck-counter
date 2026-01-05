import { Stepper } from './Stepper';

interface DeckHeaderProps {
  isBusy: boolean;
  isRefreshing: boolean;
  canTriggerEpidemic: boolean;
  newGamePlayers: number;
  newGameEventCount: number;
  onChangePlayers: (value: number) => void;
  onChangeEventCount: (value: number) => void;
  onOpenEpidemic: () => void;
  onOpenBgm: () => void;
  onOpenNewCity: () => void;
  onRefresh: () => void;
  onUndo: () => void;
  onNewGame: () => void;
  onReset: () => void;
}

export function DeckHeader({
  isBusy,
  isRefreshing,
  canTriggerEpidemic,
  newGamePlayers,
  newGameEventCount,
  onChangePlayers,
  onChangeEventCount,
  onOpenEpidemic,
  onOpenBgm,
  onOpenNewCity,
  onRefresh,
  onUndo,
  onNewGame,
  onReset
}: DeckHeaderProps) {
  const isNewGameDisabled =
    isBusy ||
    !Number.isFinite(newGamePlayers) ||
    newGamePlayers < 2 ||
    newGamePlayers > 4 ||
    !Number.isFinite(newGameEventCount) ||
    newGameEventCount < 0;

  return (
    <header className="pageHeader">
      <div>
        <h1 className="pageTitle">판데믹 레거시 S2 덱 카운터</h1>
        <p className="pageSubtitle">모든 플레이어와 덱 상태를 공유하세요.</p>
      </div>
      <div className="headerButtons">
        <div
          className="newGameControls"
          style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
        >
          <div className="deckSummaryLabel">
            <span>플레이어</span>
            <Stepper
              value={newGamePlayers}
              onChange={onChangePlayers}
              min={2}
              max={4}
              disabled={isBusy}
              ariaLabel="플레이어 수 조절"
              decrementLabel="플레이어 수 감소"
              incrementLabel="플레이어 수 증가"
            />
          </div>
          <div className="deckSummaryLabel">
            <span>이벤트</span>
            <Stepper
              value={newGameEventCount}
              onChange={onChangeEventCount}
              min={0}
              max={20}
              disabled={isBusy}
              ariaLabel="이벤트 카드 수 조절"
              decrementLabel="이벤트 수 감소"
              incrementLabel="이벤트 수 증가"
            />
          </div>
        </div>
        <button
          className="epidemicButton"
          onClick={onOpenEpidemic}
          disabled={isBusy || !canTriggerEpidemic}
        >
          전염 카드 발동
        </button>
        <button
          className="refreshButton"
          onClick={onOpenBgm}
          aria-label="배경 음악 열기"
          disabled={isBusy}
        >
          BGM
        </button>
        <button
          className="refreshButton"
          onClick={onOpenNewCity}
          disabled={isBusy}
        >
          공급망 도시 추가
        </button>
        <button
          className="refreshButton"
          onClick={onRefresh}
          disabled={isBusy || isRefreshing}
          aria-label="최신 상태로 새로고침"
        >
          {isRefreshing ? '갱신 중…' : '새로고침'}
        </button>
        <button
          className="refreshButton"
          onClick={onUndo}
          disabled={isBusy}
          aria-label="되돌리기 (Ctrl+Z)"
        >
          되돌리기
        </button>
        <button
          className="refreshButton"
          onClick={onNewGame}
          disabled={isNewGameDisabled}
        >
          새 게임
        </button>
        <button className="resetButton" onClick={onReset} disabled={isBusy}>
          덱 초기화
        </button>
      </div>
    </header>
  );
}
