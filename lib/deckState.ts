import { kv } from '@vercel/kv';

const KV_DECK_KEY = 'pandemic:deck-state:v1';

export const CITY_COLOR_ORDER: CityColor[] = ['Blue', 'Yellow', 'Black', 'Red'];

const INITIAL_CITIES: CityInfo[] = [
  {
    name: '뉴욕',
    color: 'Blue',
    infectionCardsCount: 3,
    playerCardsCount: 4,
  },
  {
    name: '워싱턴',
    color: 'Blue',
    infectionCardsCount: 3,
    playerCardsCount: 4,
  },
  {
    name: '잭슨빌',
    color: 'Yellow',
    infectionCardsCount: 3,
    playerCardsCount: 4,
  },
  {
    name: '상파울루',
    color: 'Yellow',
    infectionCardsCount: 3,
    playerCardsCount: 4,
  },
  {
    name: '런던',
    color: 'Blue',
    infectionCardsCount: 3,
    playerCardsCount: 4,
  },
  {
    name: '이스탄불',
    color: 'Black',
    infectionCardsCount: 3,
    playerCardsCount: 4,
  },
  {
    name: '트리폴리',
    color: 'Black',
    infectionCardsCount: 3,
    playerCardsCount: 4,
  },
  {
    name: '카이로',
    color: 'Black',
    infectionCardsCount: 3,
    playerCardsCount: 4,
  },
  {
    name: '라고스',
    color: 'Yellow',
    infectionCardsCount: 3,
    playerCardsCount: 4,
  },
];

export type CityColor = 'Red' | 'Blue' | 'Yellow' | 'Black';

export type CityInfo = {
  name: string;
  color: CityColor;
  infectionCardsCount: number;
  playerCardsCount: number;
}

export interface CityCardsSnapshot {
  name: string;
  count: number;
}

type InfectionCityCardsState = {
  name: string;
  color: CityColor;
  discard: number;
  safe: number;
  pending: number;
  removed: number;
};

// State of the game at specific moment.
type GameState = {
  revision: number;

  cityInfos: CityInfo[];

  infectionCityCardsStates: InfectionCityCardsState[];
  zoneBLayers: CityCardsSnapshot[][];

  playerPiles: number[];
  playerCityCounts: CityCardsSnapshot[];
  playerRemovedCityCounts: CityCardsSnapshot[];
  playerDrawnCityCounts: CityCardsSnapshot[];
  playerEventCounts: number;
  playerEpidemicCounts: number;
  playerDrawnEventCounts: number;
  playerDrawnEpidemicCounts: number;
  initialEpidemicCounts: number;
};

// Total data for DB storage, contains state history
type GameStorage = GameState[];

// UI related Data. Only GameSnapshot is sent to frontend
export interface GameSnapshot {
  revision: number;

  cityInfos: CityInfo[];

  zoneA: CityCardsSnapshot[];
  zoneBLayers: CityCardsSnapshot[][];
  zoneC: CityCardsSnapshot[];
  zoneD: CityCardsSnapshot[];
  removed: CityCardsSnapshot[];
  
  playerPiles: number[];
  playerCityCounts: CityCardsSnapshot[];
  playerRemovedCityCounts: CityCardsSnapshot[];
  playerEventCounts: number;
  playerEpidemicCounts: number;
  playerDrawnCityCounts: CityCardsSnapshot[];
  playerDrawnEventCounts: number;
  playerDrawnEpidemicCounts: number;
  initialEpidemicCounts: number;
}

type StateMutation = (state: GameState) => GameState;

const EPIDEMIC_CARD_RULES: { maxCityCards: number; epidemicCards: number }[] = [
  { maxCityCards: 36, epidemicCards: 5 },
  { maxCityCards: 44, epidemicCards: 6 },
  { maxCityCards: 51, epidemicCards: 7 },
  { maxCityCards: 57, epidemicCards: 8 },
  { maxCityCards: 62, epidemicCards: 9 },
  { maxCityCards: Number.POSITIVE_INFINITY, epidemicCards: 10 },
];

