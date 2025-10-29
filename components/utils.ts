import { CITY_COLOR_ORDER, CITY_COLOR_PRIORITY, CityCardsSnapshot, CityColor } from "@/lib/deckState";

export type DrawProbability = {
  draw: number,
  probability: number,
}

export type CityProbability = {
  name: string,
  probs: DrawProbability[],
}

function factorial(r: number) {
  let s = 1;
  while (r > 1) s *= r--;
  return s;
};

function comb(n: number, r: number) {
  let s = 1;
  let i = r;
  // n*(n-1)*....*(n-r+1)
  while (i < n) s *= ++i;
  return s / factorial(n - r)
};

function calcDrawProbability(total: number, count: number, draw: number, numDraw: number) {
  if (count < draw)
    return 0;

  const totalComb = comb(total, numDraw);
  const targetComb = comb(count, draw) * comb(total - count, numDraw - draw);

  return 1.0 * targetComb / totalComb;
}

function calculatePileProbs(pile: CityCardsSnapshot[], numDraw: number): { remaining: number, cityProbs: CityProbability[] } {
  if (numDraw < 1)
    throw new Error('numDraw should be at least 1.');

  // 0, 1, 2, ..., numDraw
  const draws = [...Array(numDraw + 1).keys()];

  const total = pile.reduce((acc, city) => acc + city.count, 0);
  if (total <= numDraw) {
    return ({
      remaining: numDraw - total,
      cityProbs: pile.map((city) => ({
        name: city.name,
        probs: draws.map((draw) => ({
          draw: draw,
          probability: city.count == draw ? 1 : 0
        })),
      })),
    });
  } else {
    return ({
      remaining: numDraw - total,
      cityProbs: pile.map((city) => ({
        name: city.name,
        probs: draws.map((draw) => ({
          draw: draw,
          probability: calcDrawProbability(total, city.count, draw, numDraw),
        })),
      })),
    });
  }
};

function sortCityProbabilities(cityProbs: CityProbability[]) {
  const cityColorMap = new Map<string, CityColor>();
  const fallbackPriority = CITY_COLOR_ORDER.length;
  
  return [...cityProbs].sort((a, b) => {
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

function mergeProbs(a: CityProbability[], b: CityProbability[]): CityProbability[] {
  const names = [...a, ...b].map((city) => city.name).filter((name, index, arr) => arr.indexOf(name) == index);
  return names.map((name): CityProbability => {
    const a_probs = a.find((prob) => prob.name == name);
    const b_probs = b.find((prob) => prob.name == name);

    if (a_probs !== undefined && b_probs !== undefined) {
      let draws: {[k: number]: number} = {};

      for (const a_prob of a_probs.probs) {
        for (const b_prob of b_probs.probs) {
          const draw = a_prob.draw + b_prob.draw;
          const probability = a_prob.probability * b_prob.probability;

          if (probability == 0 && draw != 0)
            continue;

          if (draw in draws)
            draws[draw] += probability;
          else
            draws[draw] = probability;
        }
      }

      return {
        name: name,
        probs: Object.keys(draws).map((draw) => parseInt(draw)).sort((a, b) => a - b).map((draw) => ({draw: draw, probability: draws[draw]})),
      };
    } else if (a_probs !== undefined) {
      return a_probs;
    } else if (b_probs !== undefined) {
      return b_probs;
    }

    return {
      name: name,
      probs: [],
    }
  });
}

export function calculateProbs(piles: CityCardsSnapshot[][], numDraw: number): CityProbability[] {
  let left = numDraw;
  let result: CityProbability[] = [];

  for (const pile of piles) {
    let { remaining, cityProbs } = calculatePileProbs(pile, left);

    left = remaining;
    result = mergeProbs(result, cityProbs);

    if (left <= 0)
      break;
  }

  if (left > 0)
    throw new Error(`Not enough cards for drawing ${numDraw} cards in piles: ${piles.toString()}`);

  return result;
}