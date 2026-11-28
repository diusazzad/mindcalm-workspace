<div align="center">

# 🌿 MindCalm Workspace

### Real-Time Ergonomic & Cognitive Wellness Companion for Developers & Screen Professionals

**DEV.to x Presage SmartSpectra SDK Challenge Submission**  
_Prize Category: Best Thoughtful Real-World Use_

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Presage SmartSpectra](https://img.shields.io/badge/Presage-SmartSpectra_v3.4-10B981.svg)](https://smartspectra.presagetech.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38BDF8.svg)](https://tailwindcss.com/)

</div>

---

> **Non-Medical Ergonomic Wellness Disclaimer:** MindCalm Workspace is strictly a non-medical ergonomic, mindfulness, and screen-wellness tool. It is **not** a medical device and does **not** provide medical diagnosis, treatment, or clinical advice.

---

## 📌 Executive Summary & Real-World Problem

Developers, engineers, and knowledge workers routinely spend 8 to 14 hours daily behind screens under intense cognitive focus. Prolonged screen immersion often triggers subtle ergonomic habits that go unnoticed until fatigue sets in:

1. **Screen Apnea (Shallow Breathing Habits):** While debugging or focusing, many screen workers unconsciously hold their breath or shift to shallow thoracic breathing.
2. **Reduced Blink Rate & Visual Stare Fatigue:** Natural blink rates frequently drop from **15–20 blinks/min down to 4–6 blinks/min** during dense code reading, signaling a need for a 20-20-20 visual break.
3. **Unnoticed Autonomic Arousal & Focus Drift:** Sustained pulse elevation and lowered heart rate variability (HRV) recovery signals often accumulate silently before mental exhaustion hits.

**MindCalm Workspace** is a contactless, privacy-first ergonomic companion built around the **Presage SmartSpectra v3.4 SDK** architecture. With an ordinary webcam and **zero wearable hardware**, it tracks non-medical wellness cues (Pulse estimate, HRV RMSSD, Breathing Rate, and Blink Dynamics) and responds gently with an adaptive **Box-Breathing Pacer** and **Web Audio ambient soundscapes**.

---

## ⚙️ Honest Execution Modes (Local SDK vs. Cloud Demo)

MindCalm Workspace explicitly separates and badges its runtime mode in the top navigation bar (`LIVE SDK` vs. `OPTICAL + DEMO` vs. `DEMO / SIMULATED`):

1. **Local / Self-Hosted Native Mode (`native_smartspectra_v3.4`):**
   - Activated when a valid `SMARTSPECTRA_API_KEY` is provided in `.env` on a supported platform (`win32-x64`, `linux-x64`, `linux-arm64`, or `darwin-arm64`).
   - Initializes `SmartSpectraSDK` with `enableTelemetry: false` and requests `cardioMetrics`, `breathingMetrics`, and `faceMetrics`.
   - Captures browser webcam frames (after explicit opt-in consent and a 5s head/shoulder framing scan) and pushes RGB buffers to the backend via WebSocket using `useCustomInput()` + `sendFrame()`, decoding live protobuf packets with `decodeMetrics()` and surfacing `validationStatus` hints.
   - Enforces confidence gating (`confidence >= 40` for pulse, `>= 45` for breathing, `>= 50` for HRV) during the initial **15–30s signal warm-up**.

2. **Cloud / Hardware-Free Simulation Fallback (`simulation_fallback` + Browser Optical Framing):**
   - On Render (`https://mindcalm-workspace.onrender.com`), where no server-side camera or private API key is mounted, the backend runs in `simulation_fallback` mode and the UI clearly displays a **`DEMO / SIMULATED`** (or **`OPTICAL + DEMO`** when browser webcam framing is active) badge.
   - This lets reviewers test the Consent Gate, anatomical Head/Eye/Nose/Shoulder framing guide, 120-sample Dual-Waveform Canvas, Breathing Pacer, and Web Audio synthesis with zero setup.

---

## 🚀 Key Features

- **🫀 Contactless Pulse & HRV Tracking:**
  - Estimates pulse rate (BPM) and HRV (RMSSD) with real-time confidence scores (`Conf: %`) and warm-up status gating.
- **🫁 Respiration Pace & Screen-Apnea Cues:**
  - Monitors thoracic breathing rate (RPM) and pauses or alerts during vocal motion (`talking` flag) or out-of-frame posture.
- **👁️ Blink Dynamics & 20-20-20 Break Cues:**
  - Tracks blink counts and rolling blinks/min, surfacing gentle break cues when blink rate drops below 12 blinks/min.
- **🧘 Interactive Adaptive Box-Breathing Pacer:**
  - Visual pacer supporting **Box (4-4-4-4)**, **Coherent (5-5)**, and **Relax (4-7-8)** rhythms synced with user breathing pace.
- **🎵 Arousal-Modulated Ambient Soundscapes:**
  - Synthesizes filtered brown noise and gentle tones directly in the browser via the Web Audio API (no external audio files or tracking).

---

## 🏛️ System Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                   BROWSER WEBCAM & CONSENT GATE                      │
│  1. Explicit Opt-In Consent -> 2. 5s Framing Scan (Head/Eye/Nose)    │
│  3. Browser Optical Framing HUD + Optional 10Hz RGB Frame Stream     │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ Ephemeral Frames / Events (RAM Only)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│            PER-SESSION TELEMETRY ENGINE (server/services/)           │
│  - Isolated per-client session via `x-session-id` / `?sessionId=`    │
│  - Native Mode: SmartSpectraSDK (enableTelemetry: false)             │
│    * useCustomInput() + sendFrame() + decodeMetrics()                │
│    * Confidence Gating (Pulse >= 40, Breathing >= 45, HRV >= 50)     │
│    * validationStatus alerts (low light, centering, motion)          │
│  - Cloud Demo Mode: Deterministic `simulation_fallback`              │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ 30Hz JSON Telemetry (WebSocket)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│              MINDCALM WORKSPACE DASHBOARD (REACT 18)                 │
│  - Honest `LIVE SDK` / `OPTICAL + DEMO` / `DEMO / SIMULATED` Badges  │
│  - 120-Sample Dual-Waveform Visualizer (PPG & Respiration Canvas)    │
│  - Adaptive Breathing Pacer + Web Audio Soundscape + Disclaimer      │
└──────────────────────────────────────────────────────────────────────┘
```

### Edge Cases & Signal Engineering

- **15–30s Warm-Up & Confidence Gating:** Early frames display `"Warming up"` until confidence thresholds stabilize instead of presenting noisy startup artifacts as stable vitals.
- **Low-Light & Framing Alerts:** Native `validationStatus` hints and the anatomical framing overlay detect when the user leaves the guide or lighting drops, pausing waveform capture cleanly.
- **Vocal Motion Gating:** Speaking modulates facial/jaw pixels and breathing traces; vocal motion triggers a `"Vocal Motion (Breathing Gated)"` badge to prevent false screen-apnea alerts.
- **Per-User Web Isolation:** Each browser tab generates an ephemeral `sessionId` (`sessionStorage`), preventing consent or session state leakage between concurrent web users.

---

## 🔒 Consent and Data Handling (Required Disclosure)

In strict adherence to the Presage SmartSpectra Challenge guidelines:

1. **Explicit, Opt-In Camera Consent:**
   - The camera is **never** accessed on page load. A dedicated Consent Gate modal explains camera usage and permissions before `getUserMedia` or any sensing session can start.
   - Users can pause, mute video, or revoke consent at any time via a 1-click kill switch (`POST /api/consent { granted: false }`), immediately halting capture and clearing session buffers.
2. **SDK Telemetry Opt-Out & Zero Storage:**
   - `SmartSpectraSDK` is initialized with `enableTelemetry: false`.
   - **Zero** raw video frames, photographs, or facial embeddings are ever written to disk, stored in a database, shared with third parties, or sent to external AI/LLM APIs.
   - All transient signal buffers (up to 120 samples) reside strictly in volatile RAM and are discarded on stop/reset/disconnect.
3. **Non-Medical Disclaimer:**
   - MindCalm Workspace is strictly an ergonomic wellness and mindfulness tool—not a medical device—and does not diagnose, treat, cure, or prevent any medical condition.

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites

- **Node.js:** v20.0.0 or higher (recommended by `@smartspectra/node-sdk` v3.4.0)
- **NPM:** v9.0.0 or higher
- **Presage SmartSpectra API Key:** Obtainable via [Presage Developer Portal](https://physiology.presagetech.com/auth/register) (optional — runs in `simulation_fallback` if omitted)

### 2. Environment Setup

```bash
# Clone the repository
git clone https://github.com/diusazzad/mindcalm-workspace.git
cd mindcalm-workspace

# Copy the environment template
cp .env.example .env
```

Open `.env` and insert your SmartSpectra API key (leave empty to test simulation fallback mode):

```env
SMARTSPECTRA_API_KEY=your_actual_key_here
PORT=5000
```

_(Note: `.env` is protected by `.gitignore` and never committed.)_

### 3. Install Dependencies & Launch (2 Concurrent Servers)

For local development, run **2 servers concurrently** in separate terminals:

1. **Backend Server** (Express API & WebSocket Telemetry on Port `5000`)
2. **Frontend Client** (Vite + React 18 UI with Live HMR on Port `5173`)

#### Terminal 1: Backend Server (Port 5000)

```bash
# In the root project directory:
npm install

# Start backend server in watch mode:
npm run dev
```

#### Terminal 2: Frontend Client (Port 5173)

```bash
# In a second terminal window, navigate to the client folder:
cd client
npm install

# Start Vite development server:
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

#### 💡 Alternative: Single-Service Production / Standalone Mode

To serve the compiled React UI from the unified Express server (as deployed on Render):

```bash
npm run build
npm start
```

Then visit **`http://localhost:5000`**.

---

## 🧪 Testing

Run the full API integration and `SmartSpectraService` unit test suite (including protobuf decoding and per-session isolation checks):

```bash
npm test
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
