import { kv } from '@vercel/kv';

const INITIAL_CITIES = [
  '뉴욕',
  '워싱턴',
  '잭슨빌',
  '상파울루',
  '런던',
  '이스탄불',
  '트리폴리',
  '카이로',
  '라고스'
];

const KV_DECK_KEY = 'pandemic:deck-state:v1';

type Zone = 'A' | 'B' | 'C';

export interface ZoneCityCount {
  name: string;
  count: number;
}

export interface DeckLayer {
  id: number;
  position: number;
  cities: ZoneCityCount[];
  total: number;
}

export interface DeckSnapshot {
  revision: number;
  zoneA: ZoneCityCount[];
  zoneBLayers: DeckLayer[];
  zoneC: ZoneCityCount[];
  totals: Record<Zone | 'total', number>;
}

type CityState = {
  name: string;
  discard: number;
  safe: number;
};

type HotLayer = {
  id: number;
  cards: Record<string, number>;
};

type DeckStorage = {
  cityOrder: string[];
  cities: Record<string, CityState>;
  hotLayers: HotLayer[];
  nextLayerId: number;
  revision: number;
};

type StateMutation = (state: DeckStorage) => void;

const hasKv =
  typeof process.env.KV_REST_API_URL === 'string' ||
  typeof process.env.KV_URL === 'string' ||
  typeof process.env.UPSTASH_REDIS_REST_URL === 'string';

let memoryState: DeckStorage | null = null;
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

function createInitialState(): DeckStorage {
  const state: DeckStorage = {
    cityOrder: [],
    cities: {},
    hotLayers: [],
    nextLayerId: 1,
    revision: 0
  };

  INITIAL_CITIES.forEach((city) => ensureCityExists(state, city));
  return state;
}

function ensureStateShape(raw: unknown): DeckStorage {
  const state = raw as DeckStorage & {
    revision?: number;
    nextLayerId?: number;
    cityOrder?: string[];
    cities?: Record<string, CityState>;
    hotLayers?: HotLayer[];
  };

  if (!Array.isArray(state.cityOrder)) {
    state.cityOrder = [];
  }

  if (!state.cities || typeof state.cities !== 'object') {
    state.cities = {};
  }

  if (!Array.isArray(state.hotLayers)) {
    state.hotLayers = [];
  }

  if (typeof state.nextLayerId !== 'number' || state.nextLayerId < 1) {
    state.nextLayerId = 1;
  }

  if (typeof state.revision !== 'number' || !Number.isFinite(state.revision)) {
    state.revision = 0;
  }

  return state as DeckStorage;
}

async function loadState(): Promise<DeckStorage> {
  if (hasKv) {
    const stored = await kv.get<DeckStorage>(KV_DECK_KEY);
    if (stored) {
      return ensureStateShape(cloneState(stored));
    }
    const initial = createInitialState();
    await kv.set(KV_DECK_KEY, initial);
    return ensureStateShape(cloneState(initial));
  }

  if (!memoryState) {
    memoryState = createInitialState();
  }

  return ensureStateShape(cloneState(memoryState));
}

async function saveState(state: DeckStorage) {
  if (hasKv) {
    await kv.set(KV_DECK_KEY, state);
    return;
  }

  memoryState = cloneState(state);
}

async function updateState(mutator: StateMutation): Promise<DeckSnapshot> {
  return enqueueStateWork(async () => {
    const state = await loadState();
    mutator(state);
    cleanupEmptyLayers(state);
    state.revision += 1;
    await saveState(state);
    return buildSnapshot(state);
  });
}

function ensureCityExists(state: DeckStorage, name: string) {
  const key = normaliseCityName(name);

  if (!key) {
    throw new Error('도시 이름이 필요합니다.');
  }

  if (!state.cities[key]) {
    state.cities[key] = {
      name: key,
      discard: 0,
      safe: 3
    };
    state.cityOrder.push(key);
  }

  return state.cities[key];
}

function cleanupEmptyLayers(state: DeckStorage) {
  for (let index = state.hotLayers.length - 1; index >= 0; index -= 1) {
    const layer = state.hotLayers[index];
    const hasCards = Object.values(layer.cards).some((count) => count > 0);
    if (!hasCards) {
      state.hotLayers.splice(index, 1);
    }
  }
}

