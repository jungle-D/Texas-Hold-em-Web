import { createServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@holdem/shared";
import { RoomManager } from "./room/RoomManager.js";
import { registerGameEvents } from "./ws/events.js";

const port = Number(process.env.PORT ?? 3001);
const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" }
});

const roomManager = new RoomManager();

io.on("connection", (socket) => {
  registerGameEvents(io, socket, roomManager);
});

httpServer.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`LAN Hold'em server listening on http://0.0.0.0:${port}`);
});
