# LAN Texas Hold'em Web (6人桌)

办公室局域网德州扑克 Web 版，架构为 `React + Node.js + WebSocket(Socket.IO)`，由服务端作为权威裁判。

## 功能范围（MVP）

- 最多 6 人同桌
- 建房/入房/入座/准备开局
- Preflop/Flop/Turn/River 行动轮转
- `fold/check/call/bet/raise/allin` 动作校验
- 主池/边池结算（简化牌力评估）
- 断线重连 token（客户端本地保存）

## 项目结构

- `frontend/`: React 客户端（大厅 + 牌桌）
- `server/`: Node 服务端（房间、状态机、规则、结算、事件）
- `shared/`: 前后端共享协议与错误码

## 本地开发

1. 安装依赖
   - `npm install`
2. 启动服务端（局域网监听）
   - `npm run dev:server`
3. 启动前端（局域网监听）
   - `npm run dev:frontend`
4. 访问
   - 前端：`http://<内网IP>:5173`
   - 服务端：`http://<内网IP>:3001`

如果前端和服务端不在同一地址，设置前端环境变量：

- `VITE_SERVER_URL=http://<服务端内网IP>:3001`

## Docker（局域网部署）

- `docker compose up --build`
- 前端：`http://<内网IP>:5173`
- 服务端：`http://<内网IP>:3001`

## 协议要点

- 客户端只发送意图事件，例如 `action.call`。
- 服务端校验后广播快照/增量事件，例如 `table.snapshot`、`action.applied`。
- 私有信息（手牌）仅应定向下发本人（当前版本仍以公共快照为主，后续可细化）。

## 后续建议

- 引入完整牌型评估器（替换当前简化评分）
- 增加行动超时自动 check/fold
- 增加 Redis 做多实例会话恢复
