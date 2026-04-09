import test from "node:test";
import assert from "node:assert/strict";
import { ActionError, ErrorCodes } from "@holdem/shared";
import { TableStateMachine, type TablePlayer } from "./TableStateMachine.js";

function createPlayer(playerId: string, seatIndex: number): TablePlayer {
  return {
    playerId,
    nickname: playerId,
    seatIndex,
    stack: 1000,
    currentBet: 0,
    totalCommitted: 0,
    inHand: false,
    hasFolded: false,
    isAllIn: false,
    isReady: true,
    holeCards: [],
    actedThisStreet: false
  };
}

test("regression: all players all-in preflop should auto advance to settlement", () => {
  const players: TablePlayer[] = [createPlayer("p1", 0), createPlayer("p2", 1)];
  const table = new TableStateMachine(players);
  const started = table.startHand();

  assert.equal(started, true);
  assert.equal(table.phase, "preflop");
  assert.equal(table.currentTurnSeat, 1);

  const first = table.applyAction("p2", "allin");
  assert.equal(first.handEnded, null);
  assert.equal(first.nextSeat, 0);

  const second = table.applyAction("p1", "allin");

  assert.equal(second.nextSeat, null);
  assert.notEqual(second.handEnded, null);
  assert.equal(table.phase, "settlement");
  assert.equal(table.currentTurnSeat, null);
  assert.equal(table.board.length, 5);
});

test("rule: all-in player on table does not block normal check on later street", () => {
  const players: TablePlayer[] = [createPlayer("p1", 0), createPlayer("p2", 1), createPlayer("p3", 2)];
  const table = new TableStateMachine(players);
  const started = table.startHand();

  assert.equal(started, true);
  // 让 UTG（seat0）短码全下，其他两家跟注；翻牌后在无人下注时应允许 check。
  players.find((p) => p.playerId === "p1")!.stack = 10;
  table.applyAction("p1", "allin");
  table.applyAction("p2", "call");
  table.applyAction("p3", "check");

  assert.equal(table.phase, "flop");
  assert.equal(table.toCall, 0);
  const actorSeat = table.currentTurnSeat!;
  const actor = players.find((p) => p.seatIndex === actorSeat)!;

  assert.doesNotThrow(() => table.applyAction(actor.playerId, "check"));
});

test("rule: player cannot check when facing unmatched all-in bet", () => {
  const players: TablePlayer[] = [createPlayer("p1", 0), createPlayer("p2", 1), createPlayer("p3", 2)];
  const table = new TableStateMachine(players);
  const started = table.startHand();

  assert.equal(started, true);
  // seat0 先行动，短码全下制造未跟注差额，后位不可 check。
  players.find((p) => p.playerId === "p1")!.stack = 10;
  table.applyAction("p1", "allin");

  assert.equal(table.currentTurnSeat, 1);
  assert.throws(
    () => table.applyAction("p2", "check"),
    (error: unknown) => error instanceof ActionError && error.code === ErrorCodes.ACTION_NOT_ALLOWED
  );
});

test("regression: heads-up turn all-in must wait for opponent response", () => {
  const players: TablePlayer[] = [createPlayer("p1", 0), createPlayer("p2", 1)];
  const table = new TableStateMachine(players);
  const started = table.startHand();

  assert.equal(started, true);
  assert.equal(table.currentTurnSeat, 1);

  // preflop: SB 补齐，BB 过牌，进入 flop
  table.applyAction("p2", "call");
  table.applyAction("p1", "check");
  assert.equal(table.phase, "flop");

  // flop: 双方过牌，进入 turn
  table.applyAction("p2", "check");
  table.applyAction("p1", "check");
  assert.equal(table.phase, "turn");
  assert.equal(table.currentTurnSeat, 1);

  // turn: p2 全下后，p1 必须面对下注，不能直接过牌或自动封街。
  const shove = table.applyAction("p2", "allin");
  assert.equal(shove.handEnded, null);
  assert.equal(shove.nextSeat, 0);
  assert.equal(table.currentTurnSeat, 0);
  assert.equal(table.phase, "turn");

  const p1Legal = table.getLegalActionsForSeat(0);
  assert.equal(p1Legal.includes("check"), false);
  assert.equal(p1Legal.includes("fold"), true);
  // 面对全下时，深码应有 call；若刚好/不足覆盖则会退化为 allin。
  assert.equal(p1Legal.includes("call") || p1Legal.includes("allin"), true);

  assert.throws(
    () => table.applyAction("p1", "check"),
    (error: unknown) => error instanceof ActionError && error.code === ErrorCodes.ACTION_NOT_ALLOWED
  );
});
