/**
 * 观战席是否接收 `table.hands` 中的全员底牌。默认关闭，避免同一房间内观战者获得不公平信息。
 * 设为 `true` 或 `1` 时恢复旧行为。
 */
export const spectatorSeeAllHoles =
  process.env.SPECTATOR_SEE_ALL_HOLES === "true" || process.env.SPECTATOR_SEE_ALL_HOLES === "1";
