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
  actionHistory: string[];
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
  "table.snapshot": (payload: TableSnapshot) => void;
  "player.hand": (payload: { cards: string[] }) => void;
  "table.hands": (payload: { hands: Array<{ seatIndex: number; playerId: string; nickname: string; cards: string[] }> }) => void;
  "turn.started": (payload: TurnStartedPayload) => void;
  "action.applied": (payload: ActionAppliedPayload) => void;
  "board.updated": (payload: { board: string[]; phase: TablePhase }) => void;
  "pot.updated": (payload: { pot: number; toCall: number; minRaise: number }) => void;
  "hand.ended": (payload: HandEndedPayload) => void;
  "error.invalidAction": (payload: { code: string; message: string }) => void;
  pong: () => void;
}
