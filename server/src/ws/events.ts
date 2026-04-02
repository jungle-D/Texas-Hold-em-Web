import { ActionError, ErrorCodes, type ClientToServerEvents, type ServerToClientEvents } from "@holdem/shared";
import type { Server, Socket } from "socket.io";
import { RoomManager } from "../room/RoomManager.js";
import { legalActions } from "../game/PokerRuleEngine.js";

interface SocketData {
  roomCode?: string;
  playerId?: string;
}

export function registerGameEvents(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
  roomManager: RoomManager
): void {
  const nextHandTimers = new Map<string, NodeJS.Timeout>();
  const sendInvalid = (code: string, message: string) => socket.emit("error.invalidAction", { code, message });
  const pushHistory = (roomCode: string, text: string) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    room.actionHistory.push(text);
    if (room.actionHistory.length > 80) room.actionHistory.shift();
  };
  const scheduleNextHand = (roomCode: string) => {
    const prev = nextHandTimers.get(roomCode);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      nextHandTimers.delete(roomCode);
      const room = roomManager.getRoom(roomCode);
      if (!room) return;
      const started = room.table.startHand();
      if (!started) {
        room.table.resetToWaiting();
        pushHistory(roomCode, "等待至少2名已准备玩家开始下一局");
        emitRoomSnapshots(roomCode);
        return;
      }
      pushHistory(roomCode, "自动开始下一局");
      emitRoomSnapshots(roomCode);
      emitTurnStarted(roomCode);
    }, 2200);
    nextHandTimers.set(roomCode, timer);
  };
  const emitRoomSnapshots = (roomCode: string) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    const socketIds = io.sockets.adapter.rooms.get(roomCode);
    if (!socketIds) return;
    for (const sid of socketIds) {
      const client = io.sockets.sockets.get(sid);
      if (!client) continue;
      const pid = client.data.playerId as string | undefined;
      client.emit("table.snapshot", roomManager.snapshot(room, pid));
      const selfPlayer = room.players.find((p) => p.playerId === pid);
      client.emit("player.hand", { cards: selfPlayer?.inHand ? selfPlayer.holeCards : [] });
      const isSpectator = !selfPlayer || selfPlayer.seatIndex === null || selfPlayer.stack <= 0;
      if (isSpectator) {
        client.emit("table.hands", {
          hands: room.players
            .filter((p) => p.seatIndex !== null)
            .map((p) => ({
              seatIndex: p.seatIndex!,
              playerId: p.playerId,
              nickname: p.nickname,
              cards: p.holeCards
            }))
        });
      } else {
        client.emit("table.hands", { hands: [] });
      }
    }
  };
  const emitTurnStarted = (roomCode: string) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.table.currentTurnSeat === null) return;
    const current = room.players.find((p) => p.seatIndex === room.table.currentTurnSeat);
    if (!current) return;
    pushHistory(roomCode, `轮到 Seat ${room.table.currentTurnSeat + 1} (${current.nickname}) 操作`);
    io.to(roomCode).emit("turn.started", {
      seatIndex: room.table.currentTurnSeat,
      deadlineAt: Date.now() + 15000,
      availableActions: legalActions(current, room.table.toCall),
      minBet: 20,
      minRaiseTo: room.table.toCall + room.table.minRaise,
      maxRaiseTo: (current.currentBet ?? 0) + (current.stack ?? 0)
    });
  };

  socket.on("room.create", ({ roomName, nickname }) => {
    const { room, player, reconnectToken } = roomManager.createRoom(roomName, nickname);
    socket.data.roomCode = room.roomCode;
    socket.data.playerId = player.playerId;
    socket.join(room.roomCode);
    socket.emit("room.snapshot", {
      roomCode: room.roomCode,
      roomName: room.roomName,
      maxPlayers: room.maxPlayers,
      yourPlayerId: player.playerId,
      hostPlayerId: room.hostPlayerId,
      reconnectToken
    });
    roomManager.autoSeatPlayer(room, player.playerId);
    pushHistory(room.roomCode, `${nickname} 创建房间并入座`);
    emitRoomSnapshots(room.roomCode);
  });

  socket.on("room.join", ({ roomCode, nickname, reconnectToken }) => {
    const joined = roomManager.joinRoom(roomCode, nickname, reconnectToken);
    if (!joined) return sendInvalid(ErrorCodes.ROOM_NOT_FOUND, "房间不存在或已满");
    socket.data.roomCode = joined.room.roomCode;
    socket.data.playerId = joined.player.playerId;
    socket.join(joined.room.roomCode);
    socket.emit("room.snapshot", {
      roomCode: joined.room.roomCode,
      roomName: joined.room.roomName,
      maxPlayers: joined.room.maxPlayers,
      yourPlayerId: joined.player.playerId,
      hostPlayerId: joined.room.hostPlayerId,
      reconnectToken: joined.reconnectToken
    });
    roomManager.autoSeatPlayer(joined.room, joined.player.playerId);
    pushHistory(joined.room.roomCode, `${joined.player.nickname} 加入房间并入座`);
    emitRoomSnapshots(joined.room.roomCode);
  });

  socket.on("room.leave", () => {
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode || !playerId) return;
    socket.leave(roomCode);
    const room = roomManager.getRoom(roomCode);
    const who = room?.players.find((p) => p.playerId === playerId)?.nickname ?? "玩家";
    roomManager.leaveRoom(roomCode, playerId);
    pushHistory(roomCode, `${who} 退出房间`);
    socket.data.roomCode = undefined;
    socket.data.playerId = undefined;
    emitRoomSnapshots(roomCode);
  });

  socket.on("seat.take", ({ seatIndex }) => {
    const room = socket.data.roomCode ? roomManager.getRoom(socket.data.roomCode) : undefined;
    const playerId = socket.data.playerId;
    if (!room || !playerId) return;
    if (seatIndex < 0 || seatIndex > 5) return sendInvalid(ErrorCodes.INVALID_SEAT, "座位号无效");
    if (room.players.some((p) => p.seatIndex === seatIndex)) return sendInvalid(ErrorCodes.SEAT_OCCUPIED, "该座位已被占用");
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) return;
    if (player.stack <= 0) return sendInvalid(ErrorCodes.ACTION_NOT_ALLOWED, "筹码不足，进入观战席");
    player.seatIndex = seatIndex;
    emitRoomSnapshots(room.roomCode);
  });

  socket.on("hand.ready", ({ ready }) => {
    const room = socket.data.roomCode ? roomManager.getRoom(socket.data.roomCode) : undefined;
    const playerId = socket.data.playerId;
    if (!room || !playerId) return;
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player) return;
    player.isReady = ready;
    emitRoomSnapshots(room.roomCode);
  });

  socket.on("hand.start", () => {
    const room = socket.data.roomCode ? roomManager.getRoom(socket.data.roomCode) : undefined;
    const playerId = socket.data.playerId;
    if (!room || !playerId) return;
    if (room.hostPlayerId !== playerId) return sendInvalid(ErrorCodes.ACTION_NOT_ALLOWED, "仅房主可开始游戏");
    const started = room.table.startHand();
    if (!started) return sendInvalid(ErrorCodes.ACTION_NOT_ALLOWED, "至少2名已准备玩家才能开始");
    pushHistory(room.roomCode, "新一局开始，已发手牌");
    emitRoomSnapshots(room.roomCode);
    emitTurnStarted(room.roomCode);
  });

  const applyAction = (action: "fold" | "check" | "call" | "allin" | "bet" | "raise", amount?: number) => {
    const room = socket.data.roomCode ? roomManager.getRoom(socket.data.roomCode) : undefined;
    const playerId = socket.data.playerId;
    if (!room || !playerId) return;
    try {
      const beforeBoard = room.table.board.length;
      const beforePhase = room.table.phase;
      const result = room.table.applyAction(playerId, action, amount);
      const acted = room.players.find((p) => p.playerId === playerId);
      if (acted?.seatIndex !== null) {
        pushHistory(
          room.roomCode,
          `Seat ${acted.seatIndex + 1} (${acted.nickname}) ${action}${amount && amount > 0 ? ` ${amount}` : ""}`
        );
      }
      io.to(room.roomCode).emit("action.applied", {
        seatIndex: acted?.seatIndex ?? -1,
        action,
        amount: amount ?? 0,
        nextTurnSeat: result.nextSeat
      });
      io.to(room.roomCode).emit("pot.updated", {
        pot: room.table.pot,
        toCall: room.table.toCall,
        minRaise: room.table.minRaise
      });
      io.to(room.roomCode).emit("board.updated", {
        board: room.table.board,
        phase: room.table.phase
      });
      emitRoomSnapshots(room.roomCode);
      if (room.table.board.length > beforeBoard) {
        pushHistory(room.roomCode, `发公共牌：${room.table.phase.toUpperCase()}，进入下一轮行动`);
      }
      if (result.nextSeat === null) {
        io.to(room.roomCode).emit("turn.started", {
          seatIndex: -1,
          deadlineAt: Date.now(),
          availableActions: [],
          minBet: 0,
          minRaiseTo: 0,
          maxRaiseTo: 0
        });
      } else {
        emitTurnStarted(room.roomCode);
      }
      if (result.handEnded) {
        pushHistory(room.roomCode, `本局结束：${beforePhase} -> ${room.table.phase}`);
        io.to(room.roomCode).emit("hand.ended", result.handEnded);
        scheduleNextHand(room.roomCode);
      }
    } catch (error) {
      if (error instanceof ActionError) {
        sendInvalid(error.code, error.message);
        return;
      }
      sendInvalid(ErrorCodes.ACTION_NOT_ALLOWED, "执行动作失败");
    }
  };

  socket.on("action.fold", () => applyAction("fold"));
  socket.on("action.check", () => applyAction("check"));
  socket.on("action.call", () => applyAction("call"));
  socket.on("action.allin", () => applyAction("allin"));
  socket.on("action.bet", ({ amount }) => applyAction("bet", amount));
  socket.on("action.raise", ({ amount }) => applyAction("raise", amount));
  socket.on("ping", () => socket.emit("pong"));
}
