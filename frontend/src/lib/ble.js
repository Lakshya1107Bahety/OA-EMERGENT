// Web Bluetooth helper for the ESP32 + MPU6050 wearable.
//
// Supported GATT layouts:
//   1. OA_IMU firmware (firmware/ESP32_MPU6050_OA_IMU.ino):
//        service 12345678-1234-1234-1234-1234567890ab, notify char abcd1234-5678-90ab-cdef-1234567890ab
//        packet  "millis,ax,ay,az,gx,gy,gz"  (accel in g, gyro in deg/s, no newline)
//   2. Nordic UART Service (NUS) sketches, e.g. the standalone BLE serial monitor.
//
// Accepted packet formats:
//   "ax,ay,az,gx,gy,gz"  or  "millis,ax,ay,az,gx,gy,gz"
//   {"ax":..,"ay":..,"az":..,"gx":..,"gy":..,"gz":..}    (acc_x / gyro_x keys also work)
//   "AX:0.1 AY:0.2 AZ:9.8 GX:1 GY:2 GZ:3"                (key:value or key=value labels)
//
// Accelerometer units are auto-detected: the app works in m/s^2, so readings
// whose gravity magnitude is ~1 (i.e. in g) are multiplied by 9.80665.
//
// At the default BLE MTU a notification carries only 20 bytes, so a packet can
// arrive in pieces. Newline-terminated streams are buffered per line; packets
// without newlines are treated as one reading per notification.

const OA_IMU_SERVICE = "12345678-1234-1234-1234-1234567890ab";
const OA_IMU_CHAR = "abcd1234-5678-90ab-cdef-1234567890ab";
const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify (device -> app)

const AXIS_KEYS = ["acc_x", "acc_y", "acc_z", "gyro_x", "gyro_y", "gyro_z"];
const G = 9.80665;
const MAX_BUFFER = 1024;
const UNIT_SAMPLES = 10; // readings used to lock the accelerometer unit

export function bleSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

const num = (v) => (v === undefined || v === null || v === "" ? NaN : Number(v));
const complete = (o) => AXIS_KEYS.every((k) => Number.isFinite(o[k]));

function toReading(o) {
  const r = {};
  AXIS_KEYS.forEach((k) => (r[k] = o[k]));
  r.timestamp = new Date().toISOString();
  return r;
}

function parseJSON(t) {
  let o;
  try { o = JSON.parse(t); } catch { return null; }
  const pick = (...keys) => {
    for (const k of keys) if (Number.isFinite(num(o[k]))) return num(o[k]);
    return NaN;
  };
  const r = {
    acc_x: pick("acc_x", "ax", "accX", "AccX"), acc_y: pick("acc_y", "ay", "accY", "AccY"),
    acc_z: pick("acc_z", "az", "accZ", "AccZ"), gyro_x: pick("gyro_x", "gx", "gyroX", "GyroX"),
    gyro_y: pick("gyro_y", "gy", "gyroY", "GyroY"), gyro_z: pick("gyro_z", "gz", "gyroZ", "GyroZ"),
  };
  return complete(r) ? toReading(r) : null;
}

