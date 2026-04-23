export type Street = "preflop" | "flop" | "turn" | "river";

export type TablePhase =
  | "waiting"
  | "dealing"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "settlement";

export type PlayerActionType =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "allin";

export interface ClientToServerEvents {
  "room.create": (payload: { roomName: string; nickname: string }) => void;
  "room.join": (payload: { roomCode: string; nickname: string; reconnectToken?: string }) => void;
  "room.leave": () => void;
  /** 房主将指定玩家请出房间 */
  "room.kick": (payload: { targetPlayerId: string }) => void;
  /** 聊天消息广播（不进入 actionHistory） */
  "chat.send": (payload: { message: string }) => void;
  "seat.take": (payload: { seatIndex: number }) => void;
  "seat.leave": () => void;
  "hand.ready": (payload: { ready: boolean }) => void;
  "hand.start": () => void;
  "action.fold": () => void;
  "action.check": () => void;
  "action.call": () => void;
  "action.bet": (payload: { amount: number }) => void;
  "action.raise": (payload: { amount: number }) => void;
  "action.allin": () => void;
  /** 局间自动亮牌阶段快速准备（全员准备后可直接开下一局） */
  "hand.fastReady": (payload: { ready: boolean }) => void;
  /** 局间亮牌开关（当前前端默认不发送，服务端在结算后自动亮牌） */
  "hand.reveal": (payload: { show: boolean }) => void;
  ping: () => void;
}

export interface PublicPlayer {
  playerId: string;
  nickname: string;
  seatIndex: number | null;
  stack: number;
  currentBet: number;
  inHand: boolean;
  hasFolded: boolean;
  isAllIn: boolean;
  isReady: boolean;
}

export interface TableSnapshot {
  roomCode: string;
  phase: TablePhase;
  dealerSeat: number | null;
  smallBlindSeat: number | null;
  bigBlindSeat: number | null;
  currentTurnSeat: number | null;
  minRaise: number;
  toCall: number;
  pot: number;
  board: string[];
  actionHistory: Array<{ text: string; ts: number }>;
  /** 本局结束至下一局开始之间的亮牌窗口截止时间（毫秒时间戳），null 表示不在窗口内 */
  interHandRevealUntil: number | null;
  /** 结算后亮牌展示：座位号 -> 牌面 */
  revealedHands: Array<{ seatIndex: number; playerId: string; nickname: string; cards: string[] }>;
  /** 局间快速准备玩家列表（仅在自动亮牌窗口有意义） */
  fastReadyPlayerIds: string[];
  players: PublicPlayer[];
}

export interface RoomSnapshotPayload {
  roomCode: string;
  roomName: string;
  maxPlayers: number;
  yourPlayerId: string;
  hostPlayerId: string;
  reconnectToken: string;
}

export interface TurnStartedPayload {
  seatIndex: number;
  deadlineAt: number;
  availableActions: PlayerActionType[];
  minBet: number;
  minRaiseTo: number;
  maxRaiseTo: number;
}

export interface ActionAppliedPayload {
  seatIndex: number;
  action: PlayerActionType;
  amount: number;
  nextTurnSeat: number | null;
}

export interface HandEndedPayload {
  winners: Array<{ playerId: string; seatIndex: number; amount: number; handName: string }>;
  showdown: Array<{ seatIndex: number; cards: string[]; bestFive: string[]; handName: string }>;
}

export interface ServerToClientEvents {
  "room.snapshot": (payload: RoomSnapshotPayload) => void;
  "room.kicked": (payload: { message: string }) => void;
  "table.snapshot": (payload: TableSnapshot) => void;
  "player.hand": (payload: { cards: string[] }) => void;
  "table.hands": (payload: { hands: Array<{ seatIndex: number; playerId: string; nickname: string; cards: string[] }> }) => void;
  "turn.started": (payload: TurnStartedPayload) => void;
  "action.applied": (payload: ActionAppliedPayload) => void;
  "board.updated": (payload: { board: string[]; phase: TablePhase }) => void;
  "pot.updated": (payload: { pot: number; toCall: number; minRaise: number }) => void;
  "hand.ended": (payload: HandEndedPayload) => void;
  "chat.message": (payload: { playerId: string; message: string; ts: number }) => void;
  "error.invalidAction": (payload: { code: string; message: string }) => void;
  pong: () => void;
}
