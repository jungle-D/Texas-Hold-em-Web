import { useEffect, useRef, useState } from "react";
import { ActionBar } from "../components/table/ActionBar";
import { Seat } from "../components/table/Seat";
import type { PlayerActionType, TableSnapshot, TurnStartedPayload } from "@holdem/shared";

interface TableProps {
  me: string;
  hostPlayerId: string;
  snapshot: TableSnapshot;
  turnInfo: TurnStartedPayload | null;
  myCards: string[];
  lastActionText: string;
  eventBanner: string;
  lastAppliedAction: { seatIndex: number; action: string; amount: number } | null;
  spectatorHands: Array<{ seatIndex: number; nickname: string; cards: string[] }>;
  onTakeSeat: (seatIndex: number) => void;
  onReady: (ready: boolean) => void;
  onStartHand: () => void;
  onLeaveRoom: () => void;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onBet: (amount: number) => void;
  onRaise: (amount: number) => void;
  onAllIn: () => void;
}

export function Table({
  me,
  hostPlayerId,
  snapshot,
  turnInfo,
  myCards,
  lastActionText,
  eventBanner,
  lastAppliedAction,
  spectatorHands,
  onTakeSeat,
  onReady,
  onStartHand,
  onLeaveRoom,
  onFold,
  onCheck,
  onCall,
  onBet,
  onRaise,
  onAllIn
}: TableProps): JSX.Element {
  const boardSizeRef = useRef(snapshot.board.length);
  const [pauseTurnHighlight, setPauseTurnHighlight] = useState(false);
  const [hideMyCards, setHideMyCards] = useState(false);
  const [seatActionBadges, setSeatActionBadges] = useState<Record<number, string>>({});
  const prettyCard = (raw: string): { text: string; isRed: boolean } => {
    const rank = raw[0] ?? "";
    const suit = raw[1] ?? "";
    const suitMap: Record<string, string> = { s: "♠️", h: "♥️", d: "♦️", c: "♣️" };
    return { text: `${rank}${suitMap[suit] ?? suit}`, isRed: suit === "h" || suit === "d" };
  };
  const bySeat = new Map(snapshot.players.filter((p) => p.seatIndex !== null).map((p) => [p.seatIndex!, p]));
  const roleBySeat = new Map<number, "D" | "SB" | "BB">();
  if (snapshot.dealerSeat !== null) roleBySeat.set(snapshot.dealerSeat, "D");
  if (snapshot.smallBlindSeat !== null) roleBySeat.set(snapshot.smallBlindSeat, "SB");
  if (snapshot.bigBlindSeat !== null) roleBySeat.set(snapshot.bigBlindSeat, "BB");
  const mePlayer = snapshot.players.find((p) => p.playerId === me);
  const canAct = Boolean(mePlayer && turnInfo && mePlayer.seatIndex === turnInfo.seatIndex);
  const availableActions: PlayerActionType[] = canAct && turnInfo ? turnInfo.availableActions : [];
  const disabledReason = !canAct
    ? "当前不是你的回合"
    : availableActions.includes("allin") && !availableActions.includes("call")
      ? "当前筹码不足以跟注，只能ALL-IN或弃牌"
      : undefined;
  const isSpectator = !mePlayer || mePlayer.seatIndex === null || mePlayer.stack <= 0;
  useEffect(() => {
    if (snapshot.board.length !== boardSizeRef.current) {
      boardSizeRef.current = snapshot.board.length;
      setPauseTurnHighlight(true);
      setSeatActionBadges({});
      const timer = setTimeout(() => setPauseTurnHighlight(false), 900);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [snapshot.board.length]);
  useEffect(() => {
    if (!lastAppliedAction || lastAppliedAction.seatIndex < 0) return;
    const amountText = lastAppliedAction.amount > 0 ? ` ${lastAppliedAction.amount}` : "";
    setSeatActionBadges((prev) => ({
      ...prev,
      [lastAppliedAction.seatIndex]: `${lastAppliedAction.action.toUpperCase()}${amountText}`
    }));
  }, [lastAppliedAction]);
  const readyPlayers = snapshot.players.filter((p) => p.seatIndex !== null && p.isReady).length;
  const canStart = snapshot.phase === "waiting" && me === hostPlayerId && readyPlayers >= 2;
  const bb = 20;
  const meBet = mePlayer?.currentBet ?? 0;
  const callNeed = Math.max(0, snapshot.toCall - meBet);
  const canOpenBet = snapshot.toCall === meBet;
  const stack = mePlayer?.stack ?? 0;
  const potCapAdd = snapshot.pot + callNeed + snapshot.toCall;
  const quickAdds = [
    { key: "3bb", label: "3大盲", add: bb * 3 },
    { key: "half", label: "半池", add: Math.floor(snapshot.pot / 2) },
    { key: "full", label: "满池", add: snapshot.pot },
    { key: "max", label: "最大", add: potCapAdd }
  ];
  const quickAmounts = quickAdds.map((q) => {
    const totalTarget = canOpenBet ? q.add : snapshot.toCall + q.add;
    const bounded = Math.max(snapshot.minRaise + snapshot.toCall, Math.min(totalTarget, meBet + stack));
    return { key: q.key, label: q.label, amount: bounded, disabled: bounded <= snapshot.toCall || stack <= 0 };
  });
  const startHint =
    snapshot.phase !== "waiting"
      ? "本局进行中"
      : me !== hostPlayerId
        ? "仅房主可开始"
        : readyPlayers < 2
          ? "至少2名玩家准备"
          : "可开始游戏";
  const hintTone = canStart ? "ok" : snapshot.phase !== "waiting" ? "muted" : "warn";

  return (
    <main className="screen table">
      <header className="table-head top-pot">
        <h2 className="table-title">房间 {snapshot.roomCode}</h2>
        <div className="head-chip">阶段：{snapshot.phase}</div>
        <div className="head-chip pot-chip">POT {snapshot.pot}</div>
        <div className="event-banner">{eventBanner || "等待回合广播..."}</div>
      </header>

      <section className={`hand-panel ${snapshot.phase === "waiting" ? "hidden" : ""}`}>
        <div className="hand-title">你的手牌</div>
        <button className="hide-cards-btn" onClick={() => setHideMyCards((v) => !v)}>
          {hideMyCards ? "显示手牌" : "隐藏手牌"}
        </button>
        <div className="hand-cards">
          {hideMyCards
            ? myCards.map((c, idx) => (
                <span key={`${c}-${idx}`} className="card-face back">🂠</span>
              ))
            : myCards.length > 0
            ? myCards.map((c) => {
                const v = prettyCard(c);
                return (
                  <span key={c} className={`card-face ${v.isRed ? "red" : "black"}`}>
                    {v.text}
                  </span>
                );
              })
            : <span>等待发牌...</span>}
        </div>
        {isSpectator && (
          <div className="spectator-note">你当前为观战席（筹码不足或未入座），可查看所有玩家手牌。</div>
        )}
      </section>

      <section className={`seat-ring table-layout ${pauseTurnHighlight ? "street-focus" : ""}`}>
        <div className={`center-board ${snapshot.currentTurnSeat === null && snapshot.phase !== "waiting" ? "board-focus" : ""}`}>
          <div className="board-title">公共牌</div>
          <div className="board-cards">
            {snapshot.board.length > 0
              ? snapshot.board.map((c) => {
                  const v = prettyCard(c);
                  return (
                    <span key={c} className={`board-card ${v.isRed ? "red" : "black"}`}>
                      {v.text}
                    </span>
                  );
                })
              : <span className="board-empty">等待发牌...</span>}
          </div>
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <Seat
            key={i}
            seatIndex={i}
            player={bySeat.get(i)}
            role={roleBySeat.get(i)}
            actionBadge={seatActionBadges[i]}
            isTurn={!pauseTurnHighlight && snapshot.currentTurnSeat === i}
            onTakeSeat={onTakeSeat}
          />
        ))}
      </section>

      <section className="table-controls">
        <button onClick={() => onReady(true)} disabled={isSpectator}>准备</button>
        <button onClick={() => onReady(false)} disabled={isSpectator}>取消准备</button>
        <button onClick={onStartHand} disabled={!canStart}>
          开始游戏
        </button>
        <button onClick={onLeaveRoom}>退出房间</button>
        <div className="status-pill">已准备 {readyPlayers}/2（最少）</div>
        <div className={`status-pill ${hintTone}`}>{startHint}</div>
        <div className="status-pill muted action-log">{lastActionText || "等待玩家操作..."}</div>
      </section>

      {isSpectator && spectatorHands.length > 0 && (
        <section className="history-panel">
          <div className="history-title">观战：全员手牌</div>
          <div className="history-list">
            {spectatorHands
              .slice()
              .sort((a, b) => a.seatIndex - b.seatIndex)
              .map((h) => (
                <div key={`${h.seatIndex}-${h.nickname}`} className="history-item">
                  Seat {h.seatIndex + 1}（{h.nickname}）：
                  {" "}
                  {h.cards.length > 0
                    ? h.cards.map((c) => prettyCard(c).text).join(" ")
                    : "等待发牌"}
                </div>
              ))}
          </div>
        </section>
      )}

      <ActionBar
        canAct={canAct}
        toCall={callNeed}
        minRaiseTo={snapshot.toCall + snapshot.minRaise}
        availableActions={availableActions}
        disabledReason={disabledReason}
        quickAmounts={quickAmounts}
        onFold={onFold}
        onCheck={onCheck}
        onCall={onCall}
        onRaise={(amount) => (canOpenBet ? onBet(amount) : onRaise(amount))}
        onAllIn={onAllIn}
      />

      <section className="history-panel">
        <div className="history-title">操作历史</div>
        <div className="history-list">
          {snapshot.actionHistory.length > 0
            ? snapshot.actionHistory.slice(-12).reverse().map((h, idx) => (
                <div key={`${h}-${idx}`} className="history-item">
                  {h}
                </div>
              ))
            : <div className="history-item">暂无历史</div>}
        </div>
      </section>
    </main>
  );
}
