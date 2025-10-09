'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Zone = 'A' | 'B' | 'C';

type DeckData = {
  cities: {
    name: string;
    counts: Record<Zone, number>;
  }[];
  totals: Record<Zone | 'total', number>;
};

const ZONE_INFO: Record<
  Zone,
  { title: string; description: string; accent: string }
> = {
  A: {
    title: 'A · 버려진 더미',
    description: '이미 공개된 감염 카드',
    accent: '#f87171'
  },
  B: {
    title: 'B · 혼합된 상단',
    description: '전염 카드 후 위쪽에 쌓인 카드',
    accent: '#fb923c'
  },
  C: {
    title: 'C · 안전한 덱',
    description: '아직 공개되지 않은 감염 카드',
    accent: '#60a5fa'
  }
};

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

function sortByZoneCount(cities: DeckData['cities'], zone: Zone) {
  return [...cities].sort((a, b) => {
    const diff = b.counts[zone] - a.counts[zone];
    if (diff !== 0) {
      return diff;
    }

    return a.name.localeCompare(b.name, 'ko');
  });
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

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const snapshot = await readSnapshot();
      setDeck(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : '덱을 갱신할 수 없습니다.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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

  const zoneViews = useMemo(() => {
    return {
      A: sortByZoneCount(deck.cities, 'A'),
      B: sortByZoneCount(deck.cities, 'B'),
      C: sortByZoneCount(deck.cities, 'C')
    };
  }, [deck.cities]);

  const epidemicCandidates = useMemo(
    () => deck.cities.filter((city) => city.counts.C > 0),
    [deck.cities]
  );

  const handleIncrement = useCallback(
    async (cityName: string) => {
      setIsBusy(true);
      setError(null);
      try {
        const updated = await mutateDeck('/api/deck/increment', {
          city: cityName
        });
        setDeck(updated);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '카드를 증가시킬 수 없습니다.'
        );
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const handleEpidemic = useCallback(
    async (cityName: string) => {
      setIsBusy(true);
      setError(null);
      try {
        const updated = await mutateDeck('/api/deck/epidemic', {
          city: cityName
        });
        setDeck(updated);
        setIsEpidemicOpen(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '전염 카드를 처리할 수 없습니다.'
        );
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const handleAddCity = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = newCityName.trim();
      if (!trimmed) {
        return;
      }
      setIsBusy(true);
      setError(null);
      try {
        const updated = await mutateDeck('/api/deck/cities', {
          city: trimmed
        });
        setDeck(updated);
        setNewCityName('');
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : '새 도시를 추가할 수 없습니다.'
        );
      } finally {
        setIsBusy(false);
      }
    },
    [newCityName]
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
        {(Object.keys(ZONE_INFO) as Zone[]).map((zone) => (
          <div
            key={zone}
            className="zoneCard"
            style={{ borderColor: ZONE_INFO[zone].accent }}
          >
            <header className="zoneHeader">
              <h2>{ZONE_INFO[zone].title}</h2>
              <p>{ZONE_INFO[zone].description}</p>
            </header>

            <ul className="zoneList">
              {zoneViews[zone].map((city) => (
                <li key={`${zone}-${city.name}`} className="zoneListItem">
                  <div className="zoneCityText">
                    <span className="cityName">{city.name}</span>
                    <span className="cityCount">
                      {city.counts[zone]}
                      <span className="countUnit">장</span>
                    </span>
                  </div>
                  {zone === 'A' && (
                    <button
                      className="addButton"
                      onClick={() => void handleIncrement(city.name)}
                      disabled={isBusy}
                    >
                      +
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
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
                      <span>{city.counts.C}장</span>
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
