<div align="center">

# 🌿 MindCalm Workspace
### Real-Time Ergonomic & Cognitive Bio-Feedback Assistant for Developers & Knowledge Workers

**DEV.to x Presage SmartSpectra SDK Challenge Submission**  
*Prize Category: Best Thoughtful Real-World Use*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Presage SmartSpectra](https://img.shields.io/badge/Presage-SmartSpectra_v3.4-10B981.svg)](https://smartspectra.presagetech.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38BDF8.svg)](https://tailwindcss.com/)

</div>

---

## 📌 Executive Summary & Real-World Problem

In modern knowledge work, developers, engineers, and students spend 8 to 14 hours daily behind screens under high cognitive loads. This prolonged immersion induces subtle, involuntary physiological dysregulations:
1. **Screen Apnea (Unconscious Shallow Breathing):** Studies show over 80% of computer workers unconsciously hold their breath or breathe shallowly while debugging or focusing, elevating cortisol and mental fatigue.
2. **Asthenopia & Reduced Blink Frequency (Dry Eye Syndrome):** Natural blink rates plummet from an average of **15–20 blinks/min down to 4–6 blinks/min** when reading code, triggering severe ocular fatigue and headaches.
3. **Unnoticed Stress Spikes & Autonomic Imbalance:** Low Heart Rate Variability (HRV) and sustained tachycardia often go unnoticed until physical exhaustion sets in.

**MindCalm Workspace** is a contactless, privacy-preserving desktop and web companion. Leveraging the **Presage SmartSpectra SDK**, it continuously monitors live human physiological signals (Pulse, HRV, Respiration Rate, and Blink Frequency) through a standard webcam with **zero wearable hardware required**. It dynamically guides developers into ergonomic recovery through real-time bio-feedback, adaptive box-breathing pacers, and stress-modulated ambient soundscapes.

---

## 🚀 Key Features

* **🫀 Contactless Cardiac & HRV Tracking:**
  - Extracts real-time photoplethysmogram (PPG) pulse waveforms and Heart Rate Variability (HRV) directly from facial capillary blood flow.
  - Dynamically calculates autonomic nervous system balance and stress indices.

* **🫁 Respiration & Screen-Apnea Detection:**
  - Continuously analyzes respiratory wave cycles and breaths-per-minute (RPM).
  - Triggers gentle, non-intrusive haptic/visual nudges when prolonged shallow breathing or breath-holding is detected.

* **👁️ Blink Frequency & 20-20-20 Eye Strain Guardian:**
  - Quantifies real-time blinks per minute using facial landmark telemetry.
  - Warns when blink frequency drops below critical ergonomic thresholds to prevent dry eyes.

* **🧘 Interactive Adaptive Box-Breathing Pacer:**
  - An interactive visual breathing circle that dynamically synchronizes with the user's detected respiration cycle and gently coaches them back to a restorative 4-4-4-4 rhythm.

* **🎵 Stress-Modulated Generative Soundscapes:**
  - Generative ambient audio (soft rain, binaural theta frequencies, warm lo-fi) that subtly softens and deepens in real-time as heart rate and stress escalate.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER WEBCAM FEED                         │
│       (Standard USB / Built-in Laptop Camera @ 30 FPS)      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Video Frames (Local Memory Only)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          PRESAGE SMARTSPECTRA SDK (v3.4.0 FFI RUNTIME)      │
│  - Photoplethysmography (PPG) Cardio Pulse Waveform         │
│  - Respiratory Waveform & Breath-Rate Extractor             │
│  - Heart Rate Variability (HRV) & Autonomic Index           │
│  - Facial Feature & Blink Frequency Telemetry Engine        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Ephemeral Signal Stream (JSON/Events)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              EXPRESS / WEBSOCKET TELEMETRY BRIDGE           │
│  - Local Signal Aggregator & Smooth Waveform Sampler        │
│  - Adaptive Bio-Feedback Classifier (Zen / Focus / Strain)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Real-Time WebSocket Broadcast
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            MINDCALM WORKSPACE DASHBOARD (REACT 18)          │
│  - Real-Time PPG & Respiration Waveform Visualizers         │
│  - Interactive Box-Breathing Respiration Pacer              │
│  - Web Audio API Stress-Modulated Ambient Soundscapes       │
│  - Explicit Camera Consent Gate & Instant Shutter Control   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Consent and Data Handling (Required Disclosure)

In strict adherence to the Presage SmartSpectra Challenge guidelines and responsible ethical computing:

1. **Explicit, Opt-In Camera Consent:**
   - The camera is **never** accessed silently or on page load. A dedicated Consent Gate modal informs the user of camera usage, required permissions, and signal extraction goals before any camera capture stream is initialized.
   - Users can pause, mute, or permanently disconnect the camera at any time via a 1-click hardware kill switch.

2. **100% Ephemeral & On-Device Processing:**
   - Raw video frames are analyzed locally in-memory by the SmartSpectra SDK FFI pipeline.
   - **Zero** raw video frames, biometric facial embeddings, or photographs are ever recorded, saved to local disk, or transmitted to any external server.
   - All signal metrics (pulse, breathing, blink count) exist solely as transient state in memory and are discarded immediately upon session closure.

3. **Strict Non-Medical Wellness Disclaimer:**
   - MindCalm Workspace is strictly an ergonomic wellness, mindfulness, and cognitive productivity tool.
   - **It does NOT provide medical diagnosis, treatment, prognosis, or clinical decision-making.**
   - It is not an FDA-cleared or CE-marked medical device and should never replace professional medical care.

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher
- **NPM:** v9.0.0 or higher
- **Presage SmartSpectra API Key:** Obtainable via [Presage Developer Portal](https://physiology.presagetech.com/auth/register).

### 2. Environment Setup
```bash
# Clone the repository
git clone https://github.com/diusazzad/mindcalm-workspace.git
cd mindcalm-workspace

# Copy the environment template
cp .env.example .env
```
Open `.env` and insert your active SmartSpectra API key:
```env
SMARTSPECTRA_API_KEY=your_actual_key_here
PORT=5000
```
*(Note: `.env` is protected by `.gitignore` and is never committed to version control).*

### 3. Install Dependencies & Launch
```bash
# Install backend dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to access MindCalm Workspace!

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
