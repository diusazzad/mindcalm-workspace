/**
 * Presage SmartSpectra SDK Service & Real-Time Physiological Telemetry Engine.
 * Extracts pulse (PPG), respiration, HRV, and facial blink/talking metrics.
 *
 * Strict Compliance:
 * - 100% Ephemeral in-memory processing. Zero video/face persistence.
 * - SDK telemetry opt-out (`enableTelemetry: false`) enforced.
 * - Non-medical ergonomic & cognitive wellness classification only.
 */

import { EventEmitter } from "node:events";

export const CognitiveState = {
  CALM_FLOW: "CALM_FLOW",
  DEEP_FOCUS: "DEEP_FOCUS",
  COGNITIVE_STRAIN: "COGNITIVE_STRAIN",
};

// Native SmartSpectra C++ runtime state is process-global; track active owner
let activeNativeOwner = null;

export class SmartSpectraService extends EventEmitter {
  constructor(apiKey = process.env.SMARTSPECTRA_API_KEY, options = {}) {
    super();
    this.apiKey = apiKey;
    this.options = options;
    this.hasConsent = false;
    this.isActive = false;
    this.sdkInstance = null;
    this.sdkLoaded = false;
    this.nativeStreamingActive = false;
    this.simulationTimer = null;
    this._sdkHelpers = null;
    this._lastFrameTsUs = 0;
    this._lastBlinkDetected = false;
    this._blinkTimestampsMs = [];

    // Current physiological state (biological baselines)
    this.currentVitals = {
      pulseBpm: 72,
      pulseConfidence: 0,
      pulseStable: false,
      respirationRpm: 14.5,
      respirationConfidence: 0,
      respirationStable: false,
      hrvRmssdMs: 54.0,
      hrvConfidence: 0,
      hrvStable: false,
      blinkRatePerMin: 0,
      blinksTotal: 0,
      isTalking: false,
      apneaDetected: false,
      validationStatus: "READY",
      validationHint: "Awaiting session start",
      cognitiveState: CognitiveState.CALM_FLOW,
      strainIndex: 0.15, // 0.0 to 1.0 scale
      lastUpdated: new Date().toISOString(),
      sdkMode: "uninitialized",
    };

    // Rolling waveform buffer (120 samples matching UI 30Hz 4s window)
    this.waveformBuffer = [];
    this.maxWaveformPoints = 120;
    this.sampleIndex = 0;

    this.initPromise = this._tryInitSdk();
  }

  async ensureReady() {
    await this.initPromise;
    return this;
  }

  async _tryInitSdk() {
    const isTestEnv =
      (process.env.NODE_ENV === "test" ||
        process.env.npm_lifecycle_event?.includes("test")) &&
      process.env.SMARTSPECTRA_LIVE_TESTS !== "true";

    const isPlaceholderOrTest =
      !this.apiKey ||
      this.apiKey === "test_key" ||
      this.apiKey === "your_actual_key_here" ||
      this.options.forceSimulation ||
      isTestEnv;

    // Always try loading lightweight protobuf decoder for metric parsing/testing
    try {
      const msgs = await import("@smartspectra/node-sdk/messages");
      if (msgs?.decodeMetrics) {
        this._sdkHelpers = {
          ...(this._sdkHelpers || {}),
          decodeMetrics: msgs.decodeMetrics,
        };
      }
    } catch {
      // Optional in environments without @smartspectra/node-sdk/messages
    }

    if (isPlaceholderOrTest) {
      if (!this.apiKey) {
        console.warn(
          "[SmartSpectra] No API key detected in environment. Operating in simulation fallback mode.",
        );
      }
      this.sdkLoaded = false;
      this.currentVitals.sdkMode = "simulation_fallback";
      return;
    }

    try {
      const smartspectra = await import("@smartspectra/node-sdk");
      const {
        SmartSpectraSDK,
        breathingMetrics,
        cardioMetrics,
        faceMetrics,
        FrameTransform,
        PixelFormat,
        ValidationCode,
        CameraSelection,
        decodeMetrics,
      } = smartspectra;

      if (SmartSpectraSDK) {
        this._sdkHelpers = {
          FrameTransform,
          PixelFormat,
          ValidationCode,
          CameraSelection,
          decodeMetrics,
        };

        this.sdkInstance = new SmartSpectraSDK({
          apiKey: this.apiKey,
          enableTelemetry: false,
          requestedMetrics: [
            ...(breathingMetrics || []),
            ...(cardioMetrics || []),
            ...(faceMetrics || []),
          ],
        });

        this.sdkInstance.on("metrics", (buf, timestampUs) => {
          this._handleNativeSdkMetrics(buf, timestampUs);
        });

        this.sdkInstance.on("validationStatus", (code, timestampUs, hint) => {
          this._handleValidationStatus(code, timestampUs, hint);
        });

        this.sdkInstance.on("error", (code, message, retryable) => {
          this._handleSdkError(code, message, retryable);
        });

        this.sdkLoaded = true;
        this.currentVitals.sdkMode = "native_smartspectra_v3.4";
        console.log(
          "[SmartSpectra] Native Presage SmartSpectra v3.4 SDK successfully initialized (enableTelemetry: false).",
        );
      }
    } catch (err) {
      console.warn(
        `[SmartSpectra] Native FFI load skipped (${err.message}). Using deterministic physiological simulation fallback.`,
      );
      this.sdkLoaded = false;
      this.currentVitals.sdkMode = "simulation_fallback";
    }
  }