// "AX:0.1 AY:0.2", "Acceleration X: 0.1, Y: 0.2", "gyro_x=3" ...
function parseLabelled(t) {
  const re = /([A-Za-z][A-Za-z_ ]*?)\s*[:=]\s*(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/g;
  const radians = /rad/i.test(t);
  const out = {};
  let group = null;
  let found = 0;
  let m;
  while ((m = re.exec(t))) {
    const key = m[1].toLowerCase().replace(/[^a-z]/g, "");
    if (key.includes("acc")) group = "acc";
    else if (key.includes("gyr") || key.includes("rot")) group = "gyro";
    else if (key.length === 2 && key[0] === "a") group = "acc";
    else if (key.length === 2 && key[0] === "g") group = "gyro";
    else if (key.length !== 1) continue; // e.g. "temperature"
    const axis = key[key.length - 1];
    if (!group || !"xyz".includes(axis)) continue;
    let v = Number(m[2]);
    if (group === "gyro" && radians) v *= 180 / Math.PI;
    out[`${group}_${axis}`] = v;
    found += 1;
  }
  if (!found) return undefined; // not a labelled packet
  return complete(out) ? toReading(out) : null;
}

function parseNumeric(t) {
  let parts = t.split(/[,;\s|]+/).filter(Boolean).map(Number);
  if (parts.some((n) => !Number.isFinite(n))) parts = parts.filter((n) => Number.isFinite(n));
  // "millis,ax,ay,az,gx,gy,gz" from the OA_IMU firmware: drop the timestamp
  if (parts.length === 7 && Number.isInteger(parts[0]) && parts[0] >= 0) parts = parts.slice(1);
  if (parts.length < 6) return null;
  const r = {};
  AXIS_KEYS.forEach((k, i) => (r[k] = parts[i]));
  return toReading(r);
}

export function parsePacket(text) {
  const t = text.trim();
  if (!t) return null;
  if (t.startsWith("{")) return parseJSON(t);
  const labelled = parseLabelled(t);
  if (labelled !== undefined) return labelled;
  return parseNumeric(t);
}

// Converts accelerometer values from g to m/s^2 when the sensor reports in g.
// The unit is locked from the median gravity magnitude of the first readings
// (±2g range tops out at ~3.5 g, while m/s^2 at rest reads ~9.8).
export function createUnitNormalizer() {
  const mags = [];
  let inG = null;
  return (r) => {
    const mag = Math.hypot(r.acc_x, r.acc_y, r.acc_z);
    let useG = inG;
    if (useG === null) {
      mags.push(mag);
      useG = mag < 4;
      if (mags.length >= UNIT_SAMPLES) {
        const sorted = [...mags].sort((a, b) => a - b);
        inG = sorted[Math.floor(sorted.length / 2)] < 4;
      }
    }
    if (!useG) return r;
    return { ...r, acc_x: +(r.acc_x * G).toFixed(4), acc_y: +(r.acc_y * G).toFixed(4), acc_z: +(r.acc_z * G).toFixed(4) };
  };
}

async function openNotifyCharacteristic(server) {
  try {
    const svc = await server.getPrimaryService(OA_IMU_SERVICE);
    return { ch: await svc.getCharacteristic(OA_IMU_CHAR), profile: "OA_IMU" };
  } catch {}
  try {
    const svc = await server.getPrimaryService(NUS_SERVICE);
    return { ch: await svc.getCharacteristic(NUS_TX), profile: "Nordic UART" };
  } catch {}
  throw new Error(
    "Connected, but no IMU data service was found. Flash firmware/ESP32_MPU6050_OA_IMU.ino or a Nordic UART sketch."
  );
}

export async function connectBLE({ onReading, onRaw, onDisconnect }) {
  if (!bleSupported()) throw new Error("Web Bluetooth not supported in this browser");
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [OA_IMU_SERVICE, NUS_SERVICE],
  });
  const server = await device.gatt.connect();
  let ch;
  let profile;
  try {
    ({ ch, profile } = await openNotifyCharacteristic(server));
    await ch.startNotifications();
  } catch (e) {
    try { device.gatt.disconnect(); } catch {}
    throw e;
  }

  const decoder = new TextDecoder();
  const normalize = createUnitNormalizer();
  let buffer = "";
  let lineMode = false;

  const deliver = (packet) => {
    const r = parsePacket(packet);
    if (onRaw) onRaw(packet, !!r);
    if (r && onReading) onReading(normalize(r));
  };

  const handler = (e) => {
    const v = e.target.value;
    const chunk = decoder.decode(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), { stream: true });
    if (/[\r\n]/.test(chunk)) lineMode = true;

    // One reading per notification, no newline (OA_IMU firmware)
    if (!lineMode) {
      if (chunk.trim()) deliver(chunk.trim());
      return;
    }

    buffer += chunk;
    const lines = buffer.split(/\r?\n|\r/);
    buffer = lines.pop();
    if (buffer.length > MAX_BUFFER) buffer = "";
    lines.forEach((l) => l.trim() && deliver(l.trim()));
  };
  ch.addEventListener("characteristicvaluechanged", handler);
  const onGattDisc = () => onDisconnect && onDisconnect();
  device.addEventListener("gattserverdisconnected", onGattDisc);

  return {
    deviceName: device.name || "ESP32 Device",
    profile,
    disconnect: () => {
      try { ch.removeEventListener("characteristicvaluechanged", handler); } catch {}
      try { device.removeEventListener("gattserverdisconnected", onGattDisc); } catch {}
      try { device.gatt.disconnect(); } catch {}
    },
  };
}
