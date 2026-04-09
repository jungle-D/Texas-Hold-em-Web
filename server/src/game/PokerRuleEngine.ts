import type { PlayerActionType, Street } from "@holdem/shared";

const rankToVal: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

export interface EnginePlayer {
  playerId: string;
  seatIndex: number;
  stack: number;
  currentBet: number;
  inHand: boolean;
  hasFolded: boolean;
  isAllIn: boolean;
}

export function nextStreet(street: Street): Street | null {
  if (street === "preflop") return "flop";
  if (street === "flop") return "turn";
  if (street === "turn") return "river";
  return null;
}

export function getBoardCount(street: Street): number {
  if (street === "preflop") return 0;
  if (street === "flop") return 3;
  if (street === "turn") return 4;
  return 5;
}

export function legalActions(player: EnginePlayer, toCall: number): PlayerActionType[] {
  if (!player.inHand || player.hasFolded || player.isAllIn) return [];
  if (toCall === player.currentBet) return player.stack > 0 ? ["check", "bet", "allin", "fold"] : ["check"];
  const callCost = toCall - player.currentBet;
  if (callCost >= player.stack) return ["fold", "allin"];
  return ["fold", "call", "raise", "allin"];
}

export function evaluateHand(cards: string[]): { score: number; name: string; bestFive: string[] } {
  if (cards.length < 5) {
    const sorted = [...cards].sort((a, b) => rankToVal[b[0]] - rankToVal[a[0]]);
    return { score: 0, name: "High Card", bestFive: sorted };
  }

  let best: { score: number; name: string; bestFive: string[] } | null = null;
  for (const combo of chooseFive(cards)) {
    const current = evaluateFiveCards(combo);
    if (!best || current.score > best.score) best = current;
  }
  return best!;
}

function chooseFive(cards: string[]): string[][] {
  const out: string[][] = [];
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            out.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
          }
        }
      }
    }
  }
  return out;
}

function evaluateFiveCards(cards: string[]): { score: number; name: string; bestFive: string[] } {
  const ranks = cards.map((c) => rankToVal[c[0]]);
  const suits = cards.map((c) => c[1]);
  const isFlush = suits.every((s) => s === suits[0]);
  const straightHigh = detectStraightHigh(ranks);
  const countByRank = new Map<number, number>();
  for (const r of ranks) countByRank.set(r, (countByRank.get(r) ?? 0) + 1);

  const groups = Array.from(countByRank.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const sortedRanksDesc = [...ranks].sort((a, b) => b - a);

  if (isFlush && straightHigh !== null) {
    const bestFive = orderStraightCards(cards, straightHigh);
    if (straightHigh === 14) {
      return scoreWithName(9, [14, 13, 12, 11, 10], "Royal Flush", bestFive);
    }
    return scoreWithName(8, [straightHigh], "Straight Flush", bestFive);
  }

  if (groups[0].count === 4) {
    const four = groups[0].rank;
    const kicker = groups.find((g) => g.rank !== four)!.rank;
    const bestFive = [...pickRank(cards, four, 4), ...pickRank(cards, kicker, 1)];
    return scoreWithName(7, [four, kicker], "Four of a Kind", bestFive);
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    const trips = groups[0].rank;
    const pair = groups[1].rank;
    const bestFive = [...pickRank(cards, trips, 3), ...pickRank(cards, pair, 2)];
    return scoreWithName(6, [trips, pair], "Full House", bestFive);
  }

  if (isFlush) {
    const sortedFlush = [...cards].sort((a, b) => rankToVal[b[0]] - rankToVal[a[0]]);
    return scoreWithName(5, sortedRanksDesc, "Flush", sortedFlush);
  }

  if (straightHigh !== null) {
    return scoreWithName(4, [straightHigh], "Straight", orderStraightCards(cards, straightHigh));
  }

  if (groups[0].count === 3) {
    const trips = groups[0].rank;
    const kickers = groups.filter((g) => g.rank !== trips).map((g) => g.rank).sort((a, b) => b - a);
    const bestFive = [...pickRank(cards, trips, 3), ...pickRank(cards, kickers[0], 1), ...pickRank(cards, kickers[1], 1)];
    return scoreWithName(3, [trips, ...kickers], "Three of a Kind", bestFive);
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const highPair = Math.max(groups[0].rank, groups[1].rank);
    const lowPair = Math.min(groups[0].rank, groups[1].rank);
    const kicker = groups.find((g) => g.rank !== highPair && g.rank !== lowPair)!.rank;
    const bestFive = [...pickRank(cards, highPair, 2), ...pickRank(cards, lowPair, 2), ...pickRank(cards, kicker, 1)];
    return scoreWithName(2, [highPair, lowPair, kicker], "Two Pair", bestFive);
  }

  if (groups[0].count === 2) {
    const pair = groups[0].rank;
    const kickers = groups.filter((g) => g.rank !== pair).map((g) => g.rank).sort((a, b) => b - a);
    const bestFive = [
      ...pickRank(cards, pair, 2),
      ...pickRank(cards, kickers[0], 1),
      ...pickRank(cards, kickers[1], 1),
      ...pickRank(cards, kickers[2], 1)
    ];
    return scoreWithName(1, [pair, ...kickers], "One Pair", bestFive);
  }

  const high = [...cards].sort((a, b) => rankToVal[b[0]] - rankToVal[a[0]]);
  return scoreWithName(0, sortedRanksDesc, "High Card", high);
}

function detectStraightHigh(ranks: number[]): number | null {
  const uniq = Array.from(new Set(ranks)).sort((a, b) => b - a);
  if (uniq.length !== 5) return null;
  if (uniq[0] - uniq[4] === 4) return uniq[0];
  // wheel A-2-3-4-5
  if (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) return 5;
  return null;
}

function orderStraightCards(cards: string[], straightHigh: number): string[] {
  const target = straightHigh === 5 ? [5, 4, 3, 2, 14] : [straightHigh, straightHigh - 1, straightHigh - 2, straightHigh - 3, straightHigh - 4];
  const pool = [...cards];
  return target.map((rank) => {
    const idx = pool.findIndex((c) => rankToVal[c[0]] === rank || (rank === 14 && c[0] === "A"));
    const picked = pool[idx];
    pool.splice(idx, 1);
    return picked;
  });
}

function pickRank(cards: string[], rank: number, count: number): string[] {
  return cards
    .filter((c) => rankToVal[c[0]] === rank)
    .slice(0, count);
}

function scoreWithName(category: number, kickers: number[], name: string, bestFive: string[]): { score: number; name: string; bestFive: string[] } {
  // 基于 15 进制构造稳定可比较分值，类别优先，再比踢脚。
  const padded = [...kickers];
  while (padded.length < 5) padded.push(0);
  let score = category;
  for (const k of padded) score = score * 15 + k;
  return { score, name, bestFive };
}