  setConsent(granted) {
    this.hasConsent = Boolean(granted);
    if (!this.hasConsent && this.isActive) {
      this.stopSession();
    }
    return this.hasConsent;
  }

  startSession(options = {}) {
    if (!this.hasConsent) {
      throw new Error(
        "Camera consent must be explicitly granted before starting a sensing session.",
      );
    }

    if (this.isActive) return;
    this.isActive = true;

    const nativeAvailableForSession =
      this.sdkLoaded &&
      this.sdkInstance &&
      !options.forceSimulation &&
      process.env.SMARTSPECTRA_FORCE_SIMULATION !== "true" &&
      (!activeNativeOwner || activeNativeOwner === this);

    if (nativeAvailableForSession) {
      try {
        const useNativeCamera =
          options.useNativeCamera ||
          process.env.SMARTSPECTRA_NATIVE_CAMERA === "true";

        if (useNativeCamera && this._sdkHelpers?.CameraSelection) {
          this.sdkInstance.useCamera(this._sdkHelpers.CameraSelection.default);
        } else if (this._sdkHelpers?.FrameTransform !== undefined) {
          this.sdkInstance.useCustomInput(
            this._sdkHelpers.FrameTransform.kNone,
          );
        } else {
          this.sdkInstance.useCustomInput();
        }

        this.sdkInstance.start();
        activeNativeOwner = this;
        this.nativeStreamingActive = true;
        this.currentVitals.sdkMode = "native_smartspectra_v3.4";
        this.currentVitals.validationStatus = "WARMING_UP";
        this.currentVitals.validationHint =
          "Warming up SmartSpectra pipeline (15–30s for stable pulse & breathing)";
        console.log(
          "[SmartSpectra] Native SDK telemetry session started (live frame pipeline).",
        );
        return;
      } catch (err) {
        console.warn(
          `[SmartSpectra] Native SDK start failed (${err.message}); falling back to simulation mode.`,
        );
        if (activeNativeOwner === this) activeNativeOwner = null;
        this.nativeStreamingActive = false;
      }
    }

    this._startSimulationLoop();
  }

  _startSimulationLoop() {
    if (this.simulationTimer) return;
    this.currentVitals.sdkMode = "simulation_fallback";
    this.currentVitals.validationStatus = "SIMULATED";
    this.currentVitals.validationHint =
      "Running deterministic simulation fallback (no live server SDK stream)";
    this.simulationTimer = setInterval(() => {
      this._generateTick();
    }, 33);
    console.log(
      "[SmartSpectra] Telemetry session started in simulation fallback mode.",
    );
  }

  pushFrame(rgbBuffer, width, height, timestampUs) {
    if (
      !this.isActive ||
      !this.hasConsent ||
      !this.nativeStreamingActive ||
      !this.sdkInstance ||
      !this._sdkHelpers?.PixelFormat
    ) {
      return false;
    }

    const monotonicTs =
      timestampUs > this._lastFrameTsUs
        ? timestampUs
        : this._lastFrameTsUs + 1000;
    this._lastFrameTsUs = monotonicTs;

    try {
      return this.sdkInstance.sendFrame(
        rgbBuffer,
        width,
        height,
        width * 3,
        this._sdkHelpers.PixelFormat.kRGB,
        monotonicTs,
      );
    } catch (err) {
      console.warn("[SmartSpectra] sendFrame warning:", err.message);
      return false;
    }
  }

