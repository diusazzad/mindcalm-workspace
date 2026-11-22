import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import apiRouter from "./routes/api.js";
import { smartSpectraService } from "./services/smartspectra.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mount API routes
app.use(apiRouter);

// HTTP Server
const server = http.createServer(app);

// WebSocket Server for High-Speed 30Hz Waveform Streaming
const wss = new WebSocketServer({ server, path: "/ws/vitals" });

// Broadcast telemetry to connected dashboard clients
wss.on("connection", (ws) => {
  // Send initial session state
  ws.send(
    JSON.stringify({
      type: "session_state",
      is_running: smartSpectraService.isActive,
      consent_granted: smartSpectraService.hasConsent,
    }),
  );

  const telemetryHandler = (data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          type: "vitals",
          data,
        }),
      );
    }
  };

  smartSpectraService.on("telemetry", telemetryHandler);

  ws.on("close", () => {
    smartSpectraService.off("telemetry", telemetryHandler);
  });
});

if (
  process.env.NODE_ENV !== "test" &&
  !process.env.npm_lifecycle_event?.includes("test")
) {
  server.listen(PORT, () => {
    console.log(
      `[MindCalm Workspace] Server listening on http://localhost:${PORT}`,
    );
    console.log(
      `[MindCalm Workspace] Live WebSocket available at ws://localhost:${PORT}/ws/vitals`,
    );
  });
}

export { app, server, smartSpectraService };
