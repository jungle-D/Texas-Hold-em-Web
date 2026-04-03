export const ErrorCodes = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  SEAT_OCCUPIED: "SEAT_OCCUPIED",
  INVALID_SEAT: "INVALID_SEAT",
  NOT_YOUR_TURN: "NOT_YOUR_TURN",
  INVALID_PHASE: "INVALID_PHASE",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  ACTION_NOT_ALLOWED: "ACTION_NOT_ALLOWED",
  PLAYER_NOT_SEATED: "PLAYER_NOT_SEATED",
  REVEAL_NOT_ALLOWED: "REVEAL_NOT_ALLOWED",
  KICK_NOT_ALLOWED: "KICK_NOT_ALLOWED"
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class ActionError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}
