import crypto from "node:crypto";

const RANKS = "23456789TJQKA".split("");
const SUITS = "cdhs".split("");

export function createDeck(): string[] {
  const deck: string[] = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push(`${r}${s}`);
    }
  }
  return deck;
}

export function shuffleDeck(deck: string[]): string[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