// Decide epidemic cards only from the number of city cards (exclude events/epidemics).
export function calculateInitialEpidemicCounts(
  cityInfos: CityInfo[],
  removedPlayerCityCounts?: Record<string, number>
): number {
  const totalCityCards = cityInfos.reduce((acc, cityInfo) => {
    const removedCount = removedPlayerCityCounts?.[cityInfo.name] ?? 0;
    return acc + Math.max(0, cityInfo.playerCardsCount - removedCount);
  }, 0);
  const matchedRule = EPIDEMIC_CARD_RULES.find((rule) => totalCityCards <= rule.maxCityCards);
  return matchedRule?.epidemicCards ?? 10;
}

const hasKv =
  typeof process.env.KV_REST_API_URL === 'string' ||
  typeof process.env.KV_URL === 'string' ||
  typeof process.env.UPSTASH_REDIS_REST_URL === 'string';

let memoryStorage: GameStorage | null = null;

// Serialise state operations so concurrent requests cannot overwrite each other.
let stateQueue: Promise<void> = Promise.resolve();

function enqueueStateWork<T>(work: () => Promise<T>): Promise<T> {
  const run = stateQueue.then(work, work);
  stateQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normaliseCityName(name: string) {
  return name.trim();
}

function createInitialState(
  cityInfos: CityInfo[],
  players?: number,
  eventCount?: number,
  removedCounts?: Record<string, number>,
  removedPlayerCityCounts?: Record<string, number>
): GameState {
  players = players ?? 4;
  eventCount = eventCount ?? 4;

  const initialDraws = players == 3 ? 9 : 8;
  const initialEpidemicCounts = calculateInitialEpidemicCounts(
    cityInfos,
    removedPlayerCityCounts
  );
  const cityCards = cityInfos.reduce((acc, cityInfo) => {
    const removedCount = removedPlayerCityCounts?.[cityInfo.name] ?? 0;
    return acc + Math.max(0, cityInfo.playerCardsCount - removedCount);
  }, 0);
  const remaining = cityCards + eventCount + initialEpidemicCounts - initialDraws;
  
  // Split remaining into epidemicCount piles as evenly as possible, larger piles on top
  const base = Math.floor(remaining / initialEpidemicCounts);
  let extra = remaining % initialEpidemicCounts;
  const epidemicPiles: number[] = [];
  for (let i = 0; i < initialEpidemicCounts; i += 1) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    epidemicPiles.push(size);
  }

  let state: GameState = {
    revision: 0,
    cityInfos: cloneState(cityInfos),
    infectionCityCardsStates: cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      color: cityInfo.color,
      discard: 0,
      safe: cityInfo.infectionCardsCount - Math.max(0, Math.min(cityInfo.infectionCardsCount, removedCounts?.[cityInfo.name] ?? 0)),
      pending: 0,
      removed: Math.max(0, Math.min(cityInfo.infectionCardsCount, removedCounts?.[cityInfo.name] ?? 0)),
    })),
    zoneBLayers: [],
    
    playerPiles: [initialDraws, ...epidemicPiles],
    playerCityCounts: cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      count: Math.max(
        0,
        cityInfo.playerCardsCount - (removedPlayerCityCounts?.[cityInfo.name] ?? 0)
      )
    })),
    playerRemovedCityCounts: cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      count: Math.max(
        0,
        Math.min(
          cityInfo.playerCardsCount,
          removedPlayerCityCounts?.[cityInfo.name] ?? 0
        )
      )
    })),
    playerDrawnCityCounts: cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      count: 0,
    })),
    playerEventCounts: eventCount,
    playerEpidemicCounts: initialEpidemicCounts,
    playerDrawnEventCounts: 0,
    playerDrawnEpidemicCounts: 0,
    initialEpidemicCounts,
  };

  return state;
}

async function loadStorage(): Promise<GameStorage> {
  if (hasKv) {
    const stored = await kv.get<GameStorage>(KV_DECK_KEY);
    if (stored) {
      return cloneState(stored).map((state) => migrateState(state));
    }
    const initial = [createInitialState(INITIAL_CITIES)];
    await kv.set(KV_DECK_KEY, initial);
    return cloneState(initial).map((state) => migrateState(state));
  }

  if (!memoryStorage) {
    memoryStorage = [createInitialState(INITIAL_CITIES)];
  }

  return cloneState(memoryStorage).map((state) => migrateState(state));
}

async function saveStorage(storage: GameStorage) {
  if (hasKv) {
    await kv.set(KV_DECK_KEY, storage);
    return;
  }

  memoryStorage = cloneState(storage);
}

