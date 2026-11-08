import { Router } from 'express';
import { smartSpectraService } from '../services/smartspectra.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MindCalm Workspace Telemetry Server',
    sdkEngine: 'Presage SmartSpectra v3.4',
    mode: smartSpectraService.currentVitals.sdkMode,
    timestamp: new Date().toISOString(),
  });
});

// Explicit Camera Consent Endpoint (Presage Contest Requirement)
router.post('/api/consent', (req, res) => {
  const { granted } = req.body;
  if (typeof granted !== 'boolean') {
    return res.status(400).json({ error: 'Field "granted" must be a boolean.' });
  }

  const result = smartSpectraService.setConsent(granted);
  res.json({
    consentGranted: result,
    message: result
      ? 'Camera consent recorded. Processing is 100% on-device and ephemeral.'
      : 'Camera consent revoked. Sessions halted.',
  });
});

// Current Vitals Snapshot
router.get('/api/vitals/current', (req, res) => {
  res.json(smartSpectraService.getCurrentVitals());
});

// Waveform History Buffer
router.get('/api/vitals/history', (req, res) => {
  res.json({
    samples: smartSpectraService.getWaveformHistory(),
    totalSamples: smartSpectraService.waveformBuffer.length,
  });
});

// Session Lifecycle Controls
router.post('/api/session/start', (req, res) => {
  try {
    smartSpectraService.startSession();
    res.json({ status: 'started', vitals: smartSpectraService.getCurrentVitals() });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

router.post('/api/session/stop', (req, res) => {
  smartSpectraService.stopSession();
  res.json({ status: 'stopped', vitals: smartSpectraService.getCurrentVitals() });
});

router.post('/api/session/reset', (req, res) => {
  smartSpectraService.resetSession();
  res.json({ status: 'reset', vitals: smartSpectraService.getCurrentVitals() });
});

router.get('/api/session/status', (req, res) => {
  res.json({
    isActive: smartSpectraService.isActive,
    hasConsent: smartSpectraService.hasConsent,
    mode: smartSpectraService.currentVitals.sdkMode,
  });
});

export default router;
