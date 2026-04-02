import type { PlayerActionType } from "@holdem/shared";

interface ActionBarProps {
  canAct: boolean;
  toCall: number;
  minRaiseTo: number;
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
  toCall,
  minRaiseTo,
  availableActions,
  disabledReason,
  quickAmounts,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onAllIn
}: ActionBarProps): JSX.Element {
  const can = (action: PlayerActionType) => canAct && availableActions.includes(action);
  const getHint = (ok: boolean, fallback: string) => (ok ? "" : (disabledReason ?? fallback));
  return (
    <section className={`action-bar ${canAct ? "active-turn" : ""}`}>
      <button disabled={!can("fold")} onClick={onFold} title={getHint(can("fold"), "当前不可弃牌")}>
        弃牌
      </button>
      <button disabled={!can("check")} onClick={onCheck} title={getHint(can("check"), "需先跟注，当前不能过牌")}>
        过牌
      </button>
      <button disabled={!can("call")} onClick={onCall} title={getHint(can("call"), "当前无需跟注或筹码不足")}>
        跟注 {toCall}
      </button>
      <button
        disabled={!(can("raise") || can("bet"))}
        onClick={() => onRaise(minRaiseTo)}
        title={getHint(can("raise") || can("bet"), "当前不可下注/加注（可能筹码不足或规则限制）")}
      >
        加注到 {minRaiseTo}
      </button>
      <button disabled={!can("allin")} onClick={onAllIn} title={getHint(can("allin"), "当前不可ALL-IN")}>
        ALL-IN
      </button>
      <div className="quick-bets">
        {quickAmounts.map((q) => (
          <button
            key={q.key}
            disabled={!(can("raise") || can("bet")) || q.disabled}
            onClick={() => onRaise(q.amount)}
            title={
              q.disabled
                ? "该快捷额度当前不合法（低于最小加注或超过可用筹码）"
                : getHint(can("raise") || can("bet"), "当前不可使用快捷下注")
            }
          >
            {q.label}
          </button>
        ))}
      </div>
    </section>
  );
}
