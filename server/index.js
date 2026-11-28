import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import apiRouter from "./routes/api.js";
import {
  getSessionService,
  removeSessionService,
  smartSpectraService,
} from "./services/smartspectra.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mount API routes
app.use(apiRouter);

// Serve static frontend assets if built
const clientDistPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientDistPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
    if (err) {
      next();
    }
  });
});

// HTTP Server
const server = http.createServer(app);

// WebSocket Server for High-Speed 30Hz Waveform & Frame Streaming
const wss = new WebSocketServer({ server, path: "/ws/vitals" });

// Per-client isolated telemetry & optional native frame ingestion
wss.on("connection", async (ws, req) => {
  let sessionId = "default";
  try {
    const reqUrl = new URL(req.url || "/ws/vitals", "http://localhost");
    sessionId = reqUrl.searchParams.get("sessionId") || "default";
  } catch {
    sessionId = "default";
  }

  const sessionService = await getSessionService(sessionId).ensureReady();

  // Send initial session & SDK mode state
  ws.send(
    JSON.stringify({
      type: "session_state",
      session_id: sessionId,
      is_running: sessionService.isActive,
      consent_granted: sessionService.hasConsent,
      sdk_mode: sessionService.currentVitals.sdkMode,
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

  const validationHandler = (validation) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          type: "validation_status",
          data: validation,
        }),
      );
    }
  };

  sessionService.on("telemetry", telemetryHandler);
  sessionService.on("validation", validationHandler);

  // Optional raw RGB frame ingestion for native SDK custom input mode
  ws.on("message", (raw) => {
    try {
      if (typeof raw === "string" || raw instanceof Buffer) {
        const msg = JSON.parse(raw.toString());
        if (
          msg.type === "video_frame" &&
          msg.rgbBase64 &&
          msg.width &&
          msg.height
        ) {
          const buf = Buffer.from(msg.rgbBase64, "base64");
          const tsUs = Number(msg.timestampUs) || Date.now() * 1000;
          sessionService.pushFrame(buf, msg.width, msg.height, tsUs);
        }
      }
    } catch {
      // Ignore malformed client payloads
    }
  });

  ws.on("close", () => {
    sessionService.off("telemetry", telemetryHandler);
    sessionService.off("validation", validationHandler);
    if (sessionId !== "default") {
      removeSessionService(sessionId);
    }
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
