import { ActionError, ErrorCodes, type PlayerActionType, type TablePhase } from "@holdem/shared";
import crypto from "node:crypto";
import { createDeck, shuffleDeck } from "./cards.js";
import { evaluateHand, getBoardCount, legalActions, nextStreet } from "./PokerRuleEngine.js";
import { settlePots } from "./PotSettlement.js";

export interface TablePlayer {
  playerId: string;
  nickname: string;
  seatIndex: number | null;
  stack: number;
  currentBet: number;
  totalCommitted: number;
  inHand: boolean;
  hasFolded: boolean;
  isAllIn: boolean;
  isReady: boolean;
  holeCards: string[];
  actedThisStreet?: boolean;
}

export interface HandResult {
  winners: Array<{ playerId: string; seatIndex: number; amount: number; handName: string }>;
  showdown: Array<{ seatIndex: number; cards: string[]; bestFive: string[]; handName: string }>;
}

export class TableStateMachine {
  phase: TablePhase = "waiting";
  street: "preflop" | "flop" | "turn" | "river" = "preflop";
  dealerSeat: number | null = null;
  smallBlindSeat: number | null = null;
  bigBlindSeat: number | null = null;
  currentTurnSeat: number | null = null;
  minRaise = 20;
  toCall = 0;
  pot = 0;
  board: string[] = [];
  handSeed = 0;
  private deck: string[] = [];
  constructor(
    private readonly players: TablePlayer[],
    private readonly sb = 10,
    private readonly bb = 20
  ) {}

  startHand(): boolean {
    const seatedReady = this.players.filter((p) => p.seatIndex !== null && p.isReady && p.stack > 0);
    if (seatedReady.length < 2) return false;
    this.phase = "dealing";
    this.street = "preflop";
    this.board = [];
    this.pot = 0;
    this.toCall = 0;
    this.minRaise = this.bb;
    this.handSeed = crypto.randomInt(1, 2_147_483_647);
    this.deck = shuffleDeck(createDeck());
    for (const p of this.players) {
      p.currentBet = 0;
      p.totalCommitted = 0;
      p.inHand = p.seatIndex !== null && p.stack > 0 && p.isReady;
      p.hasFolded = false;
      p.isAllIn = false;
      p.holeCards = [];
      p.actedThisStreet = false;
    }
    this.rotateDealer();
    this.postBlinds();
    this.dealHole();
    this.phase = "preflop";
    this.currentTurnSeat = this.findNextActor(this.bigBlindSeat ?? -1);
    return true;
  }

  resetToWaiting(): void {
    this.phase = "waiting";
    this.currentTurnSeat = null;
    this.toCall = 0;
    this.minRaise = this.bb;
    this.pot = 0;
    this.board = [];
    for (const p of this.players) {
      p.currentBet = 0;
      p.totalCommitted = 0;
      p.inHand = false;
      p.hasFolded = false;
      p.isAllIn = false;
      p.holeCards = [];
      p.actedThisStreet = false;
    }
  }

  applyAction(playerId: string, action: PlayerActionType, amount = 0): { nextSeat: number | null; handEnded: HandResult | null } {
    const player = this.players.find((p) => p.playerId === playerId);
    if (!player || player.seatIndex === null) throw new ActionError(ErrorCodes.PLAYER_NOT_SEATED, "玩家未入座");
    if (player.seatIndex !== this.currentTurnSeat) throw new ActionError(ErrorCodes.NOT_YOUR_TURN, "当前不是你的回合");
    const allowed = legalActions(player, this.toCall);
    if (!allowed.includes(action)) throw new ActionError(ErrorCodes.ACTION_NOT_ALLOWED, "当前动作不合法");
    if (action === "fold") player.hasFolded = true;
    if (action === "check") {
      // noop
    }
    if (action === "call") this.commit(player, this.toCall - player.currentBet);
    if (action === "bet") {
      if (amount < this.bb) throw new ActionError(ErrorCodes.INVALID_AMOUNT, "下注金额低于大盲");
      this.commit(player, amount);
      this.toCall = player.currentBet;
      this.minRaise = amount;
    }
    if (action === "raise") {
      if (amount <= this.toCall) throw new ActionError(ErrorCodes.INVALID_AMOUNT, "加注目标必须大于当前跟注额");
      const raiseDiff = amount - this.toCall;
      if (raiseDiff < this.minRaise) throw new ActionError(ErrorCodes.INVALID_AMOUNT, "加注幅度低于最小加注");
      this.commit(player, amount - player.currentBet);
      this.minRaise = raiseDiff;
      this.toCall = player.currentBet;
    }
    if (action === "allin") {
      this.commit(player, player.stack);
      if (player.currentBet > this.toCall) {
        this.minRaise = Math.max(this.minRaise, player.currentBet - this.toCall);
        this.toCall = player.currentBet;
      }
    }
    player.actedThisStreet = true;

    const alive = this.players.filter((p) => p.inHand && !p.hasFolded);
    if (alive.length === 1) {
      const sole = alive[0];
      sole.stack += this.pot;
      const res: HandResult = {
        winners: [{ playerId: sole.playerId, seatIndex: sole.seatIndex!, amount: this.pot, handName: "Fold Win" }],
        showdown: []
      };
      this.phase = "settlement";
      return { nextSeat: null, handEnded: res };
    }

    if (this.isStreetClosed()) {
      return { nextSeat: this.advanceStreetOrSettle(), handEnded: this.phase === "settlement" ? this.buildShowdownResult() : null };
    }

    this.currentTurnSeat = this.findNextActor(player.seatIndex);
    return { nextSeat: this.currentTurnSeat, handEnded: null };
  }