  stopSession() {
    this.isActive = false;
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
    if (this.nativeStreamingActive && this.sdkInstance) {
      this.nativeStreamingActive = false;
      if (activeNativeOwner === this) activeNativeOwner = null;
      try {
        if (typeof this.sdkInstance.stopAsync === "function") {
          this.sdkInstance.stopAsync().catch((e) => {
            console.warn("[SmartSpectra] Async stop warning:", e.message);
          });
        } else {
          this.sdkInstance.stop();
        }
      } catch (err) {
        console.warn("[SmartSpectra] Stop warning:", err.message);
      }
    }
    console.log("[SmartSpectra] Telemetry session stopped.");
  }

  async destroy() {
    this.stopSession();
    if (this.sdkInstance) {
      try {
        if (typeof this.sdkInstance.stopAsync === "function") {
          await this.sdkInstance.stopAsync();
        }
        if (typeof this.sdkInstance.destroy === "function") {
          await this.sdkInstance.destroy();
        }
      } catch {
        // Ignore teardown errors
      }
      this.sdkInstance = null;
    }
  }

  resetSession() {
    this.stopSession();
    this.waveformBuffer = [];
    this._blinkTimestampsMs = [];
    this._lastBlinkDetected = false;
    this.currentVitals.blinksTotal = 0;
    this.currentVitals.blinkRatePerMin = 0;
    this.currentVitals.pulseBpm = 72;
    this.currentVitals.pulseConfidence = 0;
    this.currentVitals.pulseStable = false;
    this.currentVitals.respirationRpm = 14.5;
    this.currentVitals.respirationConfidence = 0;
    this.currentVitals.respirationStable = false;
    this.currentVitals.hrvRmssdMs = 54.0;
    this.currentVitals.hrvConfidence = 0;
    this.currentVitals.hrvStable = false;
    this.currentVitals.isTalking = false;
    this.currentVitals.apneaDetected = false;
    this.currentVitals.cognitiveState = CognitiveState.CALM_FLOW;
    this.currentVitals.strainIndex = 0.15;
    this.sampleIndex = 0;
  }

  getCurrentVitals() {
    return {
      ...this.currentVitals,
      hasConsent: this.hasConsent,
      isActive: this.isActive,
      lastUpdated: new Date().toISOString(),
    };
  }

  getWaveformHistory() {
    return this.waveformBuffer;
  }

  _classifyCognitiveState() {
    if (
      this.currentVitals.pulseBpm > 85 ||
      this.currentVitals.hrvRmssdMs < 36.0 ||
      this.currentVitals.apneaDetected
    ) {
      this.currentVitals.cognitiveState = CognitiveState.COGNITIVE_STRAIN;
      this.currentVitals.strainIndex = Math.min(
        1.0,
        this.currentVitals.strainIndex + 0.05,
      );
    } else if (this.currentVitals.pulseBpm >= 74) {
      this.currentVitals.cognitiveState = CognitiveState.DEEP_FOCUS;
      this.currentVitals.strainIndex = Math.max(
        0.2,
        this.currentVitals.strainIndex - 0.02,
      );
    } else {
      this.currentVitals.cognitiveState = CognitiveState.CALM_FLOW;
      this.currentVitals.strainIndex = Math.max(
        0.05,
        this.currentVitals.strainIndex - 0.04,
      );
    }
  }

