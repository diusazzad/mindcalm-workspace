import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  SmartSpectraService,
  CognitiveState,
  createSmartSpectraSession,
} from "../services/smartspectra.js";

describe("SmartSpectraService Unit Tests", () => {
  let service;

  beforeEach(async () => {
    service = new SmartSpectraService("test_key");
    await service.ensureReady();
  });

  afterEach(async () => {
    await service.destroy();
  });

  test("should require explicit consent before starting a session", () => {
    assert.equal(service.hasConsent, false);
    assert.throws(
      () => service.startSession(),
      /Camera consent must be explicitly granted/,
    );
  });

  test("should allow starting session once consent is granted", () => {
    service.setConsent(true);
    assert.equal(service.hasConsent, true);
    assert.doesNotThrow(() => service.startSession());
    assert.equal(service.isActive, true);
  });

  test("should revoke active session when consent is withdrawn", () => {
    service.setConsent(true);
    service.startSession();
    assert.equal(service.isActive, true);

    service.setConsent(false);
    assert.equal(service.hasConsent, false);
    assert.equal(service.isActive, false);
  });

  test("should emit physiological telemetry within realistic biological bounds", async () => {
    service.setConsent(true);
    service.startSession();

    const telemetryPromise = new Promise((resolve) => {
      service.once("telemetry", (data) => resolve(data));
    });

    const data = await telemetryPromise;
    assert.ok(data.timestamp > 0);
    assert.ok(typeof data.ppgWave === "number");
    assert.ok(typeof data.respWave === "number");
    assert.equal(service.maxWaveformPoints, 120);

    const vitals = data.vitals;
    assert.ok(
      vitals.pulseBpm >= 50 && vitals.pulseBpm <= 130,
      `Pulse out of range: ${vitals.pulseBpm}`,
    );
    assert.ok(
      vitals.respirationRpm >= 8 && vitals.respirationRpm <= 25,
      `Respiration out of range: ${vitals.respirationRpm}`,
    );
    assert.ok(
      vitals.hrvRmssdMs >= 20 && vitals.hrvRmssdMs <= 100,
      `HRV out of range: ${vitals.hrvRmssdMs}`,
    );
    assert.equal(vitals.sdkMode, "simulation_fallback");
    assert.ok(Object.values(CognitiveState).includes(vitals.cognitiveState));
  });

  test("should decode native SmartSpectra protobuf metrics with confidence gating", async () => {
    const { Metrics } = await import("@smartspectra/node-sdk/messages");
    const encoded = Metrics.encode({
      cardio: {
        pulseRate: [
          { value: 78.4, confidence: 88, stable: true, timestamp: 1000 },
        ],
        arterialPressureTrace: [{ value: 0.42, stable: true, timestamp: 1000 }],
        hrv: [{ rmssd: 46.5, confidence: 72, stable: true, timestamp: 1000 }],
      },
      breathing: {
        rate: [{ value: 13.8, confidence: 81, stable: true, timestamp: 1000 }],
        upperTrace: [{ value: 0.31, stable: true, timestamp: 1000 }],
        apnea: [{ detected: false, stable: true, timestamp: 1000 }],
      },
      face: {
        blinking: [{ detected: true, stable: true, timestamp: 1000 }],
        talking: [{ detected: false, stable: true, timestamp: 1000 }],
      },
    }).finish();

    let emitted = null;
    service.once("telemetry", (payload) => {
      emitted = payload;
    });

    service._handleNativeSdkMetrics(encoded, 1000);

    assert.ok(emitted, "Expected telemetry event from decoded protobuf buffer");
    assert.equal(emitted.vitals.pulseBpm, 78.4);
    assert.equal(emitted.vitals.pulseConfidence, 88);
    assert.equal(emitted.vitals.pulseStable, true);
    assert.equal(emitted.vitals.hrvRmssdMs, 46.5);
    assert.equal(emitted.vitals.respirationRpm, 13.8);
    assert.equal(emitted.vitals.respirationConfidence, 81);
    assert.equal(emitted.vitals.blinksTotal, 1);
    assert.equal(emitted.vitals.isTalking, false);
  });

  test("should reset session and zero rolling counters", () => {
    service.setConsent(true);
    service.startSession();
    service.currentVitals.blinksTotal = 15;

    service.resetSession();
    assert.equal(service.isActive, false);
    assert.equal(service.currentVitals.blinksTotal, 0);
    assert.equal(service.waveformBuffer.length, 0);
  });

  test("should isolate state across per-client sessions", async () => {
    const userA = createSmartSpectraSession("test_key");
    const userB = createSmartSpectraSession("test_key");
    await Promise.all([userA.ensureReady(), userB.ensureReady()]);

    userA.setConsent(true);
    userA.startSession();

    assert.equal(userA.hasConsent, true);
    assert.equal(userA.isActive, true);
    assert.equal(userB.hasConsent, false);
    assert.equal(userB.isActive, false);

    await Promise.all([userA.destroy(), userB.destroy()]);
  });
});
