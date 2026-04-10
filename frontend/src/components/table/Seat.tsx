import type { PublicPlayer } from "@holdem/shared";

interface SeatProps {
  seatIndex: number;
  player?: PublicPlayer;
  isTurn: boolean;
  role?: "D" | "SB" | "BB";
  actionBadge?: string;
  /** 结算后自动亮牌，已格式化的牌面文案 */
  revealedCardTexts?: string[];
  isWinner?: boolean;
  winnerHandName?: string;
  isHost?: boolean;
  myPlayerId?: string;
  chipClassName?: string;
  onKickPlayer?: (targetPlayerId: string) => void;
}

export function Seat({
  seatIndex,
  player,
  isTurn,
  role,
  actionBadge,
  revealedCardTexts,
  isWinner,
  winnerHandName,
  isHost,
  myPlayerId,
  chipClassName,
  onKickPlayer
}: SeatProps): JSX.Element {
  if (!player) {
    return <></>;
  }
  return (
    <div className={`seat seat-pin pos-${seatIndex} ${isTurn ? "turn turn-pulse" : ""} ${player.isReady ? "ready" : ""} ${isWinner ? "winner" : ""}`}>
      {isTurn && <div className="turn-signal">行动中</div>}
      <div className="seat-head">
        <strong className="seat-name">{player.nickname}</strong>
        <span className="seat-stack">筹码 {player.stack}</span>
        {isWinner && <span className="winner-tag">WINNER 🏆</span>}
        {isHost && onKickPlayer && myPlayerId && player.playerId !== myPlayerId && (
          <button
            type="button"
            className="seat-kick-btn"
            title="请出该玩家"
            onClick={(e) => {
              e.stopPropagation();
              onKickPlayer(player.playerId);
            }}
          >
            请出
          </button>
        )}
      </div>
      {role && <span className={`role-tag ${role.toLowerCase()}`}>{role}</span>}
      <span className="seat-state">{player.hasFolded ? "已弃牌" : player.isAllIn ? "ALL-IN" : "进行中"}</span>
      <span className="seat-chip-stack" aria-hidden="true">
        <span className={`seat-chip-dot ${chipClassName ?? "chip-amber"}`} />
        <span className={`seat-chip-dot ${chipClassName ?? "chip-amber"}`} />
      </span>
      {isWinner && winnerHandName && <span className="winner-hand">牌型：{winnerHandName}</span>}
      {actionBadge && <span className="action-badge">{actionBadge}</span>}
      {revealedCardTexts && revealedCardTexts.length > 0 && (
        <div className="seat-revealed-cards" aria-label="本局亮牌">
          {revealedCardTexts.map((t, idx) => (
            <span key={`${t}-${idx}`} className="seat-revealed-chip">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