  _generateTick() {
    this.sampleIndex++;
    const t = this.sampleIndex * 0.033; // seconds

    // 1. Simulated Cardiac PPG waveform model
    const hrFreq = (this.currentVitals.pulseBpm / 60.0) * 2 * Math.PI;
    const systolic = Math.sin(hrFreq * t);
    const dicrotic = 0.35 * Math.sin(2 * hrFreq * t + 0.6);
    const ppgWave = Math.max(-1, Math.min(1, systolic + dicrotic));

    // 2. Simulated Respiration curve
    const respFreq = (this.currentVitals.respirationRpm / 60.0) * 2 * Math.PI;
    const respWave = Math.sin(respFreq * t);

    // 3. Biological micro-fluctuations (simulation fallback only)
    if (this.sampleIndex % 30 === 0) {
      const jitterBpm = (Math.random() - 0.5) * 1.5;
      this.currentVitals.pulseBpm = Math.max(
        55,
        Math.min(
          115,
          Math.round((this.currentVitals.pulseBpm + jitterBpm) * 10) / 10,
        ),
      );
      this.currentVitals.pulseConfidence = 75;
      this.currentVitals.pulseStable = this.sampleIndex >= 90;

      const jitterHrv = (Math.random() - 0.5) * 2.0;
      this.currentVitals.hrvRmssdMs = Math.max(
        25,
        Math.min(
          85,
          Math.round((this.currentVitals.hrvRmssdMs + jitterHrv) * 10) / 10,
        ),
      );
      this.currentVitals.hrvConfidence = 70;
      this.currentVitals.hrvStable = this.sampleIndex >= 90;

      const jitterResp = (Math.random() - 0.5) * 0.4;
      this.currentVitals.respirationRpm = Math.max(
        9,
        Math.min(
          24,
          Math.round((this.currentVitals.respirationRpm + jitterResp) * 10) /
            10,
        ),
      );
      this.currentVitals.respirationConfidence = 75;
      this.currentVitals.respirationStable = this.sampleIndex >= 90;

      const nowMs = Date.now();
      if (Math.random() < 0.25) {
        this.currentVitals.blinksTotal += 1;
        this._blinkTimestampsMs.push(nowMs);
      }
      this._blinkTimestampsMs = this._blinkTimestampsMs.filter(
        (ts) => nowMs - ts <= 60000,
      );
      const elapsedSec = Math.max(15, this.sampleIndex * 0.033);
      this.currentVitals.blinkRatePerMin = Math.round(
        (this._blinkTimestampsMs.length / Math.min(60, elapsedSec)) * 60,
      );

      this._classifyCognitiveState();
    }

    const payload = {
      timestamp: Date.now(),
      sampleIndex: this.sampleIndex,
      ppgWave: Math.round(ppgWave * 1000) / 1000,
      respWave: Math.round(respWave * 1000) / 1000,
      vitals: this.getCurrentVitals(),
    };

    this.waveformBuffer.push({
      timestamp: payload.timestamp,
      ppg: payload.ppgWave,
      resp: payload.respWave,
    });
    if (this.waveformBuffer.length > this.maxWaveformPoints) {
      this.waveformBuffer.shift();
    }

    this.emit("telemetry", payload);
  }

  _handleValidationStatus(code, timestampUs, hint) {
    const label = code === 0 ? "OK" : `VALIDATION_${code}`;
    this.currentVitals.validationStatus = label;
    this.currentVitals.validationHint = hint || label;
    this.emit("validation", {
      code,
      timestampUs,
      hint: this.currentVitals.validationHint,
    });
  }

  _handleSdkError(code, message, retryable) {
    console.warn(
      `[SmartSpectra] SDK error (code=${code}, retryable=${retryable}): ${message}`,
    );
    this.emit("sdk_error", { code, message, retryable });

    if (this.isActive && !retryable) {
      this.nativeStreamingActive = false;
      if (activeNativeOwner === this) activeNativeOwner = null;
      this._startSimulationLoop();
    }
  }

