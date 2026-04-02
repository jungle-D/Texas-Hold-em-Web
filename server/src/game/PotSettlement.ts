export interface PotShareInput {
  playerId: string;
  seatIndex: number;
  totalCommitted: number;
  folded: boolean;
  rank: number;
}

export interface PotWinner {
  playerId: string;
  seatIndex: number;
  amount: number;
}

export function settlePots(players: PotShareInput[]): PotWinner[] {
  const levels = Array.from(new Set(players.map((p) => p.totalCommitted).filter((n) => n > 0))).sort(
    (a, b) => a - b
  );
  const winners = new Map<string, PotWinner>();
  let prev = 0;

  for (const level of levels) {
    const involved = players.filter((p) => p.totalCommitted >= level);
    const layerSize = level - prev;
    const potAmount = involved.length * layerSize;
    const contenders = involved.filter((p) => !p.folded);
    if (contenders.length === 0 || potAmount <= 0) {
      prev = level;
      continue;
    }
    const bestRank = Math.max(...contenders.map((p) => p.rank));
    const layerWinners = contenders.filter((p) => p.rank === bestRank).sort((a, b) => a.seatIndex - b.seatIndex);
    const each = Math.floor(potAmount / layerWinners.length);
    let remainder = potAmount % layerWinners.length;
    for (const w of layerWinners) {
      const gain = each + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
      const key = w.playerId;
      winners.set(key, {
        playerId: w.playerId,
        seatIndex: w.seatIndex,
        amount: (winners.get(key)?.amount ?? 0) + gain
      });
    }
    prev = level;
  }

  return Array.from(winners.values());
}
