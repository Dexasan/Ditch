import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  // Phase 1 events (to be implemented):
  //
  // Viewer → Server
  //   join-channel          viewer enters a creator's DITCH channel
  //   leave-channel
  //   chat-message          message sent from DITCH chat
  //   participant-request   viewer requests to appear on stream
  //
  // Server → Creator
  //   participant-queue     updated list of waiting participants
  //   chat-ingest           aggregated message from an external platform
  //
  // Creator → Server
  //   participant-approve   creator approves a participant slot
  //   participant-remove    creator removes a live participant
  //
  // Server → All (broadcast)
  //   stream-update         session status / participant slots changed

  socket.on("disconnect", () => {
    console.log("client disconnected:", socket.id);
  });
});

const PORT = Number(process.env.REALTIME_PORT) || 3002;
httpServer.listen(PORT, () => {
  console.log(`realtime server listening on :${PORT}`);
});
