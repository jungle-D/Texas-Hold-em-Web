import type { PublicPlayer } from "@holdem/shared";

interface SeatProps {
  seatIndex: number;
  player?: PublicPlayer;
  isTurn: boolean;
  role?: "D" | "SB" | "BB";
  actionBadge?: string;
  /** 结算后自动亮牌，已格式化的牌面文案 */
  revealedCardTexts?: string[];
  isHost?: boolean;
  myPlayerId?: string;
  onKickPlayer?: (targetPlayerId: string) => void;
  onTakeSeat: (seatIndex: number) => void;
}

export function Seat({
  seatIndex,
  player,
  isTurn,
  role,
  actionBadge,
  revealedCardTexts,
  isHost,
  myPlayerId,
  onKickPlayer,
  onTakeSeat
}: SeatProps): JSX.Element {
  if (!player) {
    return (
      <button className={`seat empty pos-${seatIndex}`} onClick={() => onTakeSeat(seatIndex)}>
        + 入座 {seatIndex + 1}
      </button>
    );
  }
  return (
    <div className={`seat pos-${seatIndex} ${isTurn ? "turn" : ""} ${player.isReady ? "ready" : ""}`}>
      <div className="seat-head">
        <strong>{player.nickname}</strong>
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
      <span>筹码 {player.stack}</span>
      <span>{player.hasFolded ? "已弃牌" : player.isAllIn ? "ALL-IN" : "进行中"}</span>
      {player.isReady && <span className="ready-tag">已准备</span>}
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