  _handleNativeSdkMetrics(buf, timestampUs) {
    try {
      const metrics = this._sdkHelpers?.decodeMetrics
        ? this._sdkHelpers.decodeMetrics(buf)
        : null;

      if (!metrics || typeof metrics !== "object") {
        this.currentVitals.lastUpdated = new Date().toISOString();
        this.emit("raw_metrics", { buf, timestampUs });
        return;
      }

      this.sampleIndex++;
      let ppgWave = 0;
      let respWave = 0;

      // 1. Cardio (Pulse Rate, Confidence Gate >= 40, Arterial Pressure Trace, HRV RMSSD)
      const cardio = metrics.cardio;
      if (cardio) {
        if (Array.isArray(cardio.pulseRate) && cardio.pulseRate.length > 0) {
          const latestPulse = cardio.pulseRate[cardio.pulseRate.length - 1];
          const conf = Math.round(latestPulse.confidence ?? 0);
          this.currentVitals.pulseConfidence = conf;
          this.currentVitals.pulseStable = Boolean(
            latestPulse.stable || conf >= 40,
          );
          if (
            typeof latestPulse.value === "number" &&
            latestPulse.value > 30 &&
            (this.currentVitals.pulseStable || conf >= 25)
          ) {
            this.currentVitals.pulseBpm =
              Math.round(latestPulse.value * 10) / 10;
          }
        }

        if (
          Array.isArray(cardio.arterialPressureTrace) &&
          cardio.arterialPressureTrace.length > 0
        ) {
          const latestTrace =
            cardio.arterialPressureTrace[
              cardio.arterialPressureTrace.length - 1
            ];
          if (typeof latestTrace.value === "number") {
            ppgWave = Math.max(-1, Math.min(1, Math.tanh(latestTrace.value)));
          }
        }

        if (Array.isArray(cardio.hrv) && cardio.hrv.length > 0) {
          const latestHrv = cardio.hrv[cardio.hrv.length - 1];
          const hrvConf = Math.round(latestHrv.confidence ?? 0);
          this.currentVitals.hrvConfidence = hrvConf;
          this.currentVitals.hrvStable = Boolean(
            latestHrv.stable || hrvConf >= 50,
          );
          if (typeof latestHrv.rmssd === "number" && latestHrv.rmssd > 0) {
            this.currentVitals.hrvRmssdMs =
              Math.round(latestHrv.rmssd * 10) / 10;
          }
        }
      }

      // 2. Breathing (Rate, Confidence Gate >= 45, Upper Thoracic Trace, Apnea)
      const breathing = metrics.breathing;
      if (breathing) {
        if (Array.isArray(breathing.rate) && breathing.rate.length > 0) {
          const latestResp = breathing.rate[breathing.rate.length - 1];
          const rConf = Math.round(latestResp.confidence ?? 0);
          this.currentVitals.respirationConfidence = rConf;
          this.currentVitals.respirationStable = Boolean(
            latestResp.stable || rConf >= 45,
          );
          if (
            typeof latestResp.value === "number" &&
            latestResp.value > 4 &&
            (this.currentVitals.respirationStable || rConf >= 25)
          ) {
            this.currentVitals.respirationRpm =
              Math.round(latestResp.value * 10) / 10;
          }
        }

        if (
          Array.isArray(breathing.upperTrace) &&
          breathing.upperTrace.length > 0
        ) {
          const latestUpper =
            breathing.upperTrace[breathing.upperTrace.length - 1];
          if (typeof latestUpper.value === "number") {
            respWave = Math.max(-1, Math.min(1, Math.tanh(latestUpper.value)));
          }
        }

        if (Array.isArray(breathing.apnea) && breathing.apnea.length > 0) {
          const latestApnea = breathing.apnea[breathing.apnea.length - 1];
          this.currentVitals.apneaDetected = Boolean(latestApnea.detected);
        }
      }

      // 3. Facial Dynamics (Blinking & Talking)
      const face = metrics.face;
      if (face) {
        if (Array.isArray(face.blinking) && face.blinking.length > 0) {
          const latestBlink = face.blinking[face.blinking.length - 1];
          const detected = Boolean(latestBlink.detected);
          const nowMs = Date.now();
          if (detected && !this._lastBlinkDetected) {
            this.currentVitals.blinksTotal += 1;
            this._blinkTimestampsMs.push(nowMs);
          }
          this._lastBlinkDetected = detected;
          this._blinkTimestampsMs = this._blinkTimestampsMs.filter(
            (ts) => nowMs - ts <= 60000,
          );
          this.currentVitals.blinkRatePerMin = this._blinkTimestampsMs.length;
        }

        if (Array.isArray(face.talking) && face.talking.length > 0) {
          const latestTalking = face.talking[face.talking.length - 1];
          this.currentVitals.isTalking = Boolean(latestTalking.detected);
        }
      }

      this._classifyCognitiveState();
      this.currentVitals.lastUpdated = new Date().toISOString();

      const payload = {
        timestamp: Date.now(),
        timestampUs,
        sampleIndex: this.sampleIndex,
        ppgWave: Math.round(ppgWave * 1000) / 1000,
        respWave: Math.round(respWave * 1000) / 1000,
        vitals: this.getCurrentVitals(),
      };

      this.waveformBuffer.push({
        timestamp: payload.timestamp,
        ppg: payload.ppgWave,
        resp: payload.respWave,
      });
      if (this.waveformBuffer.length > this.maxWaveformPoints) {
        this.waveformBuffer.shift();
      }

      this.emit("telemetry", payload);
      this.emit("raw_metrics", { buf, timestampUs, decoded: metrics });
    } catch (e) {
      console.error("[SmartSpectra] Metric decode error:", e);
    }
  }
}

// Per-session isolation store (prevents cross-user state leakage in web server deployments)
const sessionRegistry = new Map();

export function createSmartSpectraSession(
  apiKey = process.env.SMARTSPECTRA_API_KEY,
  options = {},
) {
  return new SmartSpectraService(apiKey, options);
}

export function getSessionService(sessionId = "default") {
  const key = sessionId || "default";
  if (!sessionRegistry.has(key)) {
    sessionRegistry.set(key, createSmartSpectraSession());
  }
  return sessionRegistry.get(key);
}

export function removeSessionService(sessionId) {
  if (!sessionId || sessionId === "default") return;
  const svc = sessionRegistry.get(sessionId);
  if (svc) {
    svc.destroy();
    sessionRegistry.delete(sessionId);
  }
}

export const smartSpectraService = getSessionService("default");
