import type { PublicPlayer } from "@holdem/shared";

interface SeatProps {
  seatIndex: number;
  player?: PublicPlayer;
  isTurn: boolean;
  role?: "D" | "SB" | "BB";
  actionBadge?: string;
  onTakeSeat: (seatIndex: number) => void;
}

export function Seat({ seatIndex, player, isTurn, role, actionBadge, onTakeSeat }: SeatProps): JSX.Element {
  if (!player) {
    return (
      <button className={`seat empty pos-${seatIndex}`} onClick={() => onTakeSeat(seatIndex)}>
        + 入座 {seatIndex + 1}
      </button>
    );
  }
  return (
    <div className={`seat pos-${seatIndex} ${isTurn ? "turn" : ""} ${player.isReady ? "ready" : ""}`}>
      <strong>{player.nickname}</strong>
      {role && <span className={`role-tag ${role.toLowerCase()}`}>{role}</span>}
      <span>筹码 {player.stack}</span>
      <span>{player.hasFolded ? "已弃牌" : player.isAllIn ? "ALL-IN" : "进行中"}</span>
      {player.isReady && <span className="ready-tag">已准备</span>}
      {actionBadge && <span className="action-badge">{actionBadge}</span>}
    </div>
  );
}
