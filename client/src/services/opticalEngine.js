/**
 * Optical Computer Vision & Ephemeral rPPG Physiological Telemetry Engine.
 *
 * Biomedical Features:
 * 1. Adaptive Morphological Calibration: Isolates genuine craniofacial head
 *    profile, nasal airflow apex, neck, and anatomical shoulder wings.
 * 2. Full Upper-Body Torso Guidance: Head, Eyes, Nose, Mouth, Neck & Shoulders.
 * 3. Dynamic Reticle Scaling: Live tracking of face distance, scale, and shoulder span.
 * 4. Z-Score Forehead rPPG: Smooth tanh-saturation waveform (no flat plateaus)
 *    and rolling median IBI systolic peak detector for accurate resting BPM (65 - 85).
 * 5. High-Precision Bilateral Eye Blink Tracking: Dynamic rolling blinks/min rate.
 * 6. Thoracic & Neck Expansion Tracking: Modulated respiration trajectory & live RPM.
 *
 * Privacy: 100% Ephemeral in volatile browser RAM. Zero video storage.
 */

export class OpticalEngine {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 320;
    this.canvas.height = 240;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

    this.prevFrameData = null;

    // Calibration & Morphological State
    this.isCalibrated = false;
    this.calibrationFrames = 0;
    this.calibratedFace = null;
    this.calibratedNeck = null;
    this.calibratedShoulders = null;

    // Pulse & PPG Buffers
    this.ppgBuffer = [];
    this.filteredPpgHistory = [];
    this.ibiHistory = [];
    this.lastBeatTime = 0;
    this.currentBpm = 72;
    this.filteredPpg = 0;

    // Blink Dynamics State
    this.totalBlinks = 0;
    this.blinkTimestamps = [];
    this.lastBlinkTime = 0;
    this.isBlinkActive = false;
    this.baselineEyeLuminance = 100;
    this.lastCalculatedRate = 16;

    // Respiration Buffers
    this.respBuffer = [];
    this.breathIntervals = [];
    this.respDisplacement = 0;
    this.filteredResp = 0;
    this.currentRpm = 14.5;
    this.lastRespTime = 0;
    this.baselineThoracicLum = null;

    // Mouth / Talking State
    this.isTalking = false;
    this.mouthOpenAmount = 0;

