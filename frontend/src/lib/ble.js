// Web Bluetooth helper for ESP32 + MPU6050 using the Nordic UART Service (NUS).
// ESP32 sketch is expected to notify comma or space separated values:
//   "ax,ay,az,gx,gy,gz"  (accel m/s^2, gyro deg/s)  — JSON objects are also accepted.

const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify (device -> app)

export function bleSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

function parseLine(text) {
  const t = text.trim();
  if (!t) return null;
  if (t.startsWith("{")) {
    try {
      const o = JSON.parse(t);
      return {
        acc_x: +o.acc_x || +o.ax || 0, acc_y: +o.acc_y || +o.ay || 0, acc_z: +o.acc_z || +o.az || 0,
        gyro_x: +o.gyro_x || +o.gx || 0, gyro_y: +o.gyro_y || +o.gy || 0, gyro_z: +o.gyro_z || +o.gz || 0,
        timestamp: new Date().toISOString(),
      };
    } catch { return null; }
  }
  const parts = t.split(/[,\s]+/).map(Number).filter((n) => !Number.isNaN(n));
  if (parts.length >= 6) {
    return {
      acc_x: parts[0], acc_y: parts[1], acc_z: parts[2],
      gyro_x: parts[3], gyro_y: parts[4], gyro_z: parts[5],
      timestamp: new Date().toISOString(),
    };
  }
  return null;
}

export async function connectBLE({ onReading, onDisconnect }) {
  if (!bleSupported()) throw new Error("Web Bluetooth not supported in this browser");
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [NUS_SERVICE],
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(NUS_SERVICE);
  const ch = await service.getCharacteristic(NUS_TX);
  await ch.startNotifications();
  const decoder = new TextDecoder();
  const handler = (e) => {
    const r = parseLine(decoder.decode(e.target.value));
    if (r && onReading) onReading(r);
  };
  ch.addEventListener("characteristicvaluechanged", handler);
  const onGattDisc = () => onDisconnect && onDisconnect();
  device.addEventListener("gattserverdisconnected", onGattDisc);

  return {
    deviceName: device.name || "ESP32 Device",
    disconnect: () => {
      try { ch.removeEventListener("characteristicvaluechanged", handler); } catch {}
      try { device.removeEventListener("gattserverdisconnected", onGattDisc); } catch {}
      try { device.gatt.disconnect(); } catch {}
    },
  };
}
