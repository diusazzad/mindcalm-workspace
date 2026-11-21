---
title: "MindCalm Workspace: Contactless Biofeedback & Screen-Apnea Recovery with Presage SmartSpectra SDK"
published: false
description: "Contactless developer ergonomics workspace powered by Presage SmartSpectra v3.4 SDK, featuring 30Hz optical PPG waveforms, screen-apnea detection, and vagal nerve box-breathing."
tags: devchallenge, presagechallenge, webdev, javascript
cover_image: https://raw.githubusercontent.com/diusazzad/mindcalm-workspace/master/client/public/og-image.png
canonical_url: https://github.com/diusazzad/mindcalm-workspace
---

*This article is submitted for the [Presage SmartSpectra SDK Challenge](https://dev.to/devteam/join-the-presage-smartspectra-sdk-challenge-3000-in-prizes-across-10-winners-1370) under the **Best Thoughtful Real-World Use** category.*

---

## 💡 What I Built

Modern software engineers and digital creators spend 8 to 14 hours every day immersed in deep cognitive focus. Unbeknownst to most, this continuous screen immersion triggers acute, silent physiological dysregulations:
1. **Screen Apnea (Unconscious Breath-Holding):** Over 80% of computer workers hold their breath or breathe in shallow gasps while coding, debugging, or answering emails, keeping cortisol levels elevated.
2. **Asthenopia & Ocular Strain:** Natural blink rates plummet from **15–20 blinks/min down to 4–6 blinks/min** when reading code, resulting in chronic dry-eye syndrome and visual headaches.
3. **Hidden Sympathetic Burnout:** Prolonged low Heart Rate Variability (HRV) and elevated pulse rates often go unnoticed until physical exhaustion strikes.

**MindCalm Workspace** is a contactless, real-time biofeedback and ergonomic companion. Using the **Presage SmartSpectra v3.4 SDK** with a standard laptop camera and **zero wearable hardware**, MindCalm continuously measures:
* **Photoplethysmography (PPG) Pulse Waveform** and instantaneous Pulse Rate (BPM)
* **Heart Rate Variability (HRV RMSSD)** reflecting autonomic nervous system tone
* **Thoracic Respiration Trajectory** and Breaths-Per-Minute (RPM) to detect screen-apnea
* **Ocular Blink Dynamics** with proactive alerts under the 20-20-20 ergonomics rule

When physiological stress spikes or breathing halts, MindCalm intervenes non-intrusively with an autonomic **4-4-4-4 Box Breathing Pacer** and a **Web Audio API generative ambient soundscape** dynamically modulated by autonomic state (`CALM_FLOW`, `DEEP_FOCUS`, `COGNITIVE_STRAIN`).

---

## 🔒 Consent and Data Handling (Mandatory Disclosure)

In strict compliance with the Presage SmartSpectra SDK Challenge rules and ethical AI guidelines:

1. **Explicit Pre-Camera Opt-In Consent:**
   - The camera is **never** accessed automatically on page load. A dedicated `ConsentGateModal` requires explicit opt-in confirmation before any video capture stream can be initialized.
   - Users can revoke consent or pause the session at any time with a single click, instantly severing the camera stream and wiping all in-memory buffers.
2. **100% Ephemeral In-Memory RAM Processing:**
   - Optical bio-signal sampling occurs strictly in volatile memory.
   - **Zero raw video frames, biometric facial embeddings, facial crops, or identifiable imagery are ever recorded, saved to local disk, or transmitted over external networks.**
3. **Strict Non-Medical Ergonomics Disclaimer:**
   - MindCalm Workspace is strictly a non-clinical wellness and ergonomics tool for workplace productivity.
   - **It is NOT a medical device and does NOT diagnose, treat, cure, or prevent any disease or medical condition.**
4. **Graceful Headless / Evaluation Fallback:**
   - Includes a deterministic simulation engine allowing judges and evaluators to test all telemetry visualizations, audio synthesis, and HUD metrics even in environments without live hardware webcam access.

---

## 🚀 Demo & Repository

- **GitHub Repository (Public & MIT Licensed):** [https://github.com/diusazzad/mindcalm-workspace](https://github.com/diusazzad/mindcalm-workspace)
- **Tech Stack:**
  - **Presage SmartSpectra SDK v3.4.0** with native Windows x64 FFI bindings (`@smartspectra/node-sdk-win32-x64`)
  - **Backend:** Node.js (v18+), Express, WebSocket (30Hz high-frequency telemetry broadcast)
  - **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons, HTML5 Canvas, Web Audio API

---

## 🧠 How the Presage SmartSpectra SDK is Used

The core intelligence of MindCalm Workspace is orchestrated via the official `@smartspectra/node-sdk`:

```javascript
// server/services/smartspectra.js
import { SmartSpectraSDK } from '@smartspectra/node-sdk';

class SmartSpectraService {
  constructor(apiKey) {
    this.sdk = new SmartSpectraSDK({
      apiKey: apiKey,
      enableTelemetry: false // Privacy guarantee
    });
    
    // Register high-frequency physiological signal listener
    this.sdk.on('metrics', (metrics) => {
      this.handleIncomingMetrics(metrics);
    });
  }
}
```

Key SDK metrics captured and computed:
- **`metrics.pulse` (BPM & Confidence):** Filtered with a confidence threshold $\ge 40$ to eliminate optical noise.
- **`metrics.breathing` (RPM & Confidence):** Automatically gated when vocal motion (`face.talking`) is detected to avoid speech-induced respiratory artifacts.
- **`metrics.hrv` (RMSSD in ms):** Evaluated to classify cognitive state between relaxed parasympathetic dominance (`CALM_FLOW`) and sympathetic hyperarousal (`COGNITIVE_STRAIN`).
- **`metrics.blinks`:** Cumulative count differentiated over time to monitor screen blink frequency.

---

## 🛠️ How to Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/diusazzad/mindcalm-workspace.git
cd mindcalm-workspace

# 2. Configure Environment
cp .env.example .env
# Edit .env with your Presage Developer API Key (or leave blank for simulation fallback)

# 3. Start Backend & WebSocket Server (Port 5000)
npm install
npm run dev

# 4. Start React Frontend Dashboard (Port 5173)
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser, review the **Consent Gate Modal**, and start your ergonomic biofeedback session!