function getCurrentState(storage: GameStorage): GameState {
  return storage[storage.length - 1];
}

function migrateInfectionCityState(entry: InfectionCityCardsState): InfectionCityCardsState {
  const migrated = entry as InfectionCityCardsState & { removed?: number };
  if (typeof migrated.removed !== 'number' || Number.isNaN(migrated.removed)) {
    migrated.removed = 0;
  }
  return migrated as InfectionCityCardsState;
}

function migrateState(state: GameState): GameState {
  state.infectionCityCardsStates = state.infectionCityCardsStates.map((entry) => migrateInfectionCityState(entry));
  if (typeof state.initialEpidemicCounts !== 'number' || Number.isNaN(state.initialEpidemicCounts)) {
    state.initialEpidemicCounts = Math.max(1, state.playerPiles.length - 1);
  }
  if (!Array.isArray(state.playerRemovedCityCounts)) {
    state.playerRemovedCityCounts = state.cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      count: 0,
    }));
  } else {
    const existing = new Map(state.playerRemovedCityCounts.map((entry) => [entry.name, entry.count]));
    state.playerRemovedCityCounts = state.cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      count: Math.max(0, existing.get(cityInfo.name) ?? 0),
    }));
  }
  if (!Array.isArray(state.playerDrawnCityCounts)) {
    state.playerDrawnCityCounts = state.cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      count: 0,
    }));
  } else {
    const existing = new Map(state.playerDrawnCityCounts.map((entry) => [entry.name, entry.count]));
    state.playerDrawnCityCounts = state.cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      count: Math.max(0, existing.get(cityInfo.name) ?? 0),
    }));
  }
  if (typeof state.playerDrawnEventCounts !== 'number' || Number.isNaN(state.playerDrawnEventCounts)) {
    state.playerDrawnEventCounts = 0;
  }
  if (typeof state.playerDrawnEpidemicCounts !== 'number' || Number.isNaN(state.playerDrawnEpidemicCounts)) {
    state.playerDrawnEpidemicCounts = 0;
  }
  return state;
}

async function updateState(mutator: StateMutation): Promise<GameSnapshot> {
  return enqueueStateWork(async () => {
    let storage = await loadStorage();

    let oldState = cloneState(getCurrentState(storage));
    let newState = mutator(oldState);
    cleanupEmptyLayers(newState);
    newState.revision = oldState.revision + 1;

    storage = [...storage, newState];
    if (storage.length > 20)
      storage.splice(0, storage.length - 20);

    await saveStorage(storage);
    return buildSnapshot(newState);
  });
}

export async function undoLastOperation(): Promise<GameSnapshot> {
  return enqueueStateWork(async () => {
    let storage = await loadStorage();
    if (storage.length <= 1) {
      throw new Error('되돌릴 내역이 없습니다.');
    }
    let currentState = cloneState(getCurrentState(storage));
    storage.pop();
    storage[storage.length - 1].revision = currentState.revision + 1;
    await saveStorage(storage);
    return buildSnapshot(getCurrentState(storage));
  });
}

function cleanupEmptyLayers(state: GameState) {
  for (let index = state.zoneBLayers.length - 1; index >= 0; index -= 1) {
    const layer = state.zoneBLayers[index];
    const hasCards = layer.some((city) => city.count > 0);
    if (!hasCards) {
      state.zoneBLayers.splice(index, 1);
    }
  }
}

export const CITY_COLOR_PRIORITY = new Map(
  CITY_COLOR_ORDER.map((color, index) => [color, index] as const)
);

function sortCities(state: GameState, list: CityCardsSnapshot[]): CityCardsSnapshot[] {
  const cityColorMap = new Map<string, CityColor>();
  state.cityInfos.forEach((cityInfo) => cityColorMap.set(cityInfo.name, cityInfo.color));

  const fallbackPriority = CITY_COLOR_ORDER.length;

  return [...list].sort((a, b) => {
    const colorA = cityColorMap.get(a.name);
    const colorB = cityColorMap.get(b.name);

    const priorityA =
      colorA !== undefined ? CITY_COLOR_PRIORITY.get(colorA) ?? fallbackPriority : fallbackPriority;
    const priorityB =
      colorB !== undefined ? CITY_COLOR_PRIORITY.get(colorB) ?? fallbackPriority : fallbackPriority;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a.name.localeCompare(b.name, 'ko');
  });
}