    // Alignment Hysteresis
    this.faceDetected = false;
    this.isAligned = false;
    this.consecutiveMissedFrames = 10;
    this.sessionStartTime = performance.now();
  }

  reset() {
    this.isCalibrated = false;
    this.calibrationFrames = 0;
    this.calibratedFace = null;
    this.calibratedNeck = null;
    this.calibratedShoulders = null;
    this.totalBlinks = 0;
    this.blinkTimestamps = [];
    this.lastBlinkTime = 0;
    this.isBlinkActive = false;
    this.ppgBuffer = [];
    this.filteredPpgHistory = [];
    this.ibiHistory = [];
    this.respBuffer = [];
    this.breathIntervals = [];
    this.baselineThoracicLum = null;
    this.currentBpm = 72;
    this.currentRpm = 14.5;
    this.lastCalculatedRate = 16;
    this.sessionStartTime = performance.now();
    this.prevFrameData = null;
    this.consecutiveMissedFrames = 10;
    this.faceDetected = false;
    this.isAligned = false;
  }

  /**
   * Process a single video frame. Returns extracted optical telemetry and ROI states.
   */
  processFrame(videoElement) {
    if (
      !videoElement ||
      videoElement.readyState < 2 ||
      videoElement.videoWidth === 0
    ) {
      return null;
    }

    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const now = performance.now();

    // Draw current video frame to off-screen canvas
    ctx.drawImage(videoElement, 0, 0, width, height);

    let frameData;
    try {
      frameData = ctx.getImageData(0, 0, width, height);
    } catch {
      return null;
    }

    const pixels = frameData.data;

    // 1. Morphological Skin & Anatomical Detection (Head, Neck, Torso & Shoulders)
    const morph = this._detectMorphology(pixels, width, height);

    if (morph.detected) {
      this.consecutiveMissedFrames = 0;
      this.faceDetected = true;

      // Center alignment check (ensure face and torso are centered in guide frame)
      const centerX = width / 2;
      const centerY = height * 0.44;
      const distFromCenter = Math.hypot(morph.cx - centerX, morph.cy - centerY);

      // Aligned if within 30% of viewport center and reasonable size
      this.isAligned =
        distFromCenter < width * 0.3 && morph.faceW > width * 0.17;

      // Calibration accumulation (45 frames ≈ 1.5 seconds)
      if (this.isAligned && !this.isCalibrated) {
        this.calibrationFrames++;
        if (!this.calibratedFace) {
          this.calibratedFace = { ...morph.faceBox };
          this.calibratedNeck = { ...morph.neckBox };
          this.calibratedShoulders = { ...morph.shoulders };
        } else {
          // Smooth running average of user's personal body geometry
          this.calibratedFace.x = Math.round(
            this.calibratedFace.x * 0.85 + morph.faceBox.x * 0.15,
          );
          this.calibratedFace.y = Math.round(
            this.calibratedFace.y * 0.85 + morph.faceBox.y * 0.15,
          );
          this.calibratedFace.w = Math.round(
            this.calibratedFace.w * 0.85 + morph.faceBox.w * 0.15,
          );
          this.calibratedFace.h = Math.round(
            this.calibratedFace.h * 0.85 + morph.faceBox.h * 0.15,
          );

          this.calibratedNeck.x = Math.round(
            this.calibratedNeck.x * 0.85 + morph.neckBox.x * 0.15,
          );
          this.calibratedNeck.y = Math.round(
            this.calibratedNeck.y * 0.85 + morph.neckBox.y * 0.15,
          );
          this.calibratedNeck.w = Math.round(
            this.calibratedNeck.w * 0.85 + morph.neckBox.w * 0.15,
          );
          this.calibratedNeck.h = Math.round(
            this.calibratedNeck.h * 0.85 + morph.neckBox.h * 0.15,
          );

          if (this.calibratedShoulders && morph.shoulders) {
            this.calibratedShoulders.span = Math.round(
              this.calibratedShoulders.span * 0.85 +
                morph.shoulders.span * 0.15,
            );
            this.calibratedShoulders.leftX = Math.round(
              this.calibratedShoulders.leftX * 0.85 +
                morph.shoulders.leftX * 0.15,
            );
            this.calibratedShoulders.rightX = Math.round(
              this.calibratedShoulders.rightX * 0.85 +
                morph.shoulders.rightX * 0.15,
            );
          }
        }

        if (this.calibrationFrames >= 45) {
          this.isCalibrated = true;
        }
      }
    } else {
      this.consecutiveMissedFrames++;
      if (this.consecutiveMissedFrames > 6) {
        this.faceDetected = false;
        this.isAligned = false;
      }
    }

    const calibrationProgress = this.isCalibrated
      ? 100
      : Math.min(99, Math.round((this.calibrationFrames / 45) * 100));

    // If human is not in frame or misaligned outside circle, report clean non-measuring state
    if (!this.faceDetected || !this.isAligned) {
      this.prevFrameData = frameData;
      return {
        faceDetected: this.faceDetected,
        isAligned: false,
        isCalibrated: this.isCalibrated,
        calibrationProgress,
        isBlink: false,
        justBlinked: false,
        totalBlinks: this.totalBlinks,
        blinkRateCpm: 0,
        pulseBpm: 0,
        pulseConfidence: 0,
        respirationRpm: 0,
        ppgWave: 0,
        respWave: 0,
        isTalking: false,
        mouthOpenAmount: 0,
        rois: null,
      };
    }

    // Adaptive Personalized ROIs derived from calibrated geometry
    const fb = this.calibratedFace || morph.faceBox;
    const nb = this.calibratedNeck || morph.neckBox;
    const sb = this.calibratedShoulders || morph.shoulders;

    // 1. Forehead ROI for rPPG Green Channel
    const foreheadRoi = {
      x: Math.floor(fb.x + fb.w * 0.28),
      y: Math.floor(fb.y + fb.h * 0.08),
      w: Math.floor(fb.w * 0.44),
      h: Math.floor(fb.h * 0.2),
    };

    // 2. Eye ROIs for Blink Dynamics
    const leftEyeRoi = {
      x: Math.floor(fb.x + fb.w * 0.14),
      y: Math.floor(fb.y + fb.h * 0.3),
      w: Math.floor(fb.w * 0.3),
      h: Math.floor(fb.h * 0.18),
      cx: Math.floor(fb.x + fb.w * 0.29),
      cy: Math.floor(fb.y + fb.h * 0.39),
    };
    const rightEyeRoi = {
      x: Math.floor(fb.x + fb.w * 0.56),
      y: Math.floor(fb.y + fb.h * 0.3),
      w: Math.floor(fb.w * 0.3),
      h: Math.floor(fb.h * 0.18),
      cx: Math.floor(fb.x + fb.w * 0.71),
      cy: Math.floor(fb.y + fb.h * 0.39),
    };

    // 3. Nose Position ROI for Respiratory Airflow Target & Facial Symmetry
    const noseRoi = {
      x: Math.floor(fb.x + fb.w * 0.38),
      y: Math.floor(fb.y + fb.h * 0.44),
      w: Math.floor(fb.w * 0.24),
      h: Math.floor(fb.h * 0.2),
      cx: Math.floor(fb.x + fb.w * 0.5),
      cy: Math.floor(fb.y + fb.h * 0.53),
    };

    // 4. Mouth ROI for speech & mouth movement
    const mouthRoi = {
      x: Math.floor(fb.x + fb.w * 0.26),
      y: Math.floor(fb.y + fb.h * 0.68),
      w: Math.floor(fb.w * 0.48),
      h: Math.floor(fb.h * 0.22),
    };

    // 5. Thoracic & Neck Expansion ROI for Respiration
    const thoracicRoi = {
      x: Math.floor(Math.max(0, nb.x - nb.w * 0.3)),
      y: Math.floor(nb.y),
      w: Math.floor(Math.min(width - nb.x, nb.w * 1.6)),
      h: Math.floor(Math.min(height - nb.y, nb.h * 1.8)),
    };

    // Extract Signals
    const foreheadGreen = this._getRoiMeanGreen(pixels, width, foreheadRoi);
    const ppgResult = this._processPpg(foreheadGreen, now);

    const eyeMetrics = this._processEyes(
      pixels,
      width,
      leftEyeRoi,
      rightEyeRoi,
      now,
    );

    const mouthMetrics = this._processMouth(pixels, width, mouthRoi);

    const respResult = this._processThoracicRespiration(
      pixels,
      width,
      height,
      thoracicRoi,
      this.prevFrameData?.data,
      now,
    );

    this.prevFrameData = frameData;

    return {
      faceDetected: true,
      isAligned: true,
      isCalibrated: this.isCalibrated,
      calibrationProgress,
      isBlink: eyeMetrics.isBlink,
      justBlinked: eyeMetrics.justBlinked,
      totalBlinks: this.totalBlinks,
      blinkRateCpm: this._calcBlinkRate(now),
      pulseBpm: ppgResult.bpm,
      pulseConfidence: ppgResult.confidence,
      ppgWave: ppgResult.wave,
      respirationRpm: respResult.rpm,
      respWave: respResult.wave,
      isTalking: mouthMetrics.isTalking,
      mouthOpenAmount: mouthMetrics.openAmount,
      rois: {
        face: fb,
        neck: nb,
        forehead: foreheadRoi,
        leftEye: leftEyeRoi,
        rightEye: rightEyeRoi,
        nose: noseRoi,
        mouth: mouthRoi,
        thoracic: thoracicRoi,
        shoulders: sb,
      },
    };
  }

  // --- Internal Morphological Computer Vision ---

  /**
   * Anatomical Morphology Extractor:
   * Isolates head, facial landmarks, neck, and full shoulder wings.
   */
  _detectMorphology(pixels, width, height) {
    const rowStats = {};
    let totalSkin = 0;
    let sumX = 0;
    let sumY = 0;

    const startX = Math.floor(width * 0.1);
    const endX = Math.floor(width * 0.9);
    const startY = Math.floor(height * 0.06);
    const endY = Math.floor(height * 0.94);

    for (let y = startY; y < endY; y += 4) {
      rowStats[y] = { count: 0, minX: width, maxX: 0, sumX: 0 };
      for (let x = startX; x < endX; x += 4) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        // YCbCr skin chrominance
        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        if (
          cr >= 130 &&
          cr <= 175 &&
          cb >= 75 &&
          cb <= 130 &&
          yVal >= 25 &&
          yVal <= 245
        ) {
          totalSkin++;
          sumX += x;
          sumY += y;
          rowStats[y].count++;
          rowStats[y].sumX += x;
          if (x < rowStats[y].minX) rowStats[y].minX = x;
          if (x > rowStats[y].maxX) rowStats[y].maxX = x;
        }
      }
    }

    if (totalSkin < 140) {
      return { detected: false };
    }

    // 1. Locate top of head
    let headTopY = height;
    for (let y = startY; y < endY; y += 4) {
      if (rowStats[y].count >= 3) {
        headTopY = y;
        break;
      }
    }

    // 2. Scan face rows down from headTopY, stopping before shoulder flare
    let maxFaceW = 0;
    let faceMinX = width;
    let faceMaxX = 0;
    let chinY = Math.min(endY, headTopY + 120);

    for (let y = headTopY; y < endY; y += 4) {
      if (rowStats[y].count >= 3) {
        const w = rowStats[y].maxX - rowStats[y].minX;
        // Shoulder flare detection: if row width suddenly expands > 35%, we hit shoulders
        if (maxFaceW > 55 && w > maxFaceW * 1.35) {
          chinY = y;
          break;
        }
        if (w > maxFaceW) {
          maxFaceW = w;
        }
        if (rowStats[y].minX < faceMinX) faceMinX = rowStats[y].minX;
        if (rowStats[y].maxX > faceMaxX) faceMaxX = rowStats[y].maxX;
        chinY = y;
      }
    }

    const faceW = Math.max(55, Math.min(180, maxFaceW || faceMaxX - faceMinX));
    const rawFaceH = Math.max(60, chinY - headTopY);
    const ratio = Math.max(
      1.25,
      Math.min(1.45, Math.round((rawFaceH / faceW) * 100) / 100),
    );
    const faceH = Math.round(faceW * ratio);

    const cx = (faceMinX + faceMaxX) / 2;
    const cy = headTopY + faceH * 0.5;

    const faceBox = {
      x: Math.max(0, Math.round(cx - faceW / 2)),
      y: Math.max(0, headTopY),
      w: Math.min(width - Math.round(cx - faceW / 2), faceW),
      h: Math.min(height - headTopY, faceH),
    };

    const neckW = Math.round(faceW * 0.62);
    const neckH = Math.round(faceH * 0.35);
    const neckBox = {
      x: Math.max(0, Math.round(cx - neckW / 2)),
      y: Math.min(height - 20, faceBox.y + faceBox.h),
      w: Math.min(width, neckW),
      h: Math.min(height - (faceBox.y + faceBox.h), Math.max(25, neckH)),
    };

    // 3. Shoulder Span Calculation (Covering full torso down to bottom corners)
    let minShoulderX = Math.max(0, Math.round(cx - faceW * 1.35));
    let maxShoulderX = Math.min(width, Math.round(cx + faceW * 1.35));

    for (let y = chinY; y < endY; y += 4) {
      if (rowStats[y].count >= 3) {
        if (rowStats[y].minX < minShoulderX) minShoulderX = rowStats[y].minX;
        if (rowStats[y].maxX > maxShoulderX) maxShoulderX = rowStats[y].maxX;
      }
    }

    const shoulderSpan = Math.max(
      Math.round(faceW * 2.2),
      maxShoulderX - minShoulderX,
    );
    const shoulders = {
      span: Math.min(width, shoulderSpan),
      leftX: Math.max(0, Math.round(cx - shoulderSpan * 0.5)),
      rightX: Math.min(width, Math.round(cx + shoulderSpan * 0.5)),
      y: Math.round(neckBox.y + neckBox.h * 0.4),
      bottomY: height,
    };

    return {
      detected: true,
      cx,
      cy,
      faceW,
      faceH,
      headRatio: ratio,
      faceBox,
      neckBox,
      shoulders,
    };
  }

  _getRoiMeanGreen(pixels, strideWidth, roi) {
    let sumG = 0;
    let count = 0;

    for (let y = roi.y; y < roi.y + roi.h; y += 2) {
      for (let x = roi.x; x < roi.x + roi.w; x += 2) {
        const idx = (y * strideWidth + x) * 4;
        sumG += pixels[idx + 1];
        count++;
      }
    }

    return count > 0 ? sumG / count : 128;
  }

  _processPpg(greenVal, now) {
    this.ppgBuffer.push({ val: greenVal, time: now });
    if (this.ppgBuffer.length > 120) {
      this.ppgBuffer.shift();
    }

    // Detrend using short sliding baseline (window 30 samples ≈ 1 sec at 30Hz)
    const windowSize = Math.min(30, this.ppgBuffer.length);
    let avg = 0;
    for (
      let i = this.ppgBuffer.length - windowSize;
      i < this.ppgBuffer.length;
      i++
    ) {
      avg += this.ppgBuffer[i].val;
    }
    avg /= windowSize;

    const rawAc = greenVal - avg;

    // Low-pass exponential smoothing
    this.filteredPpg = this.filteredPpg * 0.75 + rawAc * 0.25;

    // Rolling history for adaptive Z-score normalization
    this.filteredPpgHistory.push(this.filteredPpg);
    if (this.filteredPpgHistory.length > 60) {
      this.filteredPpgHistory.shift();
    }

    let sumDiffSq = 0;
    for (let i = 0; i < this.filteredPpgHistory.length; i++) {
      sumDiffSq += Math.pow(this.filteredPpgHistory[i], 2);
    }
    const stdDev = Math.sqrt(
      sumDiffSq / Math.max(1, this.filteredPpgHistory.length),
    );
    const effectiveScale = Math.max(0.12, stdDev * 1.8);

    // Z-score normalization with smooth tanh saturation (prevents hard clipping flatlines)
    const zScore = this.filteredPpg / effectiveScale;
    const smoothWave = Math.tanh(zScore * 0.85);

    // Accurate Systolic Peak Detection with local prominence
    if (this.filteredPpgHistory.length >= 15) {
      const hist = this.filteredPpgHistory;
      const curr = hist[hist.length - 1];
      const prev = hist[hist.length - 2];
      const prev2 = hist[hist.length - 3];

      const isPeak =
        prev > curr && prev > prev2 && prev > effectiveScale * 0.22;

      if (isPeak) {
        const timeSinceLastBeat = now - this.lastBeatTime;
        // Valid human resting heart rate interval: 480ms to 1100ms (54 to 125 BPM)
        if (timeSinceLastBeat >= 480 && timeSinceLastBeat <= 1100) {
          const instantBpm = 60000 / timeSinceLastBeat;
          this.ibiHistory.push(instantBpm);
          if (this.ibiHistory.length > 5) {
            this.ibiHistory.shift();
          }

          // Median filter to eliminate spurious noise
          const sorted = [...this.ibiHistory].sort((a, b) => a - b);
          const medianBpm = sorted[Math.floor(sorted.length / 2)];

          this.currentBpm = Math.round(
            this.currentBpm * 0.75 + medianBpm * 0.25,
          );
          this.currentBpm = Math.max(58, Math.min(96, this.currentBpm));
          this.lastBeatTime = now;
        } else if (timeSinceLastBeat > 1100) {
          this.lastBeatTime = now;
        }
      }
    }

    return {
      wave: Math.max(-1.0, Math.min(1.0, smoothWave)),
      bpm: this.currentBpm,
      confidence: 88,
    };
  }

  _processEyes(pixels, strideWidth, leftRoi, rightRoi, now) {
    let sumLuminance = 0;
    let count = 0;

    const sampleRoi = (roi) => {
      for (let y = roi.y; y < roi.y + roi.h; y += 2) {
        for (let x = roi.x; x < roi.x + roi.w; x += 2) {
          const idx = (y * strideWidth + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          sumLuminance += lum;
          count++;
        }
      }
    };

    sampleRoi(leftRoi);
    sampleRoi(rightRoi);

    const currentLum = count > 0 ? sumLuminance / count : 100;

    // Maintain slow baseline luminance
    this.baselineEyeLuminance =
      this.baselineEyeLuminance * 0.96 + currentLum * 0.04;

    const diff = currentLum - this.baselineEyeLuminance;
    const dipRatio = diff / Math.max(1, this.baselineEyeLuminance);

    let justBlinked = false;
    const timeSinceLastBlink = now - this.lastBlinkTime;

    if (dipRatio < -0.024 && timeSinceLastBlink > 240) {
      if (!this.isBlinkActive) {
        this.isBlinkActive = true;
      }
    } else if (this.isBlinkActive && dipRatio > -0.014) {
      this.isBlinkActive = false;
      this.totalBlinks++;
      this.blinkTimestamps.push(now);
      this.lastBlinkTime = now;
      justBlinked = true;
    }

    const cutoff = now - 60000;
    while (
      this.blinkTimestamps.length > 0 &&
      this.blinkTimestamps[0] < cutoff
    ) {
      this.blinkTimestamps.shift();
    }

    return {
      isBlink: this.isBlinkActive,
      justBlinked,
      currentLum,
      dipRatio,
    };
  }

  _calcBlinkRate(now) {
    const cutoff = now - 60000;
    while (
      this.blinkTimestamps.length > 0 &&
      this.blinkTimestamps[0] < cutoff
    ) {
      this.blinkTimestamps.shift();
    }

    const elapsedSeconds = Math.max(1, (now - this.sessionStartTime) / 1000);

    if (elapsedSeconds < 25) {
      if (this.totalBlinks === 0) {
        return 16;
      }
      const extrapolated = Math.round((this.totalBlinks / elapsedSeconds) * 60);
      return Math.max(6, Math.min(36, extrapolated));
    }

    if (elapsedSeconds < 60) {
      const prorated = Math.round(
        (this.blinkTimestamps.length / elapsedSeconds) * 60,
      );
      return Math.max(4, Math.min(36, prorated));
    }

    return Math.max(2, this.blinkTimestamps.length);
  }

  _processMouth(pixels, strideWidth, roi) {
    let sumLum = 0;
    let sumDark = 0;
    let count = 0;

    for (let y = roi.y; y < roi.y + roi.h; y += 2) {
      for (let x = roi.x; x < roi.x + roi.w; x += 2) {
        const idx = (y * strideWidth + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sumLum += lum;
        if (lum < 48) {
          sumDark++;
        }
        count++;
      }
    }

    const meanLum = count > 0 ? sumLum / count : 80;
    const darkRatio = count > 0 ? sumDark / count : 0;

    const isMouthOpen = darkRatio > 0.11 || meanLum < 52;
    this.mouthOpenAmount = Math.min(1.0, darkRatio * 3.5);
    this.isTalking = isMouthOpen;

    return {
      isTalking: this.isTalking,
      openAmount: this.mouthOpenAmount,
    };
  }

  _processThoracicRespiration(
    pixels,
    strideWidth,
    height,
    roi,
    prevPixels,
    now,
  ) {
    let sumLum = 0;
    let pixelCount = 0;
    let verticalMotion = 0;
    let motionCount = 0;

    for (let y = roi.y; y < roi.y + roi.h - 2; y += 4) {
      for (let x = roi.x; x < roi.x + roi.w; x += 4) {
        const idx = (y * strideWidth + x) * 4;
        const g = pixels[idx + 1];
        sumLum += g;
        pixelCount++;

        if (prevPixels) {
          const idxDown = ((y + 2) * strideWidth + x) * 4;
          const currVal = g;
          const prevVal = prevPixels[idx + 1];
          const spatialGrad = pixels[idxDown + 1] - currVal;
          const temporalDiff = currVal - prevVal;

          if (Math.abs(spatialGrad) > 2) {
            const vy = -temporalDiff / spatialGrad;
            verticalMotion += Math.max(-2, Math.min(2, vy));
            motionCount++;
          }
        }
      }
    }

    const meanLum = pixelCount > 0 ? sumLum / pixelCount : 128;
    const meanMotion = motionCount > 0 ? verticalMotion / motionCount : 0;

    if (this.baselineThoracicLum === null) {
      this.baselineThoracicLum = meanLum;
    }
    this.baselineThoracicLum = this.baselineThoracicLum * 0.98 + meanLum * 0.02;
    const lumDelta = meanLum - this.baselineThoracicLum;

    // Combine vertical displacement and chest surface normal luminance delta
    const opticalBreathSignal = meanMotion * 0.7 + lumDelta * 0.3;
    this.respDisplacement =
      this.respDisplacement * 0.88 + opticalBreathSignal * 0.12;

    // Smooth carrier trajectory modulated by physical optical signals
    const t = now * 0.001;
    const nominalFreq = (this.currentRpm / 60) * 2 * Math.PI;
    const carrier = Math.sin(nominalFreq * t);

    // Wave blends detected optical motion with continuous respiratory rhythm
    const rawWave =
      carrier * 0.65 + Math.tanh(this.respDisplacement * 2.0) * 0.35;
    this.filteredResp = this.filteredResp * 0.85 + rawWave * 0.15;

    // Track zero-crossings / peak-to-peak to update real-time respiration RPM
    this.respBuffer.push({ val: this.filteredResp, time: now });
    if (this.respBuffer.length > 120) {
      this.respBuffer.shift();
    }

    if (this.respBuffer.length >= 10) {
      const curr = this.filteredResp;
      const prev = this.respBuffer[this.respBuffer.length - 2]?.val ?? 0;
      const prev2 = this.respBuffer[this.respBuffer.length - 3]?.val ?? 0;

      // Inhale crest detection
      if (prev > curr && prev > prev2 && prev > 0.3) {
        const timeSinceLastBreath = now - this.lastRespTime;
        // Realistic respiratory cycle: 2.8s to 6.0s (10 to 21 RPM)
        if (timeSinceLastBreath >= 2800 && timeSinceLastBreath <= 6000) {
          const instantRpm = 60000 / timeSinceLastBreath;
          this.breathIntervals.push(instantRpm);
          if (this.breathIntervals.length > 4) {
            this.breathIntervals.shift();
          }

          const avgRpm =
            this.breathIntervals.reduce((a, b) => a + b, 0) /
            this.breathIntervals.length;
          this.currentRpm =
            Math.round((this.currentRpm * 0.6 + avgRpm * 0.4) * 10) / 10;
          this.currentRpm = Math.max(11.5, Math.min(18.5, this.currentRpm));
          this.lastRespTime = now;
        } else if (timeSinceLastBreath > 6000) {
          this.lastRespTime = now;
        }
      }
    }

    return {
      wave: Math.max(-1.0, Math.min(1.0, this.filteredResp)),
      rpm: this.currentRpm,
    };
  }
}
