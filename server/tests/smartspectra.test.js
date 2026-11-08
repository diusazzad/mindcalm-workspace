import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SmartSpectraService, CognitiveState } from '../services/smartspectra.js';

describe('SmartSpectraService Unit Tests', () => {
  let service;

  beforeEach(() => {
    service = new SmartSpectraService('test_key');
  });

  afterEach(() => {
    service.stopSession();
  });

  test('should require explicit consent before starting a session', () => {
    assert.equal(service.hasConsent, false);
    assert.throws(
      () => service.startSession(),
      /Camera consent must be explicitly granted/
    );
  });

  test('should allow starting session once consent is granted', () => {
    service.setConsent(true);
    assert.equal(service.hasConsent, true);
    assert.doesNotThrow(() => service.startSession());
    assert.equal(service.isActive, true);
  });

  test('should revoke active session when consent is withdrawn', () => {
    service.setConsent(true);
    service.startSession();
    assert.equal(service.isActive, true);

    service.setConsent(false);
    assert.equal(service.hasConsent, false);
    assert.equal(service.isActive, false);
  });

  test('should emit physiological telemetry within realistic biological bounds', async () => {
    service.setConsent(true);
    service.startSession();

    const telemetryPromise = new Promise((resolve) => {
      service.once('telemetry', (data) => resolve(data));
    });

    const data = await telemetryPromise;
    assert.ok(data.timestamp > 0);
    assert.ok(typeof data.ppgWave === 'number');
    assert.ok(typeof data.respWave === 'number');

    const vitals = data.vitals;
    assert.ok(vitals.pulseBpm >= 50 && vitals.pulseBpm <= 130, `Pulse out of range: ${vitals.pulseBpm}`);
    assert.ok(vitals.respirationRpm >= 8 && vitals.respirationRpm <= 25, `Respiration out of range: ${vitals.respirationRpm}`);
    assert.ok(vitals.hrvRmssdMs >= 20 && vitals.hrvRmssdMs <= 100, `HRV out of range: ${vitals.hrvRmssdMs}`);
    assert.ok(Object.values(CognitiveState).includes(vitals.cognitiveState));
  });

  test('should reset session and zero rolling counters', () => {
    service.setConsent(true);
    service.startSession();
    service.currentVitals.blinksTotal = 15;

    service.resetSession();
    assert.equal(service.isActive, false);
    assert.equal(service.currentVitals.blinksTotal, 0);
    assert.equal(service.waveformBuffer.length, 0);
  });
});
