import { useCallback, useEffect, useRef, useState } from "react";
import { ActionBar } from "../components/table/ActionBar";
import { Seat } from "../components/table/Seat";
import type { PlayerActionType, TableSnapshot, TurnStartedPayload } from "@holdem/shared";

interface TableProps {
  me: string;
  hostPlayerId: string;
  snapshot: TableSnapshot;
  turnInfo: TurnStartedPayload | null;
  myCards: string[];
  lastAppliedAction: { seatIndex: number; action: string; amount: number } | null;
  spectatorHands: Array<{ seatIndex: number; nickname: string; cards: string[] }>;
  winners: Array<{ playerId: string; seatIndex: number; amount: number; handName: string }>;
  onStartHand: () => void;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onBet: (amount: number) => void;
  onRaise: (amount: number) => void;
  onAllIn: () => void;
  onKickPlayer: (targetPlayerId: string) => void;
}

export function Table({
  me,
  hostPlayerId,
  snapshot,
  turnInfo,
  myCards,
  lastAppliedAction,
  spectatorHands,
  winners,
  onStartHand,
  onFold,
  onCheck,
  onCall,
  onBet,
  onRaise,
  onAllIn,
  onKickPlayer
}: TableProps): JSX.Element {
  const boardSizeRef = useRef(snapshot.board.length);
  const phaseRef = useRef(snapshot.phase);
  const cancelKickBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmKickBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const [pauseTurnHighlight, setPauseTurnHighlight] = useState(false);
  const [kickConfirmTargetId, setKickConfirmTargetId] = useState<string | null>(null);
  const [hideMyCards, setHideMyCards] = useState(false);
  const [seatActionBadges, setSeatActionBadges] = useState<Record<number, string>>({});
  const [historyEntries, setHistoryEntries] = useState<Array<{ text: string; ts: number }>>([]);
  const [historyPos, setHistoryPos] = useState({ x: 16, y: window.innerHeight - 330 });
  const [historySize, setHistorySize] = useState({ width: 340, height: 160 });
  const [, setRevealTick] = useState(0);
  const historyListRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const prettyCard = (raw: string): { text: string; isRed: boolean } => {
    const rank = raw[0] ?? "";
    const suit = raw[1] ?? "";
    const suitMap: Record<string, string> = { s: "♠️", h: "♥️", d: "♦️", c: "♣️" };
    return { text: `${rank}${suitMap[suit] ?? suit}`, isRed: suit === "h" || suit === "d" };
  };
  const mePlayer = snapshot.players.find((p) => p.playerId === me);
  const mySeatIndex = mePlayer?.seatIndex ?? null;
  const mapRealSeatToUiSeat = useCallback(
    (realSeat: number): number => {
      if (mySeatIndex === null) return realSeat;
      return ((realSeat - mySeatIndex + 6) % 6 + 3) % 6;
    },
    [mySeatIndex]
  );
  const bySeat = new Map(
    snapshot.players
      .filter((p) => p.seatIndex !== null && p.playerId !== me)
      .map((p) => [mapRealSeatToUiSeat(p.seatIndex!), p] as const)
  );
  const roleBySeat = new Map<number, "D" | "SB" | "BB">();
  if (snapshot.dealerSeat !== null) roleBySeat.set(mapRealSeatToUiSeat(snapshot.dealerSeat), "D");
  if (snapshot.smallBlindSeat !== null) roleBySeat.set(mapRealSeatToUiSeat(snapshot.smallBlindSeat), "SB");
  if (snapshot.bigBlindSeat !== null) roleBySeat.set(mapRealSeatToUiSeat(snapshot.bigBlindSeat), "BB");
  const winnerByPlayerId = new Map(winners.map((w) => [w.playerId, w]));
  const canAct = Boolean(mePlayer && turnInfo && mePlayer.seatIndex === turnInfo.seatIndex);
  const availableActions: PlayerActionType[] = canAct && turnInfo ? turnInfo.availableActions : [];
  const disabledReason = !canAct
    ? "当前不是你的回合"
    : availableActions.includes("allin") && !availableActions.includes("call")
      ? "当前筹码不足以跟注，只能ALL-IN或弃牌"
      : undefined;
  const isSpectator = !mePlayer || mePlayer.seatIndex === null || mePlayer.stack <= 0;
  const revealWindowActive = Boolean(
    snapshot.interHandRevealUntil && Date.now() < snapshot.interHandRevealUntil
  );
  const revealSecondsLeft = snapshot.interHandRevealUntil
    ? Math.max(0, Math.ceil((snapshot.interHandRevealUntil - Date.now()) / 1000))
    : 0;
  const revealedTextsBySeat = new Map<number, string[]>();
  for (const r of snapshot.revealedHands) {
    revealedTextsBySeat.set(mapRealSeatToUiSeat(r.seatIndex), r.cards.map((c) => prettyCard(c).text));
  }
  useEffect(() => {
    if (!snapshot.interHandRevealUntil) return;
    const id = window.setInterval(() => setRevealTick((t) => t + 1), 300);
    return () => clearInterval(id);
  }, [snapshot.interHandRevealUntil]);
  useEffect(() => {
    if (!kickConfirmTargetId) return;
    cancelKickBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKickConfirmTargetId(null);
      if (e.key !== "Tab") return;
      const cancelBtn = cancelKickBtnRef.current;
      const confirmBtn = confirmKickBtnRef.current;
      if (!cancelBtn || !confirmBtn) return;
      const active = document.activeElement;
      if (e.shiftKey && active === cancelBtn) {
        e.preventDefault();
        confirmBtn.focus();
      } else if (!e.shiftKey && active === confirmBtn) {
        e.preventDefault();
        cancelBtn.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kickConfirmTargetId]);
  useEffect(() => {
    if (kickConfirmTargetId !== null) return;
    lastFocusedElementRef.current?.focus();
  }, [kickConfirmTargetId]);
  useEffect(() => {
    if (snapshot.board.length !== boardSizeRef.current || snapshot.phase !== phaseRef.current) {
      boardSizeRef.current = snapshot.board.length;
      phaseRef.current = snapshot.phase;
      setPauseTurnHighlight(true);
      setSeatActionBadges({});
      const timer = setTimeout(() => setPauseTurnHighlight(false), 900);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [snapshot.board.length]);
  useEffect(() => {
    if (!lastAppliedAction || lastAppliedAction.seatIndex < 0) return;
    const uiSeat = mapRealSeatToUiSeat(lastAppliedAction.seatIndex);
    const amountText = lastAppliedAction.amount > 0 ? ` ${lastAppliedAction.amount}` : "";
    setSeatActionBadges((prev) => ({
      ...prev,
      [uiSeat]: `${lastAppliedAction.action.toUpperCase()}${amountText}`
    }));
  }, [lastAppliedAction, mapRealSeatToUiSeat]);
  useEffect(() => {
    setHistoryEntries(snapshot.actionHistory.slice(-12));
  }, [snapshot.actionHistory]);
  useEffect(() => {
    if (!historyListRef.current) return;
    historyListRef.current.scrollTop = historyListRef.current.scrollHeight;
  }, [historyEntries.length]);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const maxX = Math.max(8, window.innerWidth - historySize.width - 8);
        const maxY = Math.max(8, window.innerHeight - historySize.height - 8);
        setHistoryPos({
          x: Math.max(8, Math.min(maxX, dragRef.current.startLeft + dx)),
          y: Math.max(8, Math.min(maxY, dragRef.current.startTop + dy))
        });
      }
      if (resizeRef.current) {
        const dw = e.clientX - resizeRef.current.startX;
        const dh = e.clientY - resizeRef.current.startY;
        const minW = 260;
        const minH = 110;
        const maxW = Math.min(520, window.innerWidth - historyPos.x - 8);
        const maxH = Math.min(360, window.innerHeight - historyPos.y - 8);
        setHistorySize({
          width: Math.max(minW, Math.min(maxW, resizeRef.current.startW + dw)),
          height: Math.max(minH, Math.min(maxH, resizeRef.current.startH + dh))
        });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [historyPos.x, historyPos.y, historySize.width, historySize.height]);
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
    { key: "full", label: "2/3底池", add: Math.floor((snapshot.pot * 2) / 3) },
    { key: "max", label: "最大", add: potCapAdd }
  ];
  const quickAmounts = quickAdds.map((q) => {
    const totalTarget = canOpenBet ? q.add : snapshot.toCall + q.add;
    const bounded = Math.max(snapshot.minRaise + snapshot.toCall, Math.min(totalTarget, meBet + stack));
    return { key: q.key, label: q.label, amount: bounded, disabled: bounded <= snapshot.toCall || stack <= 0 };
  });
  const kickConfirmName =
    kickConfirmTargetId === null
      ? ""
      : snapshot.players.find((p) => p.playerId === kickConfirmTargetId)?.nickname ?? "该玩家";
  const chipColorClasses = ["chip-red", "chip-blue", "chip-green", "chip-amber", "chip-violet", "chip-rose"];
  const pickChipClass = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return chipColorClasses[hash % chipColorClasses.length];
  };
  const potChipClasses = [0, 1, 2].map((i) => pickChipClass(`${snapshot.roomCode}-${snapshot.pot}-${snapshot.board.length}-${i}`));

  return (
    <main className="screen table">
      <header className="table-head top-pot compact-head">
        <h2 className="table-title">房间号 #{snapshot.roomCode}</h2>
      </header>
      {revealWindowActive && (
        <section className="inter-hand-banner" aria-live="polite">
          <span>
            下一局约 <strong>{revealSecondsLeft}</strong> 秒后开始 · 本局已自动亮牌
          </span>
        </section>
      )}

      <section className={`seat-ring table-layout ${pauseTurnHighlight ? "street-focus" : ""}`}>
        <div className={`center-board ${snapshot.currentTurnSeat === null && snapshot.phase !== "waiting" ? "board-focus" : ""}`}>
          <div className="center-board-inner">
            <div className="community-block">
              {snapshot.phase === "waiting" && me === hostPlayerId && (
                <div className="start-hand-wrap">
                  <button onClick={onStartHand} disabled={!canStart} className="start-hand-btn">
                    开始游戏
                  </button>
                </div>
              )}
              <div className="board-title">公共牌区</div>
              <div className="community-slots" aria-label="五张公共牌位">
                {Array.from({ length: 5 }, (_, i) => {
                  const c = snapshot.board[i];
                  const v = c ? prettyCard(c) : null;
                  return (
                    <div key={i} className={`community-slot ${c ? "filled" : ""}`}>
                      {c && v ? (
                        <span className={`board-card ${v.isRed ? "red" : "black"}`}>{v.text}</span>
                      ) : (
                        <span className="slot-placeholder">·</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="pot-block" aria-label="当前底池">
              <div className="pot-block-label">底池</div>
              <div className="pot-chips" aria-hidden="true">
                {potChipClasses.map((chipClass, idx) => (
                  <span key={`${chipClass}-${idx}`} className={`pot-chip-dot ${chipClass}`} />
                ))}
              </div>
              <div className="pot-block-value">{snapshot.pot}</div>
            </div>
          </div>
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <Seat
            key={i}
            seatIndex={i}
            player={bySeat.get(i)}
            role={roleBySeat.get(i)}
            actionBadge={seatActionBadges[i]}
            revealedCardTexts={revealedTextsBySeat.get(i)}
            isTurn={!pauseTurnHighlight && snapshot.currentTurnSeat !== null && mapRealSeatToUiSeat(snapshot.currentTurnSeat) === i}
            isWinner={Boolean(bySeat.get(i) && winnerByPlayerId.has(bySeat.get(i)!.playerId))}
            winnerHandName={bySeat.get(i) ? winnerByPlayerId.get(bySeat.get(i)!.playerId)?.handName : undefined}
            isHost={me === hostPlayerId}
            chipClassName={bySeat.get(i) ? pickChipClass(`${bySeat.get(i)!.playerId}-${i}-${snapshot.pot}`) : undefined}
            onKickPlayer={(targetPlayerId) => {
              lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
              setKickConfirmTargetId(targetPlayerId);
            }}
            myPlayerId={me}
          />
        ))}
      </section>

      {isSpectator && spectatorHands.length > 0 && (
        <section className="history-panel history-panel-spectator">
          <div className="history-title">观战：全员手牌</div>
          <div className="history-list">
            {spectatorHands
              .slice()
              .sort((a, b) => mapRealSeatToUiSeat(a.seatIndex) - mapRealSeatToUiSeat(b.seatIndex))
              .map((h) => (
                <div key={`${h.seatIndex}-${h.nickname}`} className="history-item">
                  Seat {mapRealSeatToUiSeat(h.seatIndex) + 1}（{h.nickname}）：
                  {" "}
                  {h.cards.length > 0
                    ? h.cards.map((c) => prettyCard(c).text).join(" ")
                    : "等待发牌"}
                </div>
              ))}
          </div>
        </section>
      )}

      <section
        className="history-panel history-panel-chat fixed-history"
        style={{ left: historyPos.x, top: historyPos.y, width: historySize.width, height: historySize.height }}
      >
        <div
          className="history-drag-handle"
          onMouseDown={(e) => {
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              startLeft: historyPos.x,
              startTop: historyPos.y
            };
          }}
        >
          消息历史
        </div>
        <div ref={historyListRef} className="history-list history-chat-list">
          {historyEntries.length > 0
            ? historyEntries.map((entry, idx) => (
                <div key={`${entry.ts}-${entry.text}-${idx}`} className="history-item history-chat-item">
                  <span className="history-bubble">
                    <span className="history-time">{new Date(entry.ts).toLocaleTimeString("zh-CN", { hour12: false })}</span>
                    <span>{entry.text}</span>
                  </span>
                </div>
              ))
            : <div className="history-item history-chat-item"><span className="history-bubble">暂无历史</span></div>}
        </div>
        <button
          className="history-resize-handle"
          type="button"
          aria-label="缩放历史消息框"
          onMouseDown={(e) => {
            resizeRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              startW: historySize.width,
              startH: historySize.height
            };
          }}
        />
      </section>

      <section className={`floating-hand ${snapshot.phase === "waiting" ? "hidden" : ""}`}>
        <div className="hand-cards hand-cards-centered hand-cards-floating">
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
          <button className="hide-cards-btn eye-btn inline-eye-btn" onClick={() => setHideMyCards((v) => !v)} title={hideMyCards ? "显示手牌" : "隐藏手牌"}>
            {hideMyCards ? "👁️" : "🙈"}
          </button>
        </div>
        {isSpectator && (
          <div className="spectator-note">
            你当前为观战席（筹码不足或未入座）。默认不广播他人底牌；结算后会自动亮牌展示。若服务端设置{" "}
            <code>SPECTATOR_SEE_ALL_HOLES</code> 可开启观战看全员手牌。
          </div>
        )}
      </section>

      <section className={`action-dock ${canAct ? "self-turn" : ""}`}>
        <ActionBar
          canAct={canAct}
          myStack={stack}
          toCall={callNeed}
          minRaiseTo={snapshot.toCall + snapshot.minRaise}
          maxRaiseTo={turnInfo?.maxRaiseTo ?? (meBet + stack)}
          availableActions={availableActions}
          disabledReason={disabledReason}
          quickAmounts={quickAmounts}
          onFold={onFold}
          onCheck={onCheck}
          onCall={onCall}
          onRaise={(amount) => (canOpenBet ? onBet(amount) : onRaise(amount))}
          onAllIn={onAllIn}
        />
      </section>

      {kickConfirmTargetId !== null && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setKickConfirmTargetId(null)}
        >
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kick-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="kick-dialog-title" className="modal-title">
              请出玩家
            </h3>
            <p className="modal-body">
              确定将「{kickConfirmName}」请出房间？该玩家所有连接将被断开。
            </p>
            <div className="modal-actions">
              <button ref={cancelKickBtnRef} type="button" onClick={() => setKickConfirmTargetId(null)}>
                取消
              </button>
              <button
                ref={confirmKickBtnRef}
                type="button"
                className="modal-danger"
                onClick={() => {
                  onKickPlayer(kickConfirmTargetId);
                  setKickConfirmTargetId(null);
                }}
              >
                请出
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