function buildZoneA(state: GameState): CityCardsSnapshot[] {
  const list = state.cityInfos.map((cityInfo) => {
    const infectionCityCardsState = getInfectionCityCardsState(state, cityInfo.name);

    return {
      name: infectionCityCardsState.name,
      count: infectionCityCardsState.discard
    };
  });

  return sortCities(state, list);
}

function buildZoneC(state: GameState): CityCardsSnapshot[] {
  const list = state.cityInfos.map((cityInfo) => {
    const infectionCityCardsState = getInfectionCityCardsState(state, cityInfo.name);

    return {
      name: infectionCityCardsState.name,
      count: infectionCityCardsState.safe
    };
  });

  return sortCities(state, list);
}

function buildZoneD(state: GameState): CityCardsSnapshot[] {
  const list = state.cityInfos.map((cityInfo) => {
    const infectionCityCardsState = getInfectionCityCardsState(state, cityInfo.name);

    return {
      name: infectionCityCardsState.name,
      count: infectionCityCardsState.pending
    };
  });

  return sortCities(state, list).filter((c) => c.count > 0);
}

function buildRemoved(state: GameState): CityCardsSnapshot[] {
  const list = state.cityInfos.map((cityInfo) => {
    const infectionCityCardsState = getInfectionCityCardsState(state, cityInfo.name);

    return {
      name: infectionCityCardsState.name,
      count: infectionCityCardsState.removed,
    };
  });

  return sortCities(state, list).filter((c) => c.count > 0);
}

function buildZoneBLayers(state: GameState): CityCardsSnapshot[][] {
  return cloneState(state.zoneBLayers).map((cityState) => sortCities(state, cityState));
}

function buildSnapshot(state: GameState): GameSnapshot {
  return {
    revision: state.revision,
    zoneA: buildZoneA(state),
    zoneBLayers: buildZoneBLayers(state),
    zoneC: buildZoneC(state),
    zoneD: buildZoneD(state),
    removed: buildRemoved(state),

    playerPiles: cloneState(state.playerPiles),
    playerCityCounts: sortCities(state, state.playerCityCounts),
    playerRemovedCityCounts: sortCities(state, state.playerRemovedCityCounts),
    playerDrawnCityCounts: sortCities(state, state.playerDrawnCityCounts),
    playerEventCounts: state.playerEventCounts,
    playerEpidemicCounts: state.playerEpidemicCounts,
    playerDrawnEventCounts: state.playerDrawnEventCounts,
    playerDrawnEpidemicCounts: state.playerDrawnEpidemicCounts,
    initialEpidemicCounts: state.initialEpidemicCounts,
    cityInfos: cloneState(state.cityInfos),
  };
}

export async function getGameSnapshot(): Promise<GameSnapshot> {
  return enqueueStateWork(async () => {
    const storage = await loadStorage();
    return buildSnapshot(getCurrentState(storage));
  });
}

function getInfectionCityCardsState(state: GameState, cityname: string): InfectionCityCardsState {
  const result = state.infectionCityCardsStates.find((state) => state.name == cityname);
  if (result === undefined)
    throw new Error('해당하는 도시의 감염 카드 정보가 없습니다.');

  return result
}

export async function discardInfectionCard(cityName: string): Promise<GameSnapshot> {
  return updateState((state) => {
    const cityState = getInfectionCityCardsState(state, cityName);

    if (state.zoneBLayers.length <= 0) {
      if (cityState.safe <= 0) {
        throw new Error(`미공개 감염 카드 중에 ${cityState.name} 도시 카드가 없습니다.`);
      }
      cityState.safe -= 1;
    } else {
      const topLayer = state.zoneBLayers[0];

      const current = topLayer.find((city) => city.name == cityName);
      if (current === undefined || current.count <= 0 ) {
        throw new Error(`다시 섞인 감염 카드에 ${cityState.name} 카드가 없습니다.`);
      }
      
      current.count -= 1;
    }

    cityState.discard += 1;

    return state;
  });
}

