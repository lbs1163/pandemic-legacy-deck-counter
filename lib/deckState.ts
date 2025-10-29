import { kv } from '@vercel/kv';

const KV_DECK_KEY = 'pandemic:deck-state:v1';

export const CITY_COLOR_ORDER: CityColor[] = ['Blue', 'Yellow', 'Black', 'Red'];

export const INITIAL_EPIDEMIC_COUNTS = 5;

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
};

// State of the game at specific moment.
type GameState = {
  revision: number;

  cityInfos: CityInfo[];

  infectionCityCardsStates: InfectionCityCardsState[];
  zoneBLayers: CityCardsSnapshot[][];

  playerPiles: number[];
  playerCityCounts: CityCardsSnapshot[];
  playerEventCounts: number;
  playerEpidemicCounts: number;
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
  
  playerPiles: number[];
  playerCityCounts: CityCardsSnapshot[];
  playerEventCounts: number;
  playerEpidemicCounts: number;
}

type StateMutation = (state: GameState) => GameState;

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

function createInitialState(cityInfos: CityInfo[], players?: number, eventCount?: number): GameState {
  players = players ?? 4;
  eventCount = eventCount ?? 4;

  const initialDraws = players == 3 ? 9 : 8;
  const cityCards = cityInfos.reduce((acc, cityInfo) => acc + cityInfo.playerCardsCount, 0);
  const remaining = cityCards + eventCount + INITIAL_EPIDEMIC_COUNTS - initialDraws;
  
  // Split remaining into 5 piles as evenly as possible, larger piles on top
  const base = Math.floor(remaining / INITIAL_EPIDEMIC_COUNTS);
  let extra = remaining % INITIAL_EPIDEMIC_COUNTS;
  const fivePiles: number[] = [];
  for (let i = 0; i < INITIAL_EPIDEMIC_COUNTS; i += 1) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    fivePiles.push(size + 1); // +1 epidemic per pile
  }

  let state: GameState = {
    revision: 0,
    cityInfos: cloneState(cityInfos),
    infectionCityCardsStates: cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      color: cityInfo.color,
      discard: 0,
      safe: cityInfo.infectionCardsCount,
      pending: 0,
    })),
    zoneBLayers: [],
    
    playerPiles: [initialDraws, ...fivePiles],
    playerCityCounts: cityInfos.map((cityInfo) => ({
      name: cityInfo.name,
      count: cityInfo.playerCardsCount
    })),
    playerEventCounts: eventCount,
    playerEpidemicCounts: INITIAL_EPIDEMIC_COUNTS,
  };

  return state;
}

async function loadStorage(): Promise<GameStorage> {
  if (hasKv) {
    const stored = await kv.get<GameStorage>(KV_DECK_KEY);
    if (stored) {
      return cloneState(stored);
    }
    const initial = [createInitialState(INITIAL_CITIES)];
    await kv.set(KV_DECK_KEY, initial);
    return cloneState(initial);
  }

  if (!memoryStorage) {
    memoryStorage = [createInitialState(INITIAL_CITIES)];
  }

  return cloneState(memoryStorage);
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

    playerPiles: cloneState(state.playerPiles),
    playerCityCounts: sortCities(state, state.playerCityCounts),
    playerEventCounts: state.playerEventCounts,
    playerEpidemicCounts: state.playerEpidemicCounts,
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

    // Only update city infos because updated city info will be affected when new game started (for both infection card and player card)
    state.cityInfos.push({name: cityName, color: color, playerCardsCount: count, infectionCardsCount: count});

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
    return createInitialState(state.cityInfos, params?.players, params?.eventCount);
  });
}

function drawFromTopPile(state: GameState, isEpidemic?: boolean) {
  const idx = state.playerPiles.findIndex((c) => c > 0);
  if (idx === -1) {
    throw new Error('플레이어 덱에 남은 카드가 없습니다.');
  }

  const drawedEpidemicCards = INITIAL_EPIDEMIC_COUNTS - state.playerEpidemicCounts;

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

    return state;
  });
}
