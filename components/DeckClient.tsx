'use client';

import {
  CITY_COLOR_ORDER,
  INITIAL_EPIDEMIC_COUNTS,
  type CityInfo,
  type GameSnapshot
} from '@/lib/deckState';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type DeckData = GameSnapshot;

type CityColor = CityInfo['color'];

const CITY_COLOR_LABELS: Record<CityColor, string> = {
  Red: '빨강',
  Blue: '파랑',
  Yellow: '노랑',
  Black: '검정'
};

const CITY_COLOR_HEX: Record<CityColor, string> = {
  Red: '#f87171',
  Blue: '#60a5fa',
  Yellow: '#facc15',
  Black: '#9ca3af'
};

const DEFAULT_CITY_COLOR = '#6b7280';

const ZONE_INFO = {
  A: {
    title: '버려진 감염 카드',
    description: '이미 공개된 감염 카드',
    accent: '#f87171'
  },
  B: {
    title: '다시 섞인 감염 카드',
    description: '전염 카드 후 위쪽에 쌓인 카드 (위 레이어부터 순서대로)',
    accent: '#fb923c'
  },
  C: {
    title: '미공개 감염 카드',
    description: '아직 공개되지 않은 감염 카드',
    accent: '#60a5fa'
  },
  D: {
    title: '게임 종료 영역',
    description: '다음 새 게임 시작 시 덱에 합류할 카드',
    accent: '#a78bfa'
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
  const [newCityCount, setNewCityCount] = useState<string>('');
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

  const handleUndo = useCallback(async () => {
    if (isBusy) {
      return;
    }
    const requestId = startRequest();
    setIsBusy(true);
    applyError(null, requestId);
    try {
      const updated = await mutateDeck('/api/deck/undo', {});
      applySnapshot(updated, requestId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '되돌리기에 실패했습니다.';
      applyError(message, requestId);
    } finally {
      setIsBusy(false);
    }
  }, [applyError, applySnapshot, isBusy, startRequest]);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (isCtrlOrMeta && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo]);

  const epidemicCandidates = useMemo(
    () => deck.zoneC.filter((city) => city.count > 0),
    [deck.zoneC]
  );

  const pileIndex = deck.playerPiles.findIndex((c) => c > 0);
  const drawedEpidemicCards = INITIAL_EPIDEMIC_COUNTS - deck.playerEpidemicCounts;
  const canTriggerEpidemic = pileIndex != 0 &&
                              drawedEpidemicCards < pileIndex &&
                              deck.playerEpidemicCounts > 0 &&
                              epidemicCandidates.length > 0;

  const epidemicProbability = useMemo(() => {
    const pileIndex = deck.playerPiles.findIndex((c) => c > 0);
    if (pileIndex == -1)
      return 0;
    const drawedEpidemicCards = INITIAL_EPIDEMIC_COUNTS - deck.playerEpidemicCounts;
    const isFirstPileEpidemicLeft = drawedEpidemicCards < pileIndex;

    const spansTwoPiles = deck.playerPiles[pileIndex] == 1;

    if (spansTwoPiles) {      
      if (isFirstPileEpidemicLeft == true)
        return 1;

      // No cards left
      if (pileIndex + 1 >= deck.playerPiles.length)
        return 0;

      return 1 / deck.playerPiles[pileIndex + 1];
    } else {
      if (isFirstPileEpidemicLeft == false)
        return 0;

      return (deck.playerPiles[pileIndex] - 1) / (deck.playerPiles[pileIndex] * (deck.playerPiles[pileIndex] - 1) / 2);
    }
  }, [deck.playerPiles, deck.playerEpidemicCounts]);

  const epidemicProbabilityLabel = useMemo(() => {
    const formatter = new Intl.NumberFormat('ko-KR', {
      style: 'percent',
      maximumFractionDigits: 1
    });
    return formatter.format(epidemicProbability);
  }, [epidemicProbability]);

  const cityInfoMap = useMemo(() => {
    const entries = new Map<string, CityInfo>();
    deck.cityInfos.forEach((info) => {
      entries.set(info.name, info);
    });
    return entries;
  }, [deck.cityInfos]);

  const playerCityColorTotals = useMemo(() => {
    const totals: Record<CityColor, number> = {
      Red: 0,
      Blue: 0,
      Yellow: 0,
      Black: 0
    };

    deck.playerCityCounts.forEach((city) => {
      const info = cityInfoMap.get(city.name);
      if (!info) {
        return;
      }
      totals[info.color] += city.count;
    });

    return totals;
  }, [cityInfoMap, deck.playerCityCounts]);

  const renderCityColorDot = useCallback(
    (cityName: string) => {
      const cityInfo = cityInfoMap.get(cityName);
      const colorValue = cityInfo ? CITY_COLOR_HEX[cityInfo.color] : DEFAULT_CITY_COLOR;

      return (
        <span
          className="cityColorDot"
          style={{ background: colorValue }}
          aria-hidden="true"
        />
      );
    },
    [cityInfoMap]
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

  const handleFullReset = useCallback(async () => {
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

  const handleNewGame = useCallback(async () => {
    if (isBusy) {
      return;
    }
    const requestId = startRequest();
    setIsBusy(true);
    applyError(null, requestId);
    try {
      const updated = await mutateDeck('/api/deck/new-game', {});
      applySnapshot(updated, requestId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '새 게임을 시작할 수 없습니다.';
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

  const handleDrawEvent = useCallback(async () => {
    const requestId = startRequest();
    setIsBusy(true);
    applyError(null, requestId);
    try {
      const updated = await mutateDeck('/api/deck/player/draw/event', {});
      applySnapshot(updated, requestId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '이벤트 드로우 실패';
      applyError(message, requestId);
    } finally {
      setIsBusy(false);
    }
  }, [applyError, applySnapshot, startRequest]);

  const handleDrawCity = useCallback(
    async (cityName: string) => {
      const requestId = startRequest();
      setIsBusy(true);
      applyError(null, requestId);
      try {
        const updated = await mutateDeck('/api/deck/player/draw/city', { city: cityName });
        applySnapshot(updated, requestId);
      } catch (err) {
        const message = err instanceof Error ? err.message : '도시 카드 드로우 실패';
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
      const parsed = Number.parseInt(newCityCount, 10);
      if (!trimmed) {
        return;
      }
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('감염 카드 장수는 1 이상이어야 합니다.');
        return;
      }
      const requestId = startRequest();
      setIsBusy(true);
      applyError(null, requestId);
      try {
        const updated = await mutateDeck('/api/deck/cities', {
          city: trimmed,
          count: Math.floor(parsed)
        });
        applySnapshot(updated, requestId);
        setNewCityName('');
        setNewCityCount('');
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
    [applyError, applySnapshot, newCityName, newCityCount, startRequest]
  );

  return (
    <main className="page">
      <header className="pageHeader">
        <div>
          <h1 className="pageTitle">판데믹 레거시 S2 덱 카운터</h1>
          <p className="pageSubtitle">모든 플레이어와 덱 상태를 공유하세요.</p>
        </div>
        <div className="headerButtons">
          <button
            className="epidemicButton"
            onClick={() => setIsEpidemicOpen(true)}
            disabled={isBusy || !canTriggerEpidemic}
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
            className="refreshButton"
            onClick={() => void handleUndo()}
            disabled={isBusy}
            aria-label="되돌리기 (Ctrl+Z)"
          >
            되돌리기
          </button>
          <button
            className="refreshButton"
            onClick={() => void handleNewGame()}
            disabled={isBusy}
          >
            새 게임
          </button>
          <button
            className="resetButton"
            onClick={() => void handleFullReset()}
            disabled={isBusy}
          >
            덱 초기화
          </button>
        </div>
      </header>

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
          <input
            type="number"
            value={newCityCount}
            onChange={(event) => setNewCityCount(event.target.value)}
            placeholder="카드 장수"
            min={1}
            step={1}
            disabled={isBusy}
            aria-label="감염 카드 장수"
          />
          <button
            type="submit"
            disabled={
              isBusy ||
              !newCityName.trim() ||
              !Number.isFinite(Number.parseInt(newCityCount, 10)) ||
              Number.parseInt(newCityCount, 10) <= 0
            }
          >
            추가
          </button>
        </form>
      </section>

      {error && <p className="errorBanner">{error}</p>}

      <div className="playerZonesLayout">
        <section>
          <p className="epidemicProbability">
            다음 2장 중 전염 카드가 등장할 확률 <strong>{epidemicProbabilityLabel}</strong>
          </p>
          <div className="playerColorTotals">
            {CITY_COLOR_ORDER.map((color) => (
              <div key={color} className={`playerColorTotalsItem color-${color.toLowerCase()}`}>
                <span>
                  <span
                    className="cityColorDot"
                    style={{ background: CITY_COLOR_HEX[color] }}
                    aria-hidden="true"
                  />
                  <span className="colorLabel">{CITY_COLOR_LABELS[color]}</span>
                </span>
                <span className="colorCount">{playerCityColorTotals[color]} 장</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="playerZonesLayout">
        <section className="playerCards">
          <div className="zoneCard" style={{ borderColor: '#8b5cf6' }}>
            <header className="zoneHeader">
              <h2>남은 플레이어 카드</h2>
              <p>도시, 이벤트, 전염 카드를 추적합니다.</p>
            </header>
            <ul className="zoneList">
              {deck.playerCityCounts.map((city) => (
                <li key={`PC-${city.name}`} className="zoneListItem">
                  <div className="zoneCityText">
                    {renderCityColorDot(city.name)}
                    <span className="cityName">{city.name}</span>
                    <span className="cityCount">
                      {city.count}
                      <span className="countUnit">장</span>
                    </span>
                  </div>
                  <button
                    className="addButton"
                    onClick={() => void handleDrawCity(city.name)}
                    disabled={isBusy}
                    aria-label={`${city.name} 도시 카드 드로우`}
                  >
                    -
                  </button>
                </li>
              ))}
              <li className="zoneListItem">
                <div className="zoneCityText">
                  <span className="cityColorDot cityColorDotEvent" aria-hidden="true" />
                  <span className="cityName">이벤트</span>
                  <span className="cityCount">
                    {deck.playerEventCounts ?? 0}
                    <span className="countUnit">장</span>
                  </span>
                </div>
                <button
                  className="addButton"
                  onClick={() => void handleDrawEvent()}
                  disabled={isBusy || (deck.playerEventCounts ?? 0) <= 0}
                  aria-label="이벤트 카드 드로우"
                >
                  -
                </button>
              </li>
              <li className="zoneListItem">
                <div className="zoneCityText">
                  <span className="cityColorDot cityColorDotEpidemic" aria-hidden="true" />
                  <span className="cityName">전염 카드</span>
                  <span className="cityCount">
                    {deck.playerEpidemicCounts}
                    <span className="countUnit">장</span>
                  </span>
                </div>
                <button
                  className="addButton"
                  onClick={() => setIsEpidemicOpen(true)}
                  disabled={isBusy || !canTriggerEpidemic}
                  aria-label="전염 카드 드로우"
                >
                  -
                </button>
              </li>
            </ul>
          </div>
        </section>

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
                    {renderCityColorDot(city.name)}
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
                {deck.zoneBLayers.map((layer, index) => {
                  const layerLabel =
                    index === 0 ? 'B1 · 상단' : `B${index + 1}`;
                  return (
                    <div key={index} className="layerBlock">
                      <div className="layerHeader">
                        <span>{layerLabel}</span>
                        <span>{1}장</span>
                      </div>
                      <ul className="zoneList">
                        {layer.map((city) => (
                          <li
                            key={`B${index + 1}-${city.name}`}
                            className="zoneListItem"
                          >
                            <div className="zoneCityText">
                              {renderCityColorDot(city.name)}
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
                    {renderCityColorDot(city.name)}
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

          <div
            className="zoneCard"
            style={{ borderColor: ZONE_INFO.D.accent }}
          >
            <header className="zoneHeader">
              <h2>{ZONE_INFO.D.title}</h2>
              <p>{ZONE_INFO.D.description}</p>
            </header>

            {deck.zoneD.length === 0 ? (
              <p className="emptyMessage">표시할 카드가 없습니다.</p>
            ) : (
              <ul className="zoneList">
                {deck.zoneD.map((city) => (
                  <li key={`D-${city.name}`} className="zoneListItem">
                    <div className="zoneCityText">
                      {renderCityColorDot(city.name)}
                      <span className="cityName">{city.name}</span>
                      <span className="cityCount">
                        {city.count}
                        <span className="countUnit">장</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

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