export async function removeDiscardedInfectionCard(cityName: string): Promise<GameSnapshot> {
  return updateState((state) => {
    const cityState = getInfectionCityCardsState(state, cityName);

    if (cityState.discard <= 0) {
      throw new Error(`버려진 감염 카드 더미에 ${cityState.name} 카드가 없습니다.`);
    }

    cityState.discard -= 1;
    cityState.removed += 1;

    return state;
  });
}

export async function addCity(
  cityName: string,
  count: number,
  color: CityColor
): Promise<GameSnapshot> {
  return updateState((state) => {
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
      throw new Error('감염 카드 장수는 1 이상이어야 합니다.');
    }

    const key = normaliseCityName(cityName);
    if (!key) {
      throw new Error('도시 이름이 필요합니다.');
    }

    const result = state.infectionCityCardsStates.find((state) => state.name == key);
    if (result !== undefined)
      throw new Error('이미 존재하는 도시입니다.');

    state.cityInfos.push({name: cityName, color: color, playerCardsCount: count, infectionCardsCount: count});
    state.infectionCityCardsStates.push({
      name: cityName,
      color: color,
      discard: 0,
      safe: 0,
      pending: count,
      removed: 0,
    });
    state.playerCityCounts.push({
      name: cityName,
      count: 0,
    });
    state.playerRemovedCityCounts.push({
      name: cityName,
      count: 0,
    });
    state.playerDrawnCityCounts.push({
      name: cityName,
      count: 0,
    });

    return state;
  });
}

export async function resetToInitial(): Promise<GameSnapshot> {
  return updateState((state) => {
    return createInitialState(INITIAL_CITIES);
  });
}

export async function startNewGame(params?: { players?: number; eventCount?: number }): Promise<GameSnapshot> {
  return updateState((state) => {
    const removedCounts = state.infectionCityCardsStates.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.name] = entry.removed;
      return acc;
    }, {});
    const removedPlayerCounts = state.playerRemovedCityCounts.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.name] = entry.count;
      return acc;
    }, {});
    return createInitialState(
      state.cityInfos,
      params?.players,
      params?.eventCount,
      removedCounts,
      removedPlayerCounts
    );
  });
}

function drawFromTopPile(state: GameState, isEpidemic?: boolean) {
  const idx = state.playerPiles.findIndex((c) => c > 0);
  if (idx === -1) {
    throw new Error('플레이어 덱에 남은 카드가 없습니다.');
  }

  const drawedEpidemicCards = state.initialEpidemicCounts - state.playerEpidemicCounts;

  // Cannot draw epidemic cards for initial draws
  if (idx == 0 && isEpidemic == true)
    throw new Error('초기 드로우에는 전염 카드가 나올 수 없습니다.');

  // Cannot draw epidemic cards when there is none
  if (drawedEpidemicCards >= idx && isEpidemic == true)
    throw new Error('현재 남은 장수 상 전염 카드가 나올 수 없습니다.');

  // Last card should be epidemic card
  if (state.playerPiles[idx] == 1) {
    if (drawedEpidemicCards < idx && isEpidemic != true)
      throw new Error('현재 남은 장수 상 전염 카드가 나와야 합니다.');
  }

  state.playerPiles[idx] -= 1;
}

export async function drawPlayerCity(cityName: string): Promise<GameSnapshot> {
  return updateState((state) => {
    const key = normaliseCityName(cityName);
    const current = state.playerCityCounts.find((city) => city.name == key);
    if (current === undefined || current.count <= 0) {
      throw new Error(`${key} 도시 카드가 남아있지 않습니다.`);
    }

    drawFromTopPile(state);
    current.count -= 1;
    const drawn = state.playerDrawnCityCounts.find((city) => city.name === key);
    if (!drawn) {
      state.playerDrawnCityCounts.push({ name: key, count: 1 });
    } else {
      drawn.count += 1;
    }

    return state;
  });
}

export async function drawPlayerEvent(): Promise<GameSnapshot> {
  return updateState((state) => {
    if (state.playerEventCounts <= 0) {
      throw new Error('이벤트 카드가 남아있지 않습니다.');
    }

    drawFromTopPile(state);
    state.playerEventCounts -= 1;
    state.playerDrawnEventCounts += 1;

    return state;
  });
}

