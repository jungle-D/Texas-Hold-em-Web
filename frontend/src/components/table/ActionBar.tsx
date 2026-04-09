import type { PlayerActionType } from "@holdem/shared";
import { useEffect, useRef, useState } from "react";

interface ActionBarProps {
  canAct: boolean;
  myStack: number;
  toCall: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  availableActions: PlayerActionType[];
  disabledReason?: string;
  quickAmounts: Array<{ key: string; label: string; amount: number; disabled: boolean }>;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: (amount: number) => void;
  onAllIn: () => void;
}

export function ActionBar({
  canAct,
  myStack,
  toCall,
  minRaiseTo,
  maxRaiseTo,
  availableActions,
  disabledReason,
  quickAmounts,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onAllIn
}: ActionBarProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customRaiseTo, setCustomRaiseTo] = useState(minRaiseTo);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const can = (action: PlayerActionType) => canAct && availableActions.includes(action);
  const getHint = (fallback: string) => disabledReason ?? fallback;
  const canRaiseOrBet = can("raise") || can("bet");
  const threeBb = quickAmounts.find((q) => q.key === "3bb" && !q.disabled);
  const halfPot = quickAmounts.find((q) => q.key === "half" && !q.disabled);
  const fullPot = quickAmounts.find((q) => q.key === "full" && !q.disabled);
  const maxTo = Math.max(minRaiseTo, maxRaiseTo || minRaiseTo);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDocClick);
    return () => window.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);
  useEffect(() => {
    setCustomRaiseTo((prev) => Math.max(minRaiseTo, Math.min(prev, maxTo)));
  }, [minRaiseTo, maxTo]);

  const onCallOrCheck = () => {
    if (can("call")) {
      onCall();
      return;
    }
    if (can("check")) {
      // 在极简4键布局里，用“跟注”按钮兜底 check。
      onCheck();
    }
  };

  return (
    <section className={`action-bar ${canAct ? "active-turn" : ""}`}>
      <div className="stack-pill" aria-label="当前剩余筹码">筹码 {myStack}</div>
      <button disabled={!can("fold")} onClick={onFold} title={getHint("当前不可弃牌")}>
        弃牌
      </button>
      <button disabled={!(can("call") || can("check"))} onClick={onCallOrCheck} title={getHint("当前无需跟注或筹码不足")}>
        跟注 {can("call") ? toCall : 0}
      </button>
      <button disabled={!can("allin")} onClick={onAllIn} title={getHint("当前不可ALL-IN")}>
        ALL-IN
      </button>
      <div className="raise-menu-wrap" ref={menuRef}>
          <button
            className="raise-main-btn"
            disabled={!canRaiseOrBet}
            onClick={() => setMenuOpen((v) => !v)}
            title={getHint("当前不可下注/加注（可能筹码不足或规则限制）")}
          >
            加注 ▾
          </button>
          {menuOpen && canRaiseOrBet && (
            <div className="raise-menu">
              {halfPot && (
                <button onClick={() => { onRaise(halfPot.amount); setMenuOpen(false); }}>
                  半池
                </button>
              )}
              {fullPot && (
                <button onClick={() => { onRaise(fullPot.amount); setMenuOpen(false); }}>
                  满池
                </button>
              )}
              {threeBb && (
                <button onClick={() => { onRaise(threeBb.amount); setMenuOpen(false); }}>
                  3大盲
                </button>
              )}
              <div className="raise-custom">
                <label htmlFor="raise-custom-input">自定义加注到</label>
                <input
                  id="raise-custom-input"
                  type="number"
                  step={10}
                  min={minRaiseTo}
                  max={maxTo}
                  value={customRaiseTo}
                  onChange={(e) => {
                    const next = Number(e.target.value || minRaiseTo);
                    const snapped = Math.round(next / 10) * 10;
                    setCustomRaiseTo(Math.max(minRaiseTo, Math.min(snapped, maxTo)));
                  }}
                />
                <input
                  type="range"
                  min={minRaiseTo}
                  max={maxTo}
                  step={10}
                  value={customRaiseTo}
                  onChange={(e) => setCustomRaiseTo(Number(e.target.value))}
                />
                <div className="raise-custom-confirm">
                  <button
                    onClick={() => {
                      onRaise(customRaiseTo);
                      setMenuOpen(false);
                    }}
                  >
                    确认加注
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </section>
  );
}
