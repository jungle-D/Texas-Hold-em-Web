import crypto from "node:crypto";
import type { TableSnapshot } from "@holdem/shared";
import { TableStateMachine, type TablePlayer } from "../game/TableStateMachine.js";

export interface RoomState {
  roomCode: string;
  roomName: string;
  hostPlayerId: string;
  maxPlayers: number;
  actionHistory: string[];
  /** 局间亮牌窗口结束时间戳；null 表示未在窗口内 */
  interHandRevealUntil: number | null;
  /** 玩家是否选择在局间亮牌 */
  interHandReveal: Record<string, boolean>;
  players: TablePlayer[];
  table: TableStateMachine;
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();
  private readonly reconnectMap = new Map<string, string>();

  createRoom(roomName: string, hostNickname: string): { room: RoomState; player: TablePlayer; reconnectToken: string } {
    const roomCode = this.createRoomCode();
    const player = this.createPlayer(hostNickname);
    const players = [player];
    const room: RoomState = {
      roomCode,
      roomName,
      hostPlayerId: player.playerId,
      maxPlayers: 6,
      actionHistory: [],
      interHandRevealUntil: null,
      interHandReveal: {},
      players,
      table: new TableStateMachine(players)
    };
    this.rooms.set(roomCode, room);
    const token = this.createReconnectToken(player.playerId);
    return { room, player, reconnectToken: token };
  }

  joinRoom(roomCode: string, nickname: string, reconnectToken?: string): { room: RoomState; player: TablePlayer; reconnectToken: string } | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (reconnectToken) {
      const mappedPlayerId = this.reconnectMap.get(reconnectToken);
      if (mappedPlayerId) {
        const player = room.players.find((p) => p.playerId === mappedPlayerId);
        if (player) return { room, player, reconnectToken };
      }
    }
    if (room.players.length >= room.maxPlayers) return null;
    const player = this.createPlayer(nickname);
    room.players.push(player);
    const token = this.createReconnectToken(player.playerId);
    return { room, player, reconnectToken: token };
  }

  getRoom(roomCode: string): RoomState | undefined {
    return this.rooms.get(roomCode);
  }

  snapshot(room: RoomState, _forPlayerId?: string): TableSnapshot {
    const revealedHands = room.players
      .filter((p) => p.seatIndex !== null && room.interHandReveal[p.playerId] === true && p.holeCards.length > 0)
      .map((p) => ({
        seatIndex: p.seatIndex!,
        playerId: p.playerId,
        nickname: p.nickname,
        cards: [...p.holeCards]
      }))
      .sort((a, b) => a.seatIndex - b.seatIndex);
    return {
      roomCode: room.roomCode,
      phase: room.table.phase,
      dealerSeat: room.table.dealerSeat,
      smallBlindSeat: room.table.smallBlindSeat,
      bigBlindSeat: room.table.bigBlindSeat,
      currentTurnSeat: room.table.currentTurnSeat,
      minRaise: room.table.minRaise,
      toCall: room.table.toCall,
      pot: room.table.pot,
      board: room.table.board,
      actionHistory: room.actionHistory,
      interHandRevealUntil: room.interHandRevealUntil,
      revealedHands,
      players: room.players.map((p) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        seatIndex: p.seatIndex,
        stack: p.stack,
        currentBet: p.currentBet,
        inHand: p.inHand,
        hasFolded: p.hasFolded,
        isAllIn: p.isAllIn,
        isReady: p.isReady
      }))
    };
  }

  autoSeatPlayer(room: RoomState, playerId: string): number | null {
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player || player.seatIndex !== null) return player?.seatIndex ?? null;
    if (player.stack <= 0) return null;
    for (let i = 0; i < room.maxPlayers; i += 1) {
      if (!room.players.some((p) => p.seatIndex === i)) {
        player.seatIndex = i;
        return i;
      }
    }
    return null;
  }

  kickPlayer(roomCode: string, hostPlayerId: string, targetPlayerId: string): RoomState | null {
    const room = this.rooms.get(roomCode);
    if (!room || room.hostPlayerId !== hostPlayerId) return null;
    if (hostPlayerId === targetPlayerId) return null;
    if (!room.players.some((p) => p.playerId === targetPlayerId)) return null;
    return this.leaveRoom(roomCode, targetPlayerId);
  }

  leaveRoom(roomCode: string, playerId: string): RoomState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const leaving = room.players.find((p) => p.playerId === playerId);
    const leavingSeat = leaving?.seatIndex ?? null;
    const idx = room.players.findIndex((p) => p.playerId === playerId);
    if (idx < 0) return room;
    room.players.splice(idx, 1);
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      return null;
    }
    if (room.hostPlayerId === playerId) {
      const seated = room.players
        .filter((p) => p.seatIndex !== null)
        .sort((a, b) => (a.seatIndex! - b.seatIndex!));
      if (seated.length === 0) {
        room.hostPlayerId = room.players[0].playerId;
      } else if (leavingSeat === null) {
        room.hostPlayerId = seated[0].playerId;
      } else {
        const next =
          seated.find((p) => p.seatIndex! > leavingSeat)?.playerId ??
          seated[0].playerId;
        room.hostPlayerId = next;
      }
    }
    return room;
  }

  private createPlayer(nickname: string): TablePlayer {
    return {
      playerId: crypto.randomUUID(),
      nickname,
      seatIndex: null,
      stack: 1000,
      currentBet: 0,
      totalCommitted: 0,
      inHand: false,
      hasFolded: false,
      isAllIn: false,
      isReady: false,
      holeCards: [],
      actedThisStreet: false
    };
  }

  private createRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private createReconnectToken(playerId: string): string {
    const token = crypto.randomUUID();
    this.reconnectMap.set(token, playerId);
    return token;
  }
}