  private commit(player: TablePlayer, amount: number): void {
    const commit = Math.max(0, Math.min(amount, player.stack));
    player.stack -= commit;
    player.currentBet += commit;
    player.totalCommitted += commit;
    this.pot += commit;
    if (player.stack === 0) player.isAllIn = true;
  }

  private rotateDealer(): void {
    const occupied = this.players.filter((p) => p.seatIndex !== null).map((p) => p.seatIndex!) .sort((a, b) => a - b);
    if (occupied.length === 0) return;
    if (this.dealerSeat === null) {
      this.dealerSeat = occupied[0];
    } else {
      const idx = occupied.findIndex((s) => s > this.dealerSeat!);
      this.dealerSeat = idx >= 0 ? occupied[idx] : occupied[0];
    }
  }

  private nextOccupiedSeat(fromSeat: number): number {
    for (let i = 1; i <= 6; i += 1) {
      const seat = (fromSeat + i) % 6;
      if (this.players.some((p) => p.seatIndex === seat && p.stack > 0)) return seat;
    }
    return fromSeat;
  }

  private postBlinds(): void {
    if (this.dealerSeat === null) return;
    this.smallBlindSeat = this.nextOccupiedSeat(this.dealerSeat);
    this.bigBlindSeat = this.nextOccupiedSeat(this.smallBlindSeat);
    const sbPlayer = this.players.find((p) => p.seatIndex === this.smallBlindSeat)!;
    const bbPlayer = this.players.find((p) => p.seatIndex === this.bigBlindSeat)!;
    this.commit(sbPlayer, this.sb);
    this.commit(bbPlayer, this.bb);
    this.toCall = bbPlayer.currentBet;
  }

  private dealHole(): void {
    const seated = this.players.filter((p) => p.inHand).sort((a, b) => a.seatIndex! - b.seatIndex!);
    for (let i = 0; i < 2; i += 1) {
      for (const p of seated) {
        p.holeCards.push(this.deck.shift()!);
      }
    }
  }

  private findNextActor(fromSeat: number): number | null {
    for (let i = 1; i <= 6; i += 1) {
      const seat = (fromSeat + i) % 6;
      const p = this.players.find((x) => x.seatIndex === seat);
      if (p && p.inHand && !p.hasFolded && !p.isAllIn) return seat;
    }
    return null;
  }

  private isStreetClosed(): boolean {
    const active = this.players.filter((p) => p.inHand && !p.hasFolded && !p.isAllIn);
    if (active.length <= 1) return true;
    return active.every((p) => p.currentBet === this.toCall && p.actedThisStreet === true);
  }

  private advanceStreetOrSettle(): number | null {
    for (const p of this.players) {
      p.currentBet = 0;
      p.actedThisStreet = false;
    }
    this.toCall = 0;
    const next = nextStreet(this.street);
    if (!next) {
      this.phase = "settlement";
      this.currentTurnSeat = null;
      return null;
    }
    this.street = next;
    this.phase = this.street;
    this.board = this.deck.slice(0, getBoardCount(this.street));
    this.currentTurnSeat = this.findNextActor(this.dealerSeat ?? 0);
    return this.currentTurnSeat;
  }

  private buildShowdownResult(): HandResult {
    const contenders = this.players.filter((p) => p.inHand && !p.hasFolded && p.seatIndex !== null);
    const ranked = contenders.map((p) => {
      const evaluated = evaluateHand([...p.holeCards, ...this.board]);
      return {
        playerId: p.playerId,
        seatIndex: p.seatIndex!,
        totalCommitted: p.totalCommitted,
        folded: false,
        rank: evaluated.score,
        handName: evaluated.name,
        cards: p.holeCards,
        bestFive: evaluated.bestFive
      };
    });
    const winners = settlePots(ranked);
    for (const w of winners) {
      const p = this.players.find((x) => x.playerId === w.playerId);
      if (p) p.stack += w.amount;
    }
    return {
      winners: winners.map((w) => ({
        ...w,
        handName: ranked.find((x) => x.playerId === w.playerId)?.handName ?? "Unknown"
      })),
      showdown: ranked.map((x) => ({
        seatIndex: x.seatIndex,
        cards: x.cards,
        bestFive: x.bestFive,
        handName: x.handName
      }))
    };
  }
}