function sortCities(list: ZoneCityCount[]): ZoneCityCount[] {
  return [...list].sort((a, b) => {
    const diff = b.count - a.count;
    if (diff !== 0) {
      return diff;
    }
    return a.name.localeCompare(b.name, 'ko');
  });
}

function computeTotals(state: DeckStorage): Record<Zone | 'total', number> {
  const totals: Record<Zone | 'total', number> = {
    A: 0,
    B: 0,
    C: 0,
    total: 0
  };

  Object.values(state.cities).forEach((city) => {
    totals.A += city.discard;
    totals.C += city.safe;
  });

  state.hotLayers.forEach((layer) => {
    Object.values(layer.cards).forEach((count) => {
      totals.B += count;
    });
  });

  totals.total = totals.A + totals.B + totals.C;
  return totals;
}

function buildZoneA(state: DeckStorage): ZoneCityCount[] {
  const list = state.cityOrder.map((key) => {
    const city = state.cities[key];
    if (!city) {
      throw new Error('도시 데이터를 찾을 수 없습니다.');
    }

    return {
      name: city.name,
      count: city.discard
    };
  });

  return sortCities(list);
}

function buildZoneC(state: DeckStorage): ZoneCityCount[] {
  const list = state.cityOrder.map((key) => {
    const city = state.cities[key];
    if (!city) {
      throw new Error('도시 데이터를 찾을 수 없습니다.');
    }

    return {
      name: city.name,
      count: city.safe
    };
  });

  return sortCities(list);
}

function buildZoneBLayers(state: DeckStorage): DeckLayer[] {
  return state.hotLayers.map((layer, index) => {
    const cities = sortCities(
      Object.entries(layer.cards).map(([name, count]) => ({
        name,
        count
      }))
    );

    const total = cities.reduce((sum, city) => sum + city.count, 0);

    return {
      id: layer.id,
      position: index + 1,
      cities,
      total
    };
  });
}

function buildSnapshot(state: DeckStorage): DeckSnapshot {
  return {
    revision: state.revision,
    zoneA: buildZoneA(state),
    zoneBLayers: buildZoneBLayers(state),
    zoneC: buildZoneC(state),
    totals: computeTotals(state)
  };
}

export async function getDeckSnapshot(): Promise<DeckSnapshot> {
  return enqueueStateWork(async () => {
    const state = await loadState();
    return buildSnapshot(state);
  });
}

export async function incrementDiscard(cityName: string): Promise<DeckSnapshot> {
  return updateState((state) => {
    const city = ensureCityExists(state, cityName);

    const topLayer = state.hotLayers[0];
    if (topLayer) {
      const current = topLayer.cards[city.name] ?? 0;
      if (current <= 0) {
        throw new Error(`현재 B1 층에 ${city.name} 카드가 없습니다.`);
      }
      if (current > 1) {
        topLayer.cards[city.name] = current - 1;
      } else {
        delete topLayer.cards[city.name];
      }
    } else {
      if (city.safe <= 0) {
        throw new Error(`${city.name} 도시에 남은 카드가 없습니다.`);
      }
      city.safe -= 1;
    }

    city.discard += 1;
  });
}

export async function triggerEpidemic(
  cityName: string
): Promise<DeckSnapshot> {
  return updateState((state) => {
    const city = ensureCityExists(state, cityName);

    if (city.safe <= 0) {
      throw new Error(`${city.name} 도시에 C 영역 카드가 없습니다.`);
    }

    city.safe -= 1;
    city.discard += 1;

    const newLayerCards: Record<string, number> = {};

    Object.values(state.cities).forEach((entry) => {
      if (entry.discard > 0) {
        newLayerCards[entry.name] = entry.discard;
        entry.discard = 0;
      }
    });

    const hasCards = Object.keys(newLayerCards).length > 0;

    if (!hasCards) {
      throw new Error('전염 카드 처리 중 오류가 발생했습니다.');
    }

    const layerId = state.nextLayerId;
    state.nextLayerId += 1;
    state.hotLayers.unshift({
      id: layerId,
      cards: newLayerCards
    });
  });
}

export async function addCity(cityName: string): Promise<DeckSnapshot> {
  return updateState((state) => {
    ensureCityExists(state, cityName);
  });
}

export async function resetDeckState(): Promise<DeckSnapshot> {
  return enqueueStateWork(async () => {
    const current = await loadState();
    const state = createInitialState();
    state.revision = current.revision + 1;
    await saveState(state);
    return buildSnapshot(state);
  });
}
