# LAN Texas Hold'em Web (6人桌)

办公室局域网德州扑克 Web 版，架构为 `React + Node.js + WebSocket(Socket.IO)`，由服务端作为权威裁判。

## 功能范围（MVP）

- 最多 6 人同桌
- 建房/入房/入座/准备开局
- Preflop/Flop/Turn/River 行动轮转
- `fold/check/call/bet/raise/allin` 动作校验
- 主池/边池结算（简化牌力评估）
- 断线重连 token（客户端本地保存）

## 部署场景与限制（MVP）

- **典型场景**：同一办公室局域网内访问；未实现登录鉴权，任意知道房间码的用户可加入。
- **规则与牌力**：当前为演示级 MVP，牌型评估与部分边界规则为简化实现，**不宜作为公平竞技或真金依据**。
- **公网**：现在支持通过 `cloudflared tunnel` 做公网访问转发（见下文），但本项目本身仍未内建登录鉴权。若对外开放，请额外配置访问控制、TLS、限流与审计。

更细的优化任务与验收项见 [`docs/optimization-tasks.md`](docs/optimization-tasks.md)。

## 项目结构

- `frontend/`: React 客户端（大厅 + 牌桌）
- `server/`: Node 服务端（房间、状态机、规则、结算、事件）
- `shared/`: 前后端共享协议与错误码

## 环境变量（服务端）

在启动 `server` 前可设置：

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `3001` | HTTP / WebSocket 监听端口。 |
| `SPECTATOR_SEE_ALL_HOLES` | 未设置视为关闭 | 设为 `true` 或 `1` 时，观战席会收到 `table.hands` 中的**全员底牌**（旧版行为，便于局域网演示）。**默认关闭**，避免观战者获得不公平信息；仅在信任环境、全员知情时开启。 |

Docker 部署时可在 `docker-compose` 或运行环境中注入上述变量。

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

## 公网访问（cloudflared）

如果希望临时开放公网访问，推荐本地运行 `cloudflared` 将前端端口映射为 HTTPS 公网地址（无需直接暴露本机端口）。

1. 本地正常启动
   - `npm run dev:server`
   - `npm run dev:frontend`
2. 安装并登录 cloudflared（首次需要）
   - [cloudflared 安装文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
   - `cloudflared tunnel login`
3. 直接创建临时公网地址（快速方式）
   - `cloudflared tunnel --url http://localhost:5173`
4. 让前端连接到同一台机器的服务端
   - 默认前端会连接 `http://<当前域名>:3001`。公网场景下请在前端启动前设置：
   - `VITE_SERVER_URL=https://<你的服务端公网地址>`
5. （可选）同时给服务端也开一个 tunnel
   - `cloudflared tunnel --url http://localhost:3001`

> 注意：tunnel 仅负责转发，不提供应用级鉴权。开放公网前请确认访问策略与风险可控。

## 协议要点

- 客户端只发送意图事件，例如 `action.call`。
- 服务端校验后广播快照与增量事件，例如 `table.snapshot`、`action.applied`；底池与公共牌以 `table.snapshot` 为准。
- 私有信息（手牌）定向下发本人（`player.hand`）；观战默认不接收他人底牌，除非开启 `SPECTATOR_SEE_ALL_HOLES`。

## 手动测试提示（踢人多连接）

同一玩家用两个浏览器标签连入同一房间后，房主对其「请出」：两个标签均应收到 `room.kicked` 并回到大厅（见 `docs/optimization-tasks.md` P0）。

## 后续建议

- 引入完整牌型评估器（替换当前简化评分）
- 增加行动超时自动 check/fold
- 增加 Redis 做多实例会话恢复
