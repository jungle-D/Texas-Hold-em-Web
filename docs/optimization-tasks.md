# 德州 Web 优化任务清单

本文档将 Code Review 中的建议拆成**可独立完成、可勾选**的小任务，便于按顺序推进；若中途断网或换会话，只需打开本文件，从未勾选的最高优先级项继续即可。

**使用方式**

- 每完成一项，将 `- [ ]` 改为 `- [x]`，并在「备注」行简要记录合并日期或 PR 编号（可选）。
- 同一优先级内建议按编号顺序做，避免依赖错乱。
- 涉及协议（`shared/`）的改动需同时编译 `shared` 与依赖它的 `server` / `frontend`。

---

## P0 — 正确性 / 安全（应先完成）

| ID | 任务 | 涉及文件（主要） | 验收标准 |
|----|------|------------------|----------|
| **P0-1** | **踢人：处理同一 `playerId` 下全部 Socket** | `server/src/ws/events.ts`（`room.kick` 处理器） | 房主踢人时，遍历 `io.sockets.sockets`，对**所有** `client.data.playerId === targetPlayerId` 的连接执行：`leave(roomCode)`、`emit("room.kicked", …)`、清空 `client.data`；**删除**只处理第一个连接就 `break` 的逻辑。双开同一账号两标签，两标签均应收到踢出并回大厅。 |
| **P0-2** | （可选）踢人后单元/集成说明 | 本文件 + 或 `README.md` | 在备注中记录手动测试步骤即可；不要求自动化测试。 |

- [x] P0-1 踢人多连接
- [x] P0-2 文档或测试说明（可选）

**备注：**

- P0-1：已移除 `room.kick` 中首个匹配即 `break` 的逻辑。
  且新增服务端限制：`currentTurnSeat !== null`（回合进行中）时拒绝踢人。
- P0-2：`README.md`「手动测试提示（踢人多连接）」。

---

## P1 — 观战信息泄露与冗余事件

| ID | 任务 | 涉及文件（主要） | 验收标准 |
|----|------|------------------|----------|
| **P1-1** | **观战默认不看全员底牌** | `server/src/config.ts`（已存在 `spectatorSeeAllHoles`）、`server/src/ws/events.ts`（`emitRoomSnapshots`） | 当 `spectatorSeeAllHoles === false`（默认）且客户端为观战席时，不向该客户端下发真实底牌：可发 `table.hands: { hands: [] }`，或仅下发与 `TableSnapshot.revealedHands` 一致的公开信息。设为 `SPECTATOR_SEE_ALL_HOLES=true` 或 `1` 时与旧行为一致。 |
| **P1-2** | **环境变量写入 README / 部署说明** | `README.md`（或本文件「环境变量」一节） | 说明 `SPECTATOR_SEE_ALL_HOLES` 含义、默认值、局域网演示用途与风险。 |
| **P1-3** | **移除未消费的 `pot.updated` 广播** | `server/src/ws/events.ts`（`applyAction`）、视情况 `shared/src/protocol.ts` | 当前前端未监听 `pot.updated`；可删除服务端 `emit`，或保留协议类型仅作兼容。删除后牌桌仍依赖 `table.snapshot` 显示底池。 |
| **P1-4** | （进阶）合并 `action.applied` / `board.updated` 与快照 | `shared`、`server`、`frontend` | 在**不破坏**现有横幅/最后行动文案的前提下，减少重复事件（例如由 `table.snapshot` + 客户端派生，或扩展快照字段）。可延后单独 PR。 |

- [x] P1-1 观战 `table.hands` 默认关闭
- [x] P1-2 文档：环境变量
- [x] P1-3 移除或精简 `pot.updated`
- [ ] P1-4 事件合并（可选）

**备注：**

- P1-1：`emitRoomSnapshots` 中观战且 `!spectatorSeeAllHoles` 时下发 `table.hands: { hands: [] }`。
- P1-2：`README.md` 环境变量表与说明。
- P1-3：已删除 `applyAction` 内 `pot.updated` 广播；`shared` 协议中仍保留事件类型以便兼容外部客户端。
- P1-4：未做（可选）。

---

## P2 — 体验、可维护性与文档

| ID | 任务 | 涉及文件（主要） | 验收标准 |
|----|------|------------------|----------|
| **P2-1** | **房主踢人：`window.confirm` 换自定义 Modal** | `frontend/src/pages/Table.tsx`（或共用组件） | 与现有 UI 风格一致，可访问性不低于原生确认框。 |
| **P2-2** | **`emitTurnStarted` 与 `actionHistory` 体积** | `server/src/ws/events.ts` | 评估 `pushHistory` 在回合开始时的条目是否过长；必要时截断或抽样（与 `RoomManager` 中已有长度上限协调）。 |
| **P2-3** | **README：MVP 边界说明** | `README.md` | 写明：局域网场景、无鉴权、规则为 MVP、不宜直接公网暴露等（与项目实际行为一致，勿臆测）。 |
| **P2-4** | （可选）`TableStateMachine` 单元测试 | `server/src/game/`、`server` 测试配置 | 覆盖关键状态迁移或边池路径；无测试框架时可跳过并在本文件注明。 |

- [x] P2-1 踢人确认 Modal
- [x] P2-2 历史长度策略
- [x] P2-3 README MVP 说明
- [ ] P2-4 状态机测试（可选）

**备注：**

- P2-1：`Table.tsx` 内 `modal-backdrop` / `role="dialog"`，Esc 关闭；`styles.css` 样式。
- P2-2：`emitTurnStarted` 中昵称超过 18 字符截断并加 `…`，与全局 80 条上限并存。
- P2-3：`README.md`「部署场景与限制（MVP）」。
- P2-4：仓库未配置 server 侧自动化测试框架，跳过；若后续引入 Vitest/Jest 可从此项补测。

---

## 环境变量（随 P1-1 / P1-2 落实后保持同步）

| 变量 | 默认值 | 含义 |
|------|--------|------|
| `SPECTATOR_SEE_ALL_HOLES` | 未设置即视为 `false` | 为 `true`/`1` 时观战席可收到 `table.hands` 全员底牌（旧行为）；否则观战不泄露底牌。 |
| `PORT` | `3001` | HTTP/WebSocket 监听端口（已有代码）。 |

---

## 当前仓库进度快照（便于续写上下文）

> 以下由维护者随主分支更新；若与代码不一致，以代码为准。

| 项 | 状态 |
|----|------|
| `server/src/config.ts` 中 `spectatorSeeAllHoles` | 已定义 |
| `emitRoomSnapshots` 是否按 `spectatorSeeAllHoles` 过滤底牌 | **已完成** |
| `room.kick` 是否遍历所有匹配 socket | **已完成** |
| `pot.updated` 是否仍广播 | **已不再广播**（协议类型仍保留） |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-04-03 | 初版任务清单 |
| 2026-04-03 | 完成 P0、P1（除 P1-4）、P2（除 P2-4 可选测试） |
| 2026-04-03 | 补充：回合进行中禁止踢人；改进踢人弹窗焦点管理；统一历史昵称截断 |
