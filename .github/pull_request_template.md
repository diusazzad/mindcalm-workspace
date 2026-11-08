## Summary of Changes
<!-- সংক্ষেপে লিখুন এই PR-এ কী কাজ করা হয়েছে -->

## Challenge Track & Category
- [x] Best Thoughtful Real-World Use (Presage SmartSpectra SDK Challenge)
- [ ] Most Creative or Delightful Use
- [x] Eligible for Overall Winner

## Changes Implemented
- [ ] Presage SmartSpectra SDK integration (Pulse, HRV, Respiration, Facial Telemetry)
- [ ] Backend REST & WebSocket streaming server
- [ ] Unit & Integration Test Suite
- [ ] Consent & Data Handling safeguards (zero video persistence, ephemeral memory)

## Verification Checklist (Reviewer QA)
- [ ] **SmartSpectra Signal Fidelity:** Live or simulated physiological signals match biological bounds (Pulse 50-130 BPM, Breathing 8-25 RPM, HRV 20-100 ms).
- [ ] **No Medical Claims:** Strictly designated as wellness, ergonomics, and cognitive productivity (no diagnosis/treatment).
- [ ] **Consent & Privacy Compliance:** Explicit opt-in consent gate implemented; zero raw video stored or transmitted.
- [ ] **Code Cleanliness & Security:** Sensitive credentials (.env) strictly excluded; zero unhandled promise rejections.
- [ ] **Test Coverage:** All unit and API integration tests passing (`npm test`).

## How to Test
```bash
npm install
npm test
```
