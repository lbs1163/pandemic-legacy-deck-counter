'use client';

import {
  INITIAL_EPIDEMIC_COUNTS,
  type CityInfo,
  type GameSnapshot
} from '@/lib/deckState';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeckHeader } from './DeckHeader';
import { EpidemicOverlay } from './EpidemicOverlay';
import { InfectionPrediction } from './InfectionPrediction';
import { InfectionZones } from './InfectionZones';
import { NewCityForm } from './NewCityForm';
import { PlayerCards } from './PlayerCards';
import { PlayerDeckSummary, type PlayerPileSummary } from './PlayerDeckSummary';
import { CITY_COLOR_ORDER } from './deckConstants';
import { calculateEpidemicProbs, calculateProbs, CityProbability } from './utils';

type DeckData = GameSnapshot;

type CityColor = CityInfo['color'];

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
  const [newCityColor, setNewCityColor] = useState<CityColor>(CITY_COLOR_ORDER[0]);
  const [predictEpidemic, setPredictEpidemic] = useState<boolean>(false);
  const [numDraw, setNumDraw] = useState<number>(2);
  const [newGamePlayers, setNewGamePlayers] = useState<number>(4);
  const [newGameEventCount, setNewGameEventCount] = useState<number>(4);
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
  const isEpidemicInCurrentPile =
    pileIndex > 0 &&
    drawedEpidemicCards < pileIndex &&
    deck.playerEpidemicCounts > 0;

  const canTriggerEpidemic =
    isEpidemicInCurrentPile && epidemicCandidates.length > 0;

  useEffect(() => {
    if (!canTriggerEpidemic && predictEpidemic) {
      setPredictEpidemic(false);
    }
  }, [canTriggerEpidemic, predictEpidemic]);

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

  const cityProbabilities = useMemo(() => {
    const probs = calculateProbs([...deck.zoneBLayers, deck.zoneC], numDraw, deck.cityInfos);

    if (canTriggerEpidemic == false)
      return {
        nonEpidemic: probs,
        epidemic: []
      };
    else {
      const epidemicProbs = calculateEpidemicProbs(deck.zoneA, deck.zoneBLayers, deck.zoneC, numDraw, deck.cityInfos);
      return {
        nonEpidemic: probs,
        epidemic: epidemicProbs,
      }
    }
  }, [canTriggerEpidemic, deck.zoneA, deck.zoneBLayers, deck.zoneC, numDraw, deck.cityInfos]);

  const probabilityFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ko-KR', {
        style: 'percent',
        maximumFractionDigits: 1
      }),
    []
  );

  const showingCityProbabilities: CityProbability[] = predictEpidemic && canTriggerEpidemic
    ? cityProbabilities.epidemic
    : cityProbabilities.nonEpidemic;

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

  const playerPileSummaries = useMemo<PlayerPileSummary[]>(() => {
    return deck.playerPiles.map((count, index) => {
      const isActive = index === pileIndex && count > 0;
      return {
        count,
        index,
        isActive,
        hasEpidemic: isActive && isEpidemicInCurrentPile
      };
    });
  }, [deck.playerPiles, pileIndex, isEpidemicInCurrentPile]);

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

  const handleRemoveDiscard = useCallback(
    async (cityName: string) => {
      const requestId = startRequest();
      setIsBusy(true);
      applyError(null, requestId);
      try {
        const updated = await mutateDeck('/api/deck/discard/remove', { city: cityName });
        applySnapshot(updated, requestId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '제거된 감염 카드를 처리할 수 없습니다.';
        applyError(message, requestId);
      } finally {
        setIsBusy(false);
      }
    },
    [applyError, applySnapshot, startRequest]
  );

  const handleReturnRemoved = useCallback(
    async (cityName: string, zone: 'A' | 'B' | 'C') => {
      const requestId = startRequest();
      setIsBusy(true);
      applyError(null, requestId);
      try {
        const updated = await mutateDeck('/api/deck/removed/return', { city: cityName, zone });
        applySnapshot(updated, requestId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '제거된 감염 카드를 복구할 수 없습니다.';
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
      const updated = await mutateDeck('/api/deck/new-game', {
        players: newGamePlayers,
        eventCount: newGameEventCount,
      });
      applySnapshot(updated, requestId);
    } catch (err) {
      const message = err instanceof Error ? err.message : '새 게임을 시작할 수 없습니다.';
      applyError(message, requestId);
    } finally {
      setIsBusy(false);
    }
  }, [applyError, applySnapshot, isBusy, startRequest, newGamePlayers, newGameEventCount]);

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
      if (!CITY_COLOR_ORDER.includes(newCityColor)) {
        setError('도시 색상을 선택해 주세요.');
        return;
      }
      const requestId = startRequest();
      setIsBusy(true);
      applyError(null, requestId);
      try {
        const updated = await mutateDeck('/api/deck/cities', {
          city: trimmed,
          count: Math.floor(parsed),
          color: newCityColor
        });
        applySnapshot(updated, requestId);
        setNewCityName('');
        setNewCityCount('');
        setNewCityColor(CITY_COLOR_ORDER[0]);
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
    [applyError, applySnapshot, newCityColor, newCityName, newCityCount, startRequest]
  );

  return (
    <main className="page">
      <DeckHeader
        isBusy={isBusy}
        isRefreshing={isRefreshing}
        canTriggerEpidemic={canTriggerEpidemic}
        newGamePlayers={newGamePlayers}
        newGameEventCount={newGameEventCount}
        onChangePlayers={setNewGamePlayers}
        onChangeEventCount={setNewGameEventCount}
        onOpenEpidemic={() => setIsEpidemicOpen(true)}
        onRefresh={() => void refresh()}
        onUndo={() => void handleUndo()}
        onNewGame={() => void handleNewGame()}
        onReset={() => void handleFullReset()}
      />

      <NewCityForm
        cityName={newCityName}
        cityCount={newCityCount}
        cityColor={newCityColor}
        isBusy={isBusy}
        onChangeName={setNewCityName}
        onChangeCount={setNewCityCount}
        onSelectColor={setNewCityColor}
        onSubmit={handleAddCity}
      />

      {error && <p className="errorBanner">{error}</p>}

      <div className="playerZonesLayout">
        <PlayerDeckSummary
          epidemicProbabilityLabel={epidemicProbabilityLabel}
          piles={playerPileSummaries}
          cityColorTotals={playerCityColorTotals}
        />

        <InfectionPrediction
          numDraw={numDraw}
          predictEpidemic={predictEpidemic}
          canTriggerEpidemic={canTriggerEpidemic}
          probabilities={showingCityProbabilities}
          probabilityFormatter={probabilityFormatter}
          cityInfoMap={cityInfoMap}
          onChangeNumDraw={setNumDraw}
          onTogglePredict={setPredictEpidemic}
        />

        <PlayerCards
          cities={deck.playerCityCounts}
          eventCount={deck.playerEventCounts ?? 0}
          epidemicCount={deck.playerEpidemicCounts}
          isBusy={isBusy}
          canTriggerEpidemic={canTriggerEpidemic}
          cityInfoMap={cityInfoMap}
          onDrawCity={(cityName) => void handleDrawCity(cityName)}
          onDrawEvent={() => void handleDrawEvent()}
          onOpenEpidemic={() => setIsEpidemicOpen(true)}
        />

        <InfectionZones
          zoneA={deck.zoneA}
          zoneBLayers={deck.zoneBLayers}
          zoneC={deck.zoneC}
          zoneD={deck.zoneD}
          removed={deck.removed}
          isBusy={isBusy}
          cityInfoMap={cityInfoMap}
          onIncrement={(cityName) => void handleIncrement(cityName)}
          onRemoveDiscard={(cityName) => void handleRemoveDiscard(cityName)}
          onReturnRemoved={(cityName, zone) => void handleReturnRemoved(cityName, zone)}
        />
      </div>

      <EpidemicOverlay
        isOpen={isEpidemicOpen}
        candidates={epidemicCandidates}
        isBusy={isBusy}
        onSelect={(cityName) => void handleEpidemic(cityName)}
        onClose={() => setIsEpidemicOpen(false)}
      />
    </main>
  );
}
