import { useState } from "react";

interface LobbyProps {
  onCreate: (roomName: string, nickname: string) => void;
  onJoin: (roomCode: string, nickname: string) => void;
}

export function Lobby({ onCreate, onJoin }: LobbyProps): JSX.Element {
  const [nickname, setNickname] = useState("");
  const [roomName, setRoomName] = useState("Office Table");
  const [roomCode, setRoomCode] = useState("");

  return (
    <main className="screen lobby">
      <section className="panel">
        <h1>LAN Hold'em Club</h1>
        <p>办公室局域网快速开局，最多 6 人同桌。</p>
        <div className="field">
          <label>昵称</label>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="输入昵称" />
        </div>
        <div className="row">
          <div className="field">
            <label>新房间名称</label>
            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} />
          </div>
          <button onClick={() => onCreate(roomName, nickname)} disabled={!nickname}>
            创建房间
          </button>
        </div>
        <div className="row">
          <div className="field">
            <label>房间码</label>
            <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="6位房间码" />
          </div>
          <button onClick={() => onJoin(roomCode, nickname)} disabled={!nickname || !roomCode}>
            加入房间
          </button>
        </div>
      </section>
    </main>
  );
}
