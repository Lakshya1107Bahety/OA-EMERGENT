// Simulated knee-worn IMU (50 Hz walking signal) for use without hardware.
// Everything recorded from it is marked as simulated/demo.

/**
 * @param {(r: {acc_x:number,acc_y:number,acc_z:number,gyro_x:number,gyro_y:number,gyro_z:number,device_ms:number}) => void} onReading
 * @param {{strideSec?: number, variability?: number}} [opts]
 * @returns {() => void} stop
 */
export function startImuSimulator(onReading, { strideSec = 1.1, variability = 0.04 } = {}) {
  let ms = 0;
  let phase = 0;
  let period = strideSec;
  const noise = (a) => (Math.random() - 0.5) * 2 * a;
  const timer = setInterval(() => {
    for (let k = 0; k < 5; k++) { // 5 samples every 100 ms = 50 Hz
      ms += 20;
      const prev = phase;
      phase += (2 * Math.PI * 0.02) / period;
      if (Math.floor(prev / (2 * Math.PI)) !== Math.floor(phase / (2 * Math.PI))) {
        period = strideSec * (1 + noise(variability)); // new stride, slightly different length
      }
      onReading({
        acc_x: 1.2 * Math.sin(phase) + noise(0.2),
        acc_y: 0.8 * Math.sin(phase + 1) + noise(0.2),
        acc_z: 9.81 + 2.5 * Math.sin(2 * phase) + 1.2 * Math.sin(phase) + noise(0.3),
        gyro_x: 160 * Math.sin(phase) + noise(5),
        gyro_y: 20 * Math.sin(2 * phase) + noise(3),
        gyro_z: 10 * Math.sin(phase + 0.5) + noise(3),
        device_ms: ms,
      });
    }
  }, 100);
  return () => clearInterval(timer);
}
