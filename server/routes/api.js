import { Router } from "express";
import {
  getSessionService,
  smartSpectraService,
} from "../services/smartspectra.js";

const router = Router();

function resolveSession(req) {
  const sessionId =
    req.headers["x-session-id"] || req.query.sessionId || "default";
  return getSessionService(String(sessionId));
}

// Health check endpoint
router.get("/health", async (req, res) => {
  await smartSpectraService.ensureReady();
  res.json({
    status: "healthy",
    service: "MindCalm Workspace Telemetry Server",
    sdkEngine: "Presage SmartSpectra v3.4",
    mode: smartSpectraService.currentVitals.sdkMode,
    timestamp: new Date().toISOString(),
  });
});

// Explicit Camera Consent Endpoint (Presage Contest Requirement)
router.get("/api/consent", async (req, res) => {
  const svc = await resolveSession(req).ensureReady();
  res.json({
    consent_granted: svc.hasConsent,
    consentGranted: svc.hasConsent,
    mode: svc.currentVitals.sdkMode,
    sdkMode: svc.currentVitals.sdkMode,
  });
});

router.post("/api/consent", async (req, res) => {
  const { granted } = req.body;
  if (typeof granted !== "boolean") {
    return res
      .status(400)
      .json({ error: 'Field "granted" must be a boolean.' });
  }

  const svc = await resolveSession(req).ensureReady();
  const result = svc.setConsent(granted);
  res.json({
    consent_granted: result,
    consentGranted: result,
    mode: svc.currentVitals.sdkMode,
    sdkMode: svc.currentVitals.sdkMode,
    message: result
      ? "Camera consent recorded. Processing is 100% on-device and ephemeral."
      : "Camera consent revoked. Sessions halted.",
  });
});

// Current Vitals Snapshot
router.get("/api/vitals/current", async (req, res) => {
  const svc = await resolveSession(req).ensureReady();
  res.json(svc.getCurrentVitals());
});

// Waveform History Buffer
router.get("/api/vitals/history", (req, res) => {
  const svc = resolveSession(req);
  res.json({
    samples: svc.getWaveformHistory(),
    totalSamples: svc.waveformBuffer.length,
    maxSamples: svc.maxWaveformPoints,
  });
});

// Session Lifecycle Controls
router.post("/api/session/start", async (req, res) => {
  const svc = await resolveSession(req).ensureReady();
  try {
    svc.startSession();
    res.json({
      status: "started",
      mode: svc.currentVitals.sdkMode,
      vitals: svc.getCurrentVitals(),
    });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

router.post("/api/session/stop", (req, res) => {
  const svc = resolveSession(req);
  svc.stopSession();
  res.json({
    status: "stopped",
    vitals: svc.getCurrentVitals(),
  });
});

router.post("/api/session/reset", (req, res) => {
  const svc = resolveSession(req);
  svc.resetSession();
  res.json({ status: "reset", vitals: svc.getCurrentVitals() });
});

router.get("/api/session/status", async (req, res) => {
  const svc = await resolveSession(req).ensureReady();
  res.json({
    isActive: svc.isActive,
    hasConsent: svc.hasConsent,
    mode: svc.currentVitals.sdkMode,
    sdkMode: svc.currentVitals.sdkMode,
  });
});

export default router;
