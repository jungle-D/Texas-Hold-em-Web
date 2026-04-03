import test from "node:test";
import assert from "node:assert/strict";
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