export async function drawPlayerEpidemic(bottomInfectionCityCard: string): Promise<GameSnapshot> {
  return updateState((state) => {
    if (state.playerEpidemicCounts <= 0) {
      throw new Error('남은 전염 카드가 없습니다.');
    }

    const cityState = getInfectionCityCardsState(state, bottomInfectionCityCard);
    if (cityState.safe <= 0) {
      throw new Error(`미공개 감염 카드 중에 ${cityState.name} 도시 카드가 없습니다.`);
    }

    drawFromTopPile(state, true);
    cityState.safe -= 1;
    cityState.discard += 1;

    const newLayerCards: CityCardsSnapshot[] = [];

    state.infectionCityCardsStates.forEach((entry) => {
      if (entry.discard > 0) {
        newLayerCards.push({name: entry.name, count: entry.discard})
        entry.discard = 0;
      }
    });

    const hasCards = Object.keys(newLayerCards).length > 0;
    if (!hasCards) {
      throw new Error('전염 카드 처리 중 버린 감염 카드 더미가 없는 오류가 발생했습니다.');
    }

    state.zoneBLayers = [newLayerCards, ...state.zoneBLayers];
    state.playerEpidemicCounts -= 1;
    state.playerDrawnEpidemicCounts += 1;

    return state;
  });
}

export async function drawPlayerEpidemicWithoutEffect(): Promise<GameSnapshot> {
  return updateState((state) => {
    if (state.playerEpidemicCounts <= 0) {
      throw new Error('?⑥? ?꾩뿼 移대뱶媛 ?놁뒿?덈떎.');
    }

    drawFromTopPile(state, true);
    state.playerEpidemicCounts -= 1;
    state.playerDrawnEpidemicCounts += 1;

    return state;
  });
}

function addCardToZoneBTop(state: GameState, cityName: string) {
  if (state.zoneBLayers.length === 0) {
    state.zoneBLayers.push([]);
  }

  const topLayer = state.zoneBLayers[0];
  const existing = topLayer.find((entry) => entry.name === cityName);
  if (existing) {
    existing.count += 1;
  } else {
    topLayer.push({ name: cityName, count: 1 });
  }
}

export async function returnRemovedInfectionCard(
  cityName: string,
  targetZone: 'A' | 'B' | 'C'
): Promise<GameSnapshot> {
  return updateState((state) => {
    const cityState = getInfectionCityCardsState(state, cityName);
    if (cityState.removed <= 0) {
      throw new Error(`제거된 감염 카드 중에 ${cityState.name} 카드가 없습니다.`);
    }

    cityState.removed -= 1;

    if (targetZone === 'A') {
      cityState.discard += 1;
    } else if (targetZone === 'B') {
      addCardToZoneBTop(state, cityName);
    } else if (targetZone === 'C') {
      cityState.safe += 1;
    } else {
      throw new Error('유효하지 않은 영역입니다.');
    }

    return state;
  });
}

export async function removePlayerCityCard(cityName: string): Promise<GameSnapshot> {
  return updateState((state) => {
    const key = normaliseCityName(cityName);
    if (!key) {
      throw new Error('도시 이름이 필요합니다.');
    }

    const cityInfo = state.cityInfos.find((info) => info.name === key);
    if (!cityInfo) {
      throw new Error('해당하는 도시의 정보가 없습니다.');
    }

    const removedEntry = state.playerRemovedCityCounts.find((entry) => entry.name === key);
    if (!removedEntry) {
      throw new Error('제거된 도시 카드 정보가 없습니다.');
    }

    const drawnEntry = state.playerDrawnCityCounts.find((entry) => entry.name === key);
    if (!drawnEntry || drawnEntry.count <= 0) {
      throw new Error('드로우한 도시 카드가 없습니다.');
    }

    if (removedEntry.count >= cityInfo.playerCardsCount) {
      throw new Error('더 이상 제거할 수 없습니다.');
    }

    drawnEntry.count -= 1;
    removedEntry.count += 1;
    return state;
  });
}

export async function returnRemovedPlayerCityCard(cityName: string): Promise<GameSnapshot> {
  return updateState((state) => {
    const key = normaliseCityName(cityName);
    if (!key) {
      throw new Error('도시 이름이 필요합니다.');
    }

    const removedEntry = state.playerRemovedCityCounts.find((entry) => entry.name === key);
    if (!removedEntry || removedEntry.count <= 0) {
      throw new Error('제거된 도시 카드가 없습니다.');
    }

    removedEntry.count -= 1;
    return state;
  });
}
