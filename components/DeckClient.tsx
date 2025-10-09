'use client';

import type { DeckSnapshot } from '@/lib/deckState';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type DeckData = DeckSnapshot;

const ZONE_INFO = {
  A: {
    title: 'A · 버려진 더미',
    description: '이미 공개된 감염 카드',
    accent: '#f87171'
  },
  B: {
    title: 'B · 혼합된 상단',
    description: '전염 카드 후 위쪽에 쌓인 카드 (위 레이어부터 순서대로)',
    accent: '#fb923c'
  },
  C: {
    title: 'C · 안전한 덱',
    description: '아직 공개되지 않은 감염 카드',
    accent: '#60a5fa'
  }
} as const;

const POLL_INTERVAL_MS = 5000;

async function readSnapshot(): Promise<DeckData> {
  const response = await fetch('/api/deck', {
    method: 'GET',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('덱 정보를 불러오지 못했습니다.');
  }

  return response.json();
}

async function mutateDeck(
  path: string,
  payload: Record<string, unknown>
): Promise<DeckData> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : '요청 처리 중 문제가 발생했습니다.'
    );
  }

  return data as DeckData;
}

interface DeckClientProps {
  initialData: DeckData;
}

export default function DeckClient({ initialData }: DeckClientProps) {
  const [deck, setDeck] = useState<DeckData>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isEpidemicOpen, setIsEpidemicOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const latestRequestId = useRef(0);

  const startRequest = useCallback(() => {
    latestRequestId.current += 1;
    return latestRequestId.current;
  }, []);

  const applySnapshot = useCallback(
    (snapshot: DeckData, requestId: number) => {
      if (requestId !== latestRequestId.current) {
        return;
      }

      setDeck((current) => {
        if (!current || snapshot.revision >= current.revision) {
          return snapshot;
        }

        return current;
      });
    },
    []
  );

  const applyError = useCallback((message: string | null, requestId: number) => {
    if (requestId === latestRequestId.current) {
      setError(message);
    }
  }, []);

  const refresh = useCallback(async () => {
    const requestId = startRequest();
    setIsRefreshing(true);
    try {
      const snapshot = await readSnapshot();
      applySnapshot(snapshot, requestId);
      applyError(null, requestId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '덱을 갱신할 수 없습니다.';
      applyError(message, requestId);
    } finally {
      setIsRefreshing(false);
    }
  }, [applyError, applySnapshot, startRequest]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isBusy) {
        return;
      }

      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isBusy, refresh]);

  const epidemicCandidates = useMemo(
    () => deck.zoneC.filter((city) => city.count > 0),
    [deck.zoneC]
  );

  const handleIncrement = useCallback(
    async (cityName: string) => {
      const requestId = startRequest();
      setIsBusy(true);
      applyError(null, requestId);
      try {
        const updated = await mutateDeck('/api/deck/increment', {
          city: cityName
        });
        applySnapshot(updated, requestId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '카드를 증가시킬 수 없습니다.';
        applyError(message, requestId);
      } finally {
        setIsBusy(false);
      }
    },
    [applyError, applySnapshot, startRequest]
  );

  const handleReset = useCallback(async () => {
    if (isBusy) {
      return;
    }
    const requestId = startRequest();
    setIsBusy(true);
    applyError(null, requestId);
    try {
      const updated = await mutateDeck('/api/deck/reset', {});
      applySnapshot(updated, requestId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '덱을 초기화할 수 없습니다.';
      applyError(message, requestId);
    } finally {
      setIsBusy(false);
    }
  }, [applyError, applySnapshot, isBusy, startRequest]);

  const handleEpidemic = useCallback(
    async (cityName: string) => {
      const requestId = startRequest();
      setIsBusy(true);
      applyError(null, requestId);
      try {
        const updated = await mutateDeck('/api/deck/epidemic', {
          city: cityName
        });
        applySnapshot(updated, requestId);
        setIsEpidemicOpen(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '전염 카드를 처리할 수 없습니다.';
        applyError(message, requestId);
      } finally {
        setIsBusy(false);
      }
    },
    [applyError, applySnapshot, startRequest]
  );

  const handleAddCity = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = newCityName.trim();
      if (!trimmed) {
        return;
      }
      const requestId = startRequest();
      setIsBusy(true);
      applyError(null, requestId);
      try {
        const updated = await mutateDeck('/api/deck/cities', {
          city: trimmed
        });
        applySnapshot(updated, requestId);
        setNewCityName('');
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : '새 도시를 추가할 수 없습니다.';
        applyError(message, requestId);
      } finally {
        setIsBusy(false);
      }
    },
    [applyError, applySnapshot, newCityName, startRequest]
  );

  return (
    <main className="page">
      <header className="pageHeader">
        <div>
          <h1 className="pageTitle">판데믹 레거시 S2 감염 덱</h1>
          <p className="pageSubtitle">모든 플레이어와 덱 상태를 공유하세요.</p>
        </div>
        <div className="headerButtons">
          <button
            className="epidemicButton"
            onClick={() => setIsEpidemicOpen(true)}
            disabled={isBusy || epidemicCandidates.length === 0}
          >
            전염 카드 발동
          </button>
          <button
            className="refreshButton"
            onClick={() => void refresh()}
            disabled={isBusy || isRefreshing}
            aria-label="최신 상태로 새로고침"
          >
            {isRefreshing ? '갱신 중…' : '새로고침'}
          </button>
          <button
            className="resetButton"
            onClick={() => void handleReset()}
            disabled={isBusy}
          >
            덱 초기화
          </button>
        </div>
      </header>

      <section className="totals">
        <div className="totalItem" style={{ borderColor: ZONE_INFO.A.accent }}>
          <span className="totalLabel">{ZONE_INFO.A.title}</span>
          <strong className="totalValue">{deck.totals.A}</strong>
        </div>
        <div className="totalItem" style={{ borderColor: ZONE_INFO.B.accent }}>
          <span className="totalLabel">{ZONE_INFO.B.title}</span>
          <strong className="totalValue">{deck.totals.B}</strong>
        </div>
        <div className="totalItem" style={{ borderColor: ZONE_INFO.C.accent }}>
          <span className="totalLabel">{ZONE_INFO.C.title}</span>
          <strong className="totalValue">{deck.totals.C}</strong>
        </div>
      </section>

      {error && <p className="errorBanner">{error}</p>}

      <section className="zones">
        <div
          className="zoneCard"
          style={{ borderColor: ZONE_INFO.A.accent }}
        >
          <header className="zoneHeader">
            <h2>{ZONE_INFO.A.title}</h2>
            <p>{ZONE_INFO.A.description}</p>
          </header>

          <ul className="zoneList">
            {deck.zoneA.map((city) => (
              <li key={`A-${city.name}`} className="zoneListItem">
                <div className="zoneCityText">
                  <span className="cityName">{city.name}</span>
                  <span className="cityCount">
                    {city.count}
                    <span className="countUnit">장</span>
                  </span>
                </div>
                <button
                  className="addButton"
                  onClick={() => void handleIncrement(city.name)}
                  disabled={isBusy}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="zoneCard"
          style={{ borderColor: ZONE_INFO.B.accent }}
        >
          <header className="zoneHeader">
            <h2>{ZONE_INFO.B.title}</h2>
            <p>{ZONE_INFO.B.description}</p>
          </header>

          {deck.zoneBLayers.length === 0 ? (
            <p className="emptyMessage">B 영역에 카드가 없습니다.</p>
          ) : (
            <div className="layerList">
              {deck.zoneBLayers.map((layer) => {
                const layerLabel =
                  layer.position === 1 ? 'B1 · 상단' : `B${layer.position}`;
                return (
                  <div key={layer.id} className="layerBlock">
                    <div className="layerHeader">
                      <span>{layerLabel}</span>
                      <span>{layer.total}장</span>
                    </div>
                    <ul className="zoneList">
                      {layer.cities.map((city) => (
                        <li
                          key={`B${layer.id}-${city.name}`}
                          className="zoneListItem"
                        >
                          <div className="zoneCityText">
                            <span className="cityName">{city.name}</span>
                            <span className="cityCount">
                              {city.count}
                              <span className="countUnit">장</span>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="zoneCard"
          style={{ borderColor: ZONE_INFO.C.accent }}
        >
          <header className="zoneHeader">
            <h2>{ZONE_INFO.C.title}</h2>
            <p>{ZONE_INFO.C.description}</p>
          </header>

          <ul className="zoneList">
            {deck.zoneC.map((city) => (
              <li key={`C-${city.name}`} className="zoneListItem">
                <div className="zoneCityText">
                  <span className="cityName">{city.name}</span>
                  <span className="cityCount">
                    {city.count}
                    <span className="countUnit">장</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="newCitySection">
        <h2>새롭게 발견된 도시 추가</h2>
        <form onSubmit={handleAddCity} className="newCityForm">
          <input
            type="text"
            value={newCityName}
            onChange={(event) => setNewCityName(event.target.value)}
            placeholder="도시 이름"
            disabled={isBusy}
            aria-label="새 도시 이름"
          />
          <button type="submit" disabled={isBusy || !newCityName.trim()}>
            추가
          </button>
        </form>
      </section>

      {isEpidemicOpen && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="overlayCard">
            <header>
              <h2>전염 카드 발동</h2>
              <p>덱 맨 아래에서 뽑은 도시를 선택하세요.</p>
            </header>
            {epidemicCandidates.length === 0 ? (
              <p className="emptyMessage">덱에 남은 C 영역 카드가 없습니다.</p>
            ) : (
              <ul className="candidateList">
                {epidemicCandidates.map((city) => (
                  <li key={`epidemic-${city.name}`}>
                    <button
                      onClick={() => void handleEpidemic(city.name)}
                      disabled={isBusy}
                    >
                      <span>{city.name}</span>
                      <span>{city.count}장</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="closeOverlay"
              onClick={() => setIsEpidemicOpen(false)}
              disabled={isBusy}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
