/**
 * OA Sentinel - Multimodal Temporal Synchronization Service
 * Aligns Camera frames and ESP32 MPU6050 IMU packets on a synchronized timeline.
 * 
 * Criteria:
 * - Error difference delta_t = |t_cam - t_imu|
 * - Quality:
 *    - Excellent: delta_t <= 20 ms (within 1 IMU cycle at 50Hz)
 *    - Good:      20 ms < delta_t <= 50 ms
 *    - Warning:   delta_t > 50 ms
 */

class SynchronizationService {
  constructor() {
    this.imuBuffer = [];
    this.cameraBuffer = [];
    this.matchedPairs = [];
    this.timeOffsetMs = 0; // Estimated hardware clock to performance.now() offset
    this.maxBufferSize = 600;
  }

  reset() {
    this.imuBuffer = [];
    this.cameraBuffer = [];
    this.matchedPairs = [];
    this.timeOffsetMs = 0;
  }

  /**
   * Register incoming IMU packet with both hardware timestamp (ms) and browser timestamp (ms)
   */
  addIMUPacket(packet) {
    const localNow = performance.now();
    const entry = {
      ...packet,
      local_time: localNow,
    };

    // Calculate/refine offset between device millis() and performance.now()
    if (this.timeOffsetMs === 0 && packet.timestamp > 0) {
      this.timeOffsetMs = localNow - packet.timestamp;
    }

    this.imuBuffer.push(entry);
    if (this.imuBuffer.length > this.maxBufferSize) {
      this.imuBuffer.shift();
    }
  }

  /**
   * Register incoming Camera frame and find temporally matched IMU vector
   */
  addCameraFrame(frameSnapshot, frameTimestampMs = performance.now()) {
    const entry = {
      ...frameSnapshot,
      camera_timestamp: Math.round(frameTimestampMs),
    };

    this.cameraBuffer.push(entry);
    if (this.cameraBuffer.length > this.maxBufferSize) {
      this.cameraBuffer.shift();
    }

    // Match with closest IMU packet
    const matched = this.findNearestIMU(frameTimestampMs);
    if (matched) {
      const diffMs = Math.abs(frameTimestampMs - matched.effectiveTime);
      let quality = "Warning";
      if (diffMs <= 20) {
        quality = "Excellent";
      } else if (diffMs <= 50) {
        quality = "Good";
      }

      const pair = {
        id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        camera_time: Math.round(frameTimestampMs),
        imu_time: Math.round(matched.packet.timestamp),
        diff_ms: Math.round(diffMs),
        quality,
        frame: entry,
        imu: matched.packet,
      };

      this.matchedPairs.push(pair);
      if (this.matchedPairs.length > 200) {
        this.matchedPairs.shift();
      }

      return pair;
    }

    return null;
  }

  findNearestIMU(cameraLocalMs) {
    if (this.imuBuffer.length === 0) return null;

    let bestPacket = null;
    let minDiff = Infinity;
    let effectiveBestTime = 0;

    for (let i = this.imuBuffer.length - 1; i >= 0; i--) {
      const pkt = this.imuBuffer[i];
      // Effective time is either the hardware timestamp calibrated to local time or local_time
      const effTime = pkt.timestamp + this.timeOffsetMs;
      const diff = Math.abs(cameraLocalMs - effTime);

      if (diff < minDiff) {
        minDiff = diff;
        bestPacket = pkt;
        effectiveBestTime = effTime;
      }

      // Stop searching if we passed reasonable temporal window
      if (diff > 500 && i < this.imuBuffer.length - 20) break;
    }

    return bestPacket ? { packet: bestPacket, effectiveTime: effectiveBestTime } : null;
  }

  getMatchedPairs(limit = 30) {
    return this.matchedPairs.slice(-limit);
  }

  getSyncQualitySummary() {
    if (this.matchedPairs.length === 0) {
      return {
        overall_quality: "No Stream",
        avg_error_ms: 0,
        excellent_pct: 0,
        good_pct: 0,
        warning_pct: 0,
        total_samples: 0,
      };
    }

    const n = this.matchedPairs.length;
    const errors = this.matchedPairs.map((p) => p.diff_ms);
    const avgErr = errors.reduce((a, b) => a + b, 0) / n;

    const excellentCount = this.matchedPairs.filter((p) => p.quality === "Excellent").length;
    const goodCount = this.matchedPairs.filter((p) => p.quality === "Good").length;
    const warningCount = this.matchedPairs.filter((p) => p.quality === "Warning").length;

    let overall = "Warning";
    if (excellentCount / n >= 0.7 && avgErr <= 25) {
      overall = "Excellent";
    } else if ((excellentCount + goodCount) / n >= 0.6) {
      overall = "Good";
    }

    return {
      overall_quality: overall,
      avg_error_ms: +avgErr.toFixed(1),
      excellent_pct: +((excellentCount / n) * 100).toFixed(1),
      good_pct: +((goodCount / n) * 100).toFixed(1),
      warning_pct: +((warningCount / n) * 100).toFixed(1),
      total_samples: n,
    };
  }
}

export const synchronizationService = new SynchronizationService();
export default synchronizationService;
