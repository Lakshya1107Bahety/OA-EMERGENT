// Generates realistic MPU6050-style readings. Higher `severity` (0..1)
// produces more instability / tremor to simulate osteoarthritic movement.
export function makeReading(severity = 0.3) {
  const jitter = () => (Math.random() - 0.5) * 2;
  const tremor = severity * 40;
  const g = 9.81;
  return {
    acc_x: +(jitter() * (1 + severity * 3)).toFixed(3),
    acc_y: +(jitter() * (1 + severity * 3)).toFixed(3),
    acc_z: +(g + jitter() * (0.5 + severity * 2)).toFixed(3),
    gyro_x: +(jitter() * (10 + tremor)).toFixed(3),
    gyro_y: +(jitter() * (10 + tremor)).toFixed(3),
    gyro_z: +(jitter() * (8 + tremor * 0.8)).toFixed(3),
    timestamp: new Date().toISOString(),
  };
}
