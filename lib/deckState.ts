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
  zoneA: ZoneCityCount[];
  zoneBLayers: DeckLayer[];
  zoneC: ZoneCityCount[];
  totals: Record<'A' | 'B' | 'C' | 'total', number>;
}

type CityState = {
  name: string;
  discard: number; // Zone A
  safe: number; // Zone C
};

type HotLayer = {
  id: number;
  cards: Map<string, number>;
};

const cityMap = new Map<string, CityState>();
const cityOrder: string[] = [];
const hotLayers: HotLayer[] = [];
let nextLayerId = 1;

function normaliseCityName(name: string) {
  return name.trim();
}

function ensureCityExists(name: string) {
  const key = normaliseCityName(name);

  if (!key) {
    throw new Error('도시 이름이 필요합니다.');
  }

  let city = cityMap.get(key);

  if (!city) {
    city = {
      name: key,
      discard: 0,
      safe: 3
    };
    cityMap.set(key, city);
    cityOrder.push(key);
  }

  return city;
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

function cleanupEmptyLayers() {
  for (let index = hotLayers.length - 1; index >= 0; index -= 1) {
    if (hotLayers[index].cards.size === 0) {
      hotLayers.splice(index, 1);
    }
  }
}

function computeTotals(): Record<'A' | 'B' | 'C' | 'total', number> {
  const totals: Record<'A' | 'B' | 'C' | 'total', number> = {
    A: 0,
    B: 0,
    C: 0,
    total: 0
  };

  for (const city of cityMap.values()) {
    totals.A += city.discard;
    totals.C += city.safe;
  }

  for (const layer of hotLayers) {
    for (const count of layer.cards.values()) {
      totals.B += count;
    }
  }

  totals.total = totals.A + totals.B + totals.C;
  return totals;
}

function buildZoneA(): ZoneCityCount[] {
  const list: ZoneCityCount[] = cityOrder.map((key) => {
    const city = cityMap.get(key);
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

function buildZoneC(): ZoneCityCount[] {
  const list: ZoneCityCount[] = cityOrder.map((key) => {
    const city = cityMap.get(key);
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

function buildZoneBLayers(): DeckLayer[] {
  return hotLayers.map((layer, index) => {
    const cities = sortCities(
      Array.from(layer.cards.entries()).map(([name, count]) => ({
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

export function getDeckSnapshot(): DeckSnapshot {
  return {
    zoneA: buildZoneA(),
    zoneBLayers: buildZoneBLayers(),
    zoneC: buildZoneC(),
    totals: computeTotals()
  };
}

export function incrementDiscard(cityName: string) {
  const city = ensureCityExists(cityName);

  cleanupEmptyLayers();

  const topLayer = hotLayers[0];
  if (topLayer) {
    const current = topLayer.cards.get(city.name) ?? 0;
    if (current <= 0) {
      throw new Error(`현재 B1 층에 ${city.name} 카드가 없습니다.`);
    }
    if (current > 1) {
      topLayer.cards.set(city.name, current - 1);
    } else {
      topLayer.cards.delete(city.name);
    }
  } else {
    if (city.safe <= 0) {
      throw new Error(`${city.name} 도시에 남은 카드가 없습니다.`);
    }
    city.safe -= 1;
  }

  city.discard += 1;
  cleanupEmptyLayers();
}

export function triggerEpidemic(cityName: string) {
  const city = ensureCityExists(cityName);

  if (city.safe <= 0) {
    throw new Error(`${city.name} 도시에 C 영역 카드가 없습니다.`);
  }

  // Draw bottom card from C into discard (A)
  city.safe -= 1;
  city.discard += 1;

  const newLayerCards = new Map<string, number>();

  for (const entry of cityMap.values()) {
    console.log(entry);
    if (entry.discard > 0) {
      newLayerCards.set(entry.name, entry.discard);
      entry.discard = 0;
    }
  }

  if (newLayerCards.size === 0) {
    throw new Error('전염 카드 처리 중 오류가 발생했습니다.');
  }

  const layerId = nextLayerId;
  nextLayerId += 1;
  hotLayers.unshift({
    id: layerId,
    cards: newLayerCards
  });

  cleanupEmptyLayers();
}

export function addCity(cityName: string) {
  const key = normaliseCityName(cityName);

  if (!key) {
    throw new Error('도시 이름이 필요합니다.');
  }

  if (cityMap.has(key)) {
    return;
  }

  ensureCityExists(key);
}

export function resetDeckState() {
  cityMap.clear();
  cityOrder.length = 0;
  hotLayers.length = 0;
  nextLayerId = 1;
  INITIAL_CITIES.forEach((city) => ensureCityExists(city));
}

resetDeckState();
