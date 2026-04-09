# Texas Hold'em Web 项目地图（持续维护）

本文件用于快速理解当前代码结构，并作为后续改动记录的统一入口。
内容仅基于仓库现有代码与文档，不做额外假设。

## 1. 仓库与技术栈

- Monorepo：npm workspaces
  - `frontend`：React + Vite + Socket.IO Client
  - `server`：Node.js + Socket.IO + TypeScript
  - `shared`：前后端共享协议与错误码
- 根脚本（`package.json`）
  - `npm run dev:server`
  - `npm run dev:frontend`
  - `npm run build`（按 `shared -> server -> frontend` 顺序）

## 2. 目录职责地图

### 2.1 frontend

- `frontend/src/main.tsx`
  - React 入口，`createRoot` 挂载 `App`
- `frontend/src/App.tsx`
  - 页面主状态（Lobby / Table）切换
  - 全局 Socket 事件绑定与清理
- `frontend/src/socket.ts`
  - Socket.IO 客户端连接
  - 默认连接 `${window.location.protocol}//${window.location.hostname}:3001`
  - 支持 `VITE_SERVER_URL`
- `frontend/src/pages/Lobby.tsx`
  - 建房 / 入房输入与触发
- `frontend/src/pages/Table.tsx`
  - 牌桌主 UI：座位环、公共牌区、底池、动作条、历史
  - 局间亮牌倒计时展示
  - 房主踢人确认弹窗
- `frontend/src/components/table/Seat.tsx`
  - 单座位展示与交互
- `frontend/src/components/table/ActionBar.tsx`
  - 动作按钮与加注快捷逻辑

### 2.2 server

- `server/src/index.ts`
  - HTTP Server + Socket.IO Server 初始化
  - 注册连接事件并绑定业务事件
- `server/src/ws/events.ts`
  - 核心实时协议处理：
    - 房间：`room.create/join/leave/kick`
    - 座位：`seat.take`
    - 对局：`hand.ready/start/reveal`
    - 动作：`action.fold/check/call/bet/raise/allin`
  - 广播快照与增量事件
  - 局间自动亮牌与自动下一局定时器
- `server/src/room/RoomManager.ts`
  - 房间与玩家生命周期管理
  - 重连 token 映射
  - `table.snapshot` 数据组装
- `server/src/game/TableStateMachine.ts`
  - 德州状态推进核心：发牌、行动轮转、街道推进、结算触发
- `server/src/game/PokerRuleEngine.ts`
  - 动作合法性与简化牌力评估
- `server/src/game/PotSettlement.ts`
  - 主池/边池分配
- `server/src/config.ts`
  - 服务端环境变量解析（含观战底牌开关）

### 2.3 shared

- `shared/src/protocol.ts`
  - 双向 Socket 事件类型定义
  - `TableSnapshot` / `TurnStartedPayload` / `HandEndedPayload` 等共享类型
- `shared/src/errors.ts`
  - 统一错误码与 `ActionError`
- `shared/src/index.ts`
  - 对外导出入口

## 3. 关键事件流（改动高频区）

### 3.1 入房与初始化

1. 前端发送 `room.create` 或 `room.join`
2. 服务端设置 `socket.data.roomCode/playerId`
3. 服务端回 `room.snapshot` 并触发 `emitRoomSnapshots`
4. 客户端切到 `Table` 页面并显示快照

### 3.2 玩家动作

1. 前端发送 `action.*`（仅表达意图）
2. 服务端 `TableStateMachine.applyAction` 校验并执行
3. 服务端广播 `action.applied`、`board.updated`、`table.snapshot`
4. 若局结束，广播 `hand.ended` 并进入局间流程

### 3.3 局间亮牌与自动下一局

1. 结算后默认进入 30 秒亮牌窗口
2. `table.snapshot` 携带 `interHandRevealUntil` 与 `revealedHands`
3. 倒计时结束后服务端自动尝试 `startHand`
4. 若条件不足，重置到 waiting 并写入历史

## 4. 配置与运行要点

- 服务端环境变量（见 `README.md`）
  - `PORT`（默认 `3001`）
  - `SPECTATOR_SEE_ALL_HOLES`（默认关闭）
- 前端环境变量
  - `VITE_SERVER_URL`（跨地址部署时设置）
- 本地开发
  - `npm install`
  - `npm run dev:server`
  - `npm run dev:frontend`

## 5. 高影响改动清单（改前先看）

- 协议字段/事件名变更：
  - 同步修改 `shared/src/protocol.ts`、`server/src/ws/events.ts`、`frontend/src/App.tsx` / 页面消费处
- 对局规则变更：
  - 优先改 `server/src/game/TableStateMachine.ts` 与 `PokerRuleEngine.ts`
  - 回归关注：行动合法性、toCall/minRaise、全下路径、结算路径
- 房间或玩家生命周期改动：
  - 重点检查 `RoomManager` 与 `events.ts` 中 `socket.data` 读写一致性
- 观战可见性改动：
  - 重点检查 `events.ts` 的 `table.hands` 下发条件与 `README.md` 说明同步

## 6. 文件级改动记录（持续追加）

使用规则：

- 每次提交或每个小任务完成后追加一条记录
- 仅记录“为什么改 + 改了什么 + 影响面 + 验证方式”
- 不写与当前仓库无关的外部信息

记录模板：

```md
### [YYYY-MM-DD] <改动标题>
- 背景/目的：
- 变更文件：
  - `path/to/file`
  - `path/to/file`
- 核心变更：
  - 
- 影响范围：
  - 
- 验证：
  - [ ] 本地运行
  - [ ] 关键流程手测
  - [ ] 相关构建/测试命令
- 备注：
```

---

### [2026-04-09] 初始化项目地图
- 背景/目的：
  - 建立统一的项目结构索引，降低后续改动的理解成本。
- 变更文件：
  - `docs/project-map.md`
- 核心变更：
  - 梳理 monorepo 三包职责、关键事件流、配置项与高影响改动清单。
  - 增加可复用的“文件级改动记录”模板。
- 影响范围：
  - 文档层，无运行时行为变化。
- 验证：
  - [x] 基于现有代码路径与 README 逐项核对
  - [x] 与 `docs/optimization-tasks.md` 当前状态保持兼容
- 备注：
  - 后续建议在每次功能或协议改动后同步更新本文件。
