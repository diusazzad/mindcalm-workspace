import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { app, server } from "../index.js";
import { smartSpectraService } from "../services/smartspectra.js";

describe("API Route Integration Tests", () => {
  let baseUrl;

  before(async () => {
    if (!server.listening) {
      await new Promise((resolve) => server.listen(0, resolve));
    }
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    smartSpectraService.stopSession();
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test("GET /health returns 200 and healthy status", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "healthy");
    assert.ok(data.sdkEngine.includes("Presage SmartSpectra"));
  });

  test("POST /api/consent validates boolean input", async () => {
    const invalidRes = await fetch(`${baseUrl}/api/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ granted: "yes" }),
    });
    assert.equal(invalidRes.status, 400);

    const validRes = await fetch(`${baseUrl}/api/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ granted: true }),
    });
    assert.equal(validRes.status, 200);
    const data = await validRes.json();
    assert.equal(data.consentGranted, true);
  });

  test("POST /api/session/start requires consent", async () => {
    smartSpectraService.setConsent(false);
    const res = await fetch(`${baseUrl}/api/session/start`, { method: "POST" });
    assert.equal(res.status, 403);

    // Now grant consent and verify success
    smartSpectraService.setConsent(true);
    const successRes = await fetch(`${baseUrl}/api/session/start`, {
      method: "POST",
    });
    assert.equal(successRes.status, 200);
    const data = await successRes.json();
    assert.equal(data.status, "started");
  });

  test("GET /api/vitals/current returns current telemetry snapshot", async () => {
    const res = await fetch(`${baseUrl}/api/vitals/current`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.pulseBpm === "number");
    assert.ok(typeof data.respirationRpm === "number");
    assert.ok(typeof data.hrvRmssdMs === "number");
  });

  test("POST /api/session/stop halts the active session", async () => {
    const res = await fetch(`${baseUrl}/api/session/stop`, { method: "POST" });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "stopped");
  });
});
