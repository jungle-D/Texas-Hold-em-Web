import type { PlayerActionType } from "@holdem/shared";
import { useEffect, useState, type CSSProperties } from "react";

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
  const [selectedQuickKey, setSelectedQuickKey] = useState("3bb");
  const [customRaiseTo, setCustomRaiseTo] = useState(minRaiseTo);
  const [raiseMode, setRaiseMode] = useState<"quick" | "custom">("quick");
  const can = (action: PlayerActionType) => canAct && availableActions.includes(action);
  const getHint = (fallback: string) => disabledReason ?? fallback;
  const canRaiseOrBet = can("raise") || can("bet");
  const maxTo = Math.max(minRaiseTo, maxRaiseTo || minRaiseTo);
  const customRange = Math.max(0, maxTo - minRaiseTo);
  const customSegments = Math.max(1, Math.min(24, Math.max(6, myStack)));
  const customStep = Math.max(1, Math.floor(customRange / customSegments) || 1);
  const selectedQuick = quickAmounts.find((q) => q.key === selectedQuickKey) ?? quickAmounts.find((q) => !q.disabled) ?? null;
  const selectedQuickIndex = Math.max(0, quickAmounts.findIndex((q) => q.key === selectedQuickKey));

  useEffect(() => {
    if (quickAmounts.some((q) => q.key === "3bb" && !q.disabled)) {
      setSelectedQuickKey("3bb");
      return;
    }
    const firstEnabled = quickAmounts.find((q) => !q.disabled);
    if (firstEnabled) setSelectedQuickKey(firstEnabled.key);
  }, [quickAmounts]);
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
  const onRaiseByQuick = () => {
    if (!selectedQuick) return;
    if (selectedQuick.key === "max" && !canRaiseOrBet && can("allin")) {
      onAllIn();
      return;
    }
    if (!canRaiseOrBet || selectedQuick.disabled) return;
    const clamped = Math.max(minRaiseTo, Math.min(selectedQuick.amount, maxTo));
    onRaise(clamped);
  };
  const onRaiseByCurrentMode = () => {
    if (raiseMode === "custom") {
      if (!canRaiseOrBet) return;
      onRaise(Math.max(minRaiseTo, Math.min(customRaiseTo, maxTo)));
      return;
    }
    onRaiseByQuick();
  };
  const quickAllInMode = raiseMode === "quick" && Boolean(selectedQuick && selectedQuick.key === "max" && !canRaiseOrBet && can("allin"));

  return (
    <section className={`action-bar ${canAct ? "active-turn" : ""}`}>
      <div className="action-status" aria-live="polite">
        <span className="action-status-label">当前状态</span>
        <span className="action-status-value">{canAct ? "轮到你行动" : "等待下一手牌..."}</span>
      </div>
      <div className="action-controls-center">
        <div className="action-main">
          <button className="action-btn action-btn-fold" disabled={!can("fold")} onClick={onFold} title={getHint("当前不可弃牌")}>
            弃牌
          </button>
          <button className="action-btn action-btn-main" disabled={!(can("call") || can("check"))} onClick={onCallOrCheck} title={getHint("当前无需跟注或筹码不足")}>
            过牌 / 跟注 {can("call") ? toCall : 0}
          </button>
        </div>
        <div className="raise-quick-area">
          <div
            className={`raise-quick-strip ${raiseMode === "custom" ? "custom-mode" : ""}`}
            role="tablist"
            aria-label="快捷加注"
            style={{ "--quick-index": selectedQuickIndex } as CSSProperties}
          >
            {raiseMode === "quick" ? (
              <>
                <span className="quick-selection-glider" aria-hidden="true" />
                {quickAmounts.map((q) => {
                  const selected = q.key === selectedQuickKey;
                  const label = q.label;
                  return (
                    <button
                      key={q.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={`quick-chip ${selected ? "selected" : ""}`}
                      disabled={q.disabled}
                      onClick={() => {
                        setSelectedQuickKey(q.key);
                        setCustomRaiseTo(Math.max(minRaiseTo, Math.min(q.amount, maxTo)));
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </>
            ) : (
              <div className="raise-custom-inline">
                <input
                  id="raise-custom-range"
                  className="raise-custom-slider"
                  type="range"
                  min={minRaiseTo}
                  max={maxTo}
                  step={customStep}
                  value={customRaiseTo}
                  onChange={(e) => setCustomRaiseTo(Number(e.target.value))}
                />
                <span className="raise-custom-value">{customRaiseTo}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="quick-chip quick-chip-other quick-chip-toggle"
            onClick={() => setRaiseMode((m) => (m === "quick" ? "custom" : "quick"))}
          >
            {raiseMode === "quick" ? "other" : "快捷"}
          </button>
          <button
            className="action-btn action-btn-raise action-btn-raise-main"
            disabled={
              raiseMode === "custom"
                ? !canRaiseOrBet
                : !(selectedQuick && !selectedQuick.disabled && (canRaiseOrBet || (selectedQuick.key === "max" && can("allin"))))
            }
            onClick={onRaiseByCurrentMode}
            title={getHint("当前不可下注/加注（可能筹码不足或规则限制）")}
          >
            {quickAllInMode
              ? `ALL-IN ${myStack}`
              : `加注 ${raiseMode === "custom" ? customRaiseTo : (selectedQuick ? selectedQuick.amount : 0)}`}
          </button>
        </div>
      </div>
      <div className="action-right">
        <div className="stack-pill" aria-label="当前剩余筹码">筹码 {myStack}</div>
      </div>
    </section>
  );
}
