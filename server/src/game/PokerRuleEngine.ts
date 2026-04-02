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
  const sorted = [...cards].sort((a, b) => rankToVal[b[0]] - rankToVal[a[0]]);
  const bestFive = sorted.slice(0, 5);
  const score = bestFive.reduce((acc, c, i) => acc + rankToVal[c[0]] * (10 - i), 0);
  return { score, name: "High Card", bestFive };
}
