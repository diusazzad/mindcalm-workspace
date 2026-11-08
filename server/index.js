import http from "node:http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import apiRouter from "./routes/api.js";
import { smartSpectraService } from "./services/smartspectra.js";

dotenv.config();

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

wss.on("connection", (ws) => {
  // Send current baseline state immediately on connection
  ws.send(
    JSON.stringify({
      type: "initial_state",
      data: smartSpectraService.getCurrentVitals(),
    }),
  );

  const telemetryListener = (payload) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          type: "telemetry_tick",
          data: payload,
        }),
      );
    }
  };

  smartSpectraService.on("telemetry", telemetryListener);

  ws.on("close", () => {
    smartSpectraService.off("telemetry", telemetryListener);
  });
});

const isTestEnv =
  process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test";

if (!isTestEnv) {
  server.listen(PORT, () => {
    console.log(
      `[MindCalm Workspace] Server listening on http://localhost:${PORT}`,
    );
    console.log(
      `[MindCalm Workspace] Live WebSocket available at ws://localhost:${PORT}/ws/vitals`,
    );
  });
}

export { app, server };
