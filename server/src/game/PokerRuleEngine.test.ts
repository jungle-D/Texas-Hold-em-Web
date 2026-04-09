import test from "node:test";
import assert from "node:assert/strict";
import { evaluateHand } from "./PokerRuleEngine.js";

test("hand ranking: straight flush beats four of a kind", () => {
  const straightFlush = evaluateHand(["Ah", "Kh", "Qh", "Jh", "Th", "2c", "3d"]);
  const quads = evaluateHand(["As", "Ad", "Ac", "Ah", "Kc", "2d", "3h"]);

  assert.equal(straightFlush.name, "Royal Flush");
  assert.equal(quads.name, "Four of a Kind");
  assert.ok(straightFlush.score > quads.score);
});

test("hand ranking: full house beats flush", () => {
  const fullHouse = evaluateHand(["Ks", "Kd", "Kh", "2c", "2d", "9h", "8s"]);
  const flush = evaluateHand(["Ah", "Jh", "8h", "5h", "2h", "Kd", "Qs"]);

  assert.equal(fullHouse.name, "Full House");
  assert.equal(flush.name, "Flush");
  assert.ok(fullHouse.score > flush.score);
});

test("kicker comparison: pair with better kicker wins", () => {
  const pairAKicker = evaluateHand(["As", "Ad", "Kc", "9h", "4d", "2s", "3c"]);
  const pairQKicker = evaluateHand(["Ah", "Ac", "Qc", "9s", "4h", "2d", "3h"]);

  assert.equal(pairAKicker.name, "One Pair");
  assert.equal(pairQKicker.name, "One Pair");
  assert.ok(pairAKicker.score > pairQKicker.score);
});

test("wheel straight is recognized", () => {
  const wheel = evaluateHand(["As", "2d", "3c", "4h", "5s", "Kd", "Qh"]);
  assert.equal(wheel.name, "Straight");
});
