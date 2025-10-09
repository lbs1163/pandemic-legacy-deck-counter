export type Zone = 'A' | 'B' | 'C';

export interface CityCounts {
  name: string;
  counts: Record<Zone, number>;
}

export interface DeckSnapshot {
  cities: CityCounts[];
  totals: Record<Zone | 'total', number>;
}

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

type InternalCityState = {
  name: string;
  counts: Record<Zone, number>;
};

const cityMap = new Map<string, InternalCityState>();
const cityOrder: string[] = [];

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
      counts: {
        A: 0,
        B: 0,
        C: 3
      }
    };
    cityMap.set(key, city);
    cityOrder.push(key);
  }

  return city;
}

function computeTotals(): Record<Zone | 'total', number> {
  const totals: Record<Zone | 'total', number> = {
    A: 0,
    B: 0,
    C: 0,
    total: 0
  };

  for (const city of cityMap.values()) {
    totals.A += city.counts.A;
    totals.B += city.counts.B;
    totals.C += city.counts.C;
  }

  totals.total = totals.A + totals.B + totals.C;
  return totals;
}

export function getDeckSnapshot(): DeckSnapshot {
  const cities: CityCounts[] = cityOrder.map((key) => {
    const city = cityMap.get(key);
    if (!city) {
      throw new Error('도시 데이터를 찾을 수 없습니다.');
    }
    return {
      name: city.name,
      counts: {
        A: city.counts.A,
        B: city.counts.B,
        C: city.counts.C
      }
    };
  });

  return {
    cities,
    totals: computeTotals()
  };
}

function validateCardAvailability(city: InternalCityState) {
  const remaining = city.counts.B + city.counts.C;
  if (remaining <= 0) {
    throw new Error(`${city.name} 도시에 남은 카드가 없습니다.`);
  }
}

export function incrementDiscard(cityName: string) {
  const city = ensureCityExists(cityName);
  validateCardAvailability(city);

  if (city.counts.B > 0) {
    city.counts.B -= 1;
  } else if (city.counts.C > 0) {
    city.counts.C -= 1;
  }

  city.counts.A += 1;
}

export function triggerEpidemic(cityName: string) {
  const city = ensureCityExists(cityName);

  if (city.counts.C <= 0) {
    throw new Error(`${city.name} 도시에 C 영역 카드가 없습니다.`);
  }

  // Draw bottom card from C and add to discard (A)
  city.counts.C -= 1;
  city.counts.A += 1;

  // Move all discard pile cards into the hot stack (B)
  for (const entry of cityMap.values()) {
    if (entry.counts.A > 0) {
      entry.counts.B += entry.counts.A;
      entry.counts.A = 0;
    }
  }
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
  INITIAL_CITIES.forEach((city) => ensureCityExists(city));
}

resetDeckState();
