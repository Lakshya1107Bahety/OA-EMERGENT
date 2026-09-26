/**
 * OA Sentinel - IMU Kinematic Analysis Service
 * Calculates real-time physical features: RMS, variance, peak, angular velocity,
 * movement smoothness, jerk, and step periodicity from MPU6050 readings.
 */

class IMUService {
  constructor() {
    this.buffer = [];
    this.maxBufferSize = 600; // ~12 seconds at 50Hz
  }

  addReading(packet) {
    this.buffer.push(packet);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  clear() {
    this.buffer = [];
  }

  getRecentReadings(count = 50) {
    return this.buffer.slice(-count);
  }

  /**
   * Extract clinical IMU feature vector from window of readings
   */
  extractFeatures(readings = null) {
    const data = readings || this.buffer;
    if (!data || data.length === 0) {
      return {
        accel_variance: 0.0,
        accel_rms: 0.0,
        peak_accel: 0.0,
        gyro_variance: 0.0,
        gyro_rms: 0.0,
        angular_velocity: 0.0,
        movement_smoothness: 100.0,
        jerk: 0.0,
        step_periodicity: 100.0,
        count: 0,
      };
    }

    const n = data.length;
    const ax = data.map((d) => d.ax || 0);
    const ay = data.map((d) => d.ay || 0);
    const az = data.map((d) => d.az || 0);
    const gx = data.map((d) => d.gx || 0);
    const gy = data.map((d) => d.gy || 0);
    const gz = data.map((d) => d.gz || 0);

    // Resultant magnitude
    const accMags = data.map((d, i) => Math.sqrt(ax[i] ** 2 + ay[i] ** 2 + az[i] ** 2));
    const gyroMags = data.map((d, i) => Math.sqrt(gx[i] ** 2 + gy[i] ** 2 + gz[i] ** 2));

    // Means
    const meanAcc = accMags.reduce((a, b) => a + b, 0) / n;
    const meanGyro = gyroMags.reduce((a, b) => a + b, 0) / n;

    // Variance
    const accVar = accMags.reduce((acc, v) => acc + (v - meanAcc) ** 2, 0) / (n > 1 ? n - 1 : 1);
    const gyroVar = gyroMags.reduce((acc, v) => acc + (v - meanGyro) ** 2, 0) / (n > 1 ? n - 1 : 1);

    // RMS
    const accRms = Math.sqrt(accMags.reduce((acc, v) => acc + v ** 2, 0) / n);
    const gyroRms = Math.sqrt(gyroMags.reduce((acc, v) => acc + v ** 2, 0) / n);

    // Peak
    const peakAcc = Math.max(...accMags);

    // Jerk (finite difference approximation dt = 0.02s at 50Hz)
    let jerk = 0;
    if (n > 1) {
      const jerkSqSum = accMags.slice(1).reduce((sum, v, idx) => {
        const dj = (v - accMags[idx]) / 0.02;
        return sum + dj ** 2;
      }, 0);
      jerk = Math.sqrt(jerkSqSum / (n - 1));
    }

    // Movement smoothness (0 - 100%)
    const smoothness = Math.max(0, Math.min(100, +(100 - (jerk / 30) * 100).toFixed(1)));

    // Periodicity estimation via autocorrelation
    let periodicity = 85.0;
    if (n >= 40) {
      const centered = accMags.map((v) => v - meanAcc);
      let autoCorrLag = 0;
      let maxCorr = -1;
      for (let lag = 12; lag <= 35; lag++) {
        let corr = 0;
        for (let i = 0; i < n - lag; i++) {
          corr += centered[i] * centered[i + lag];
        }
        if (corr > maxCorr) {
          maxCorr = corr;
          autoCorrLag = lag;
        }
      }
      const zeroLagCorr = centered.reduce((acc, v) => acc + v ** 2, 0) || 1;
      periodicity = Math.max(0, Math.min(100, +(Math.max(0, maxCorr / zeroLagCorr) * 100).toFixed(1)));
    }

    return {
      accel_variance: +accVar.toFixed(4),
      accel_rms: +accRms.toFixed(4),
      peak_accel: +peakAcc.toFixed(4),
      gyro_variance: +gyroVar.toFixed(4),
      gyro_rms: +gyroRms.toFixed(4),
      angular_velocity: +meanGyro.toFixed(2),
      movement_smoothness: smoothness,
      jerk: +jerk.toFixed(2),
      step_periodicity: periodicity,
      count: n,
    };
  }
}

export const imuService = new IMUService();
export default imuService;
