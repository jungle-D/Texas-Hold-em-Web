import { useEffect, useState } from "react";
import type { TableSnapshot, TurnStartedPayload } from "@holdem/shared";
import { Lobby } from "./pages/Lobby";
import { Table } from "./pages/Table";
import { socket } from "./socket";

type ViewState =
  | { kind: "lobby" }
  | { kind: "table"; roomCode: string; me: string; hostPlayerId: string; reconnectToken: string };

export function App(): JSX.Element {
  const [view, setView] = useState<ViewState>({ kind: "lobby" });
  const [snapshot, setSnapshot] = useState<TableSnapshot | null>(null);
  const [turnInfo, setTurnInfo] = useState<TurnStartedPayload | null>(null);
  const [myCards, setMyCards] = useState<string[]>([]);
  const [lastActionText, setLastActionText] = useState("");
  const [eventBanner, setEventBanner] = useState("");
  const [spectatorHands, setSpectatorHands] = useState<Array<{ seatIndex: number; nickname: string; cards: string[] }>>([]);
  const [lastAppliedAction, setLastAppliedAction] = useState<{ seatIndex: number; action: string; amount: number } | null>(null);

  useEffect(() => {
    socket.on("room.snapshot", (room) => {
      setView({
        kind: "table",
        roomCode: room.roomCode,
        me: room.yourPlayerId,
        hostPlayerId: room.hostPlayerId,
        reconnectToken: room.reconnectToken
      });
      localStorage.setItem("holdemReconnectToken", room.reconnectToken);
    });
    socket.on("table.snapshot", setSnapshot);
    socket.on("player.hand", ({ cards }) => setMyCards(cards));
    socket.on("turn.started", setTurnInfo);
    socket.on("turn.started", (t) => {
      if (t.seatIndex >= 0) setEventBanner(`轮到 Seat ${t.seatIndex + 1} 操作`);
    });
    socket.on("action.applied", (a) => {
      setLastActionText(`Seat ${a.seatIndex + 1}: ${a.action}${a.amount > 0 ? ` ${a.amount}` : ""}`);
      setEventBanner(`Seat ${a.seatIndex + 1} 执行 ${a.action}${a.amount > 0 ? ` ${a.amount}` : ""}`);
      setLastAppliedAction({ seatIndex: a.seatIndex, action: a.action, amount: a.amount });
    });
    socket.on("table.hands", ({ hands }) => {
      setSpectatorHands(hands.map((h) => ({ seatIndex: h.seatIndex, nickname: h.nickname, cards: h.cards })));
    });
    socket.on("board.updated", ({ phase }) => {
      if (phase !== "preflop" && phase !== "settlement") setEventBanner(`发公共牌：${phase.toUpperCase()}`);
    });
    socket.on("hand.ended", () => setEventBanner("本局结束：自动亮牌展示 30 秒，随后自动开始下一局"));
    socket.on("room.kicked", ({ message }) => {
      // eslint-disable-next-line no-alert
      alert(message);
      setTurnInfo(null);
      setSnapshot(null);
      setMyCards([]);
      setLastActionText("");
      setEventBanner("");
      setSpectatorHands([]);
      setLastAppliedAction(null);
      setView({ kind: "lobby" });
    });
    socket.on("error.invalidAction", (err) => {
      // eslint-disable-next-line no-alert
      alert(`${err.code}: ${err.message}`);
    });
    return () => {
      socket.off("room.snapshot");
      socket.off("table.snapshot");
      socket.off("turn.started");
      socket.off("player.hand");
      socket.off("action.applied");
      socket.off("table.hands");
      socket.off("board.updated");
      socket.off("hand.ended");
      socket.off("room.kicked");
      socket.off("error.invalidAction");
    };
  }, []);

  if (view.kind === "lobby") {
    return (
      <Lobby
        onCreate={(roomName, nickname) => socket.emit("room.create", { roomName, nickname })}
        onJoin={(roomCode, nickname) =>
          socket.emit("room.join", {
            roomCode,
            nickname,
            reconnectToken: localStorage.getItem("holdemReconnectToken") ?? undefined
          })
        }
      />
    );
  }

  if (!snapshot) return <main className="screen lobby">连接中...</main>;

  return (
    <Table
      me={view.me}
      snapshot={snapshot}
      turnInfo={turnInfo}
      myCards={myCards}
      lastActionText={lastActionText}
      eventBanner={eventBanner}
      lastAppliedAction={lastAppliedAction}
      spectatorHands={spectatorHands}
      hostPlayerId={view.hostPlayerId}
      onTakeSeat={(seatIndex) => socket.emit("seat.take", { seatIndex })}
      onReady={(ready) => socket.emit("hand.ready", { ready })}
      onStartHand={() => socket.emit("hand.start")}
      onLeaveRoom={() => {
        socket.emit("room.leave");
        setTurnInfo(null);
        setSnapshot(null);
        setMyCards([]);
        setLastActionText("");
        setEventBanner("");
        setSpectatorHands([]);
        setLastAppliedAction(null);
        setView({ kind: "lobby" });
      }}
      onFold={() => socket.emit("action.fold")}
      onCheck={() => socket.emit("action.check")}
      onCall={() => socket.emit("action.call")}
      onBet={(amount) => socket.emit("action.bet", { amount })}
      onRaise={(amount) => socket.emit("action.raise", { amount })}
      onAllIn={() => socket.emit("action.allin")}
      onKickPlayer={(targetPlayerId) => socket.emit("room.kick", { targetPlayerId })}
    />
  );
}
