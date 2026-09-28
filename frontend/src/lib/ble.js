// Web Bluetooth helper for the ESP32 + MPU6050 wearable.
//
// Supported GATT layouts:
//   1. OA_IMU firmware (firmware/ESP32_MPU6050_OA_IMU.ino):
//        service 12345678-1234-1234-1234-1234567890ab, notify char abcd1234-5678-90ab-cdef-1234567890ab
//        packet  "millis,ax,ay,az,gx,gy,gz"  (accel in g, gyro in deg/s, no newline)
//   2. Nordic UART Service (NUS) sketches, e.g. the standalone BLE serial monitor.
//   3. USB cable (Web Serial, connectSerial): the text lines the firmware prints
//      on the serial port at 115200 baud, same as the Arduino Serial Monitor.
//
// Accepted packet formats:
//   17-byte binary [0xA5][uint32 ms][int16 ax ay az gx gy gz] (current firmware default)
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

// Compact binary packet from the OA_IMU firmware (BLE_BINARY_PACKETS = 1):
// [0xA5][uint32 ms][int16 ax ay az gx gy gz], little-endian, 17 bytes.
const BIN_MARKER = 0xa5;
const BIN_LENGTH = 17;
const ACC_LSB_PER_G = 16384;
const GYRO_LSB_PER_DPS = 131;
const DEFAULT_MTU_PAYLOAD = 20;

export function decodeBinaryPacket(bytes) {
  if (bytes.length !== BIN_LENGTH || bytes[0] !== BIN_MARKER) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const raw = [0, 1, 2, 3, 4, 5].map((i) => dv.getInt16(5 + i * 2, true));
  return {
    reading: {
      acc_x: raw[0] / ACC_LSB_PER_G, acc_y: raw[1] / ACC_LSB_PER_G, acc_z: raw[2] / ACC_LSB_PER_G,
      gyro_x: raw[3] / GYRO_LSB_PER_DPS, gyro_y: raw[4] / GYRO_LSB_PER_DPS, gyro_z: raw[5] / GYRO_LSB_PER_DPS,
      timestamp: new Date().toISOString(),
      device_ms: dv.getUint32(1, true), // ESP32 clock: lets the app count dropped samples
    },
    deviceMs: dv.getUint32(1, true),
  };
}
const G = 9.80665;
const MAX_BUFFER = 1024;
const UNIT_SAMPLES = 10; // readings used to lock the accelerometer unit

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");

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

// "AX:0.1 AY:0.2", "Acceleration X: 0.1, Y: 0.2", "gyro_x=3",
// "Acc(g): X=0.01 Y=0.02 Z=1.00 | Gyro(°/s): X=1.2 Y=0.3 Z=-0.4" ...
// A bare "Acc"/"Gyro" word (e.g. before "(g):") sets the group for the X/Y/Z that follow.
function parseLabelled(t) {
  const re = /([A-Za-z][A-Za-z_ ]*?)\s*[:=]\s*(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)|\b(acc|gyr|rot)/gi;
  const radians = /rad/i.test(t);
  const out = {};
  let group = null;
  let found = 0;
  let m;
  while ((m = re.exec(t))) {
    if (m[3]) {
      group = m[3].toLowerCase() === "acc" ? "acc" : "gyro";
      continue;
    }
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

/** Boot/status text such as "BLE service started..." (no numeric readings in it). */
export function isStatusLine(t) {
  return !/\d\s*[,=:]|[=:]\s*-?\d/.test(t);
}

function parseNumeric(t) {
  let parts = t.split(/[,;\s|]+/).filter(Boolean).map(Number);
  if (parts.some((n) => !Number.isFinite(n))) parts = parts.filter((n) => Number.isFinite(n));
  // "millis,ax,ay,az,gx,gy,gz" from the OA_IMU firmware: keep the ESP32 clock
  let deviceMs = null;
  if (parts.length === 7 && Number.isInteger(parts[0]) && parts[0] >= 0) {
    deviceMs = parts[0];
    parts = parts.slice(1);
  }
  if (parts.length < 6) return null;
  const r = {};
  AXIS_KEYS.forEach((k, i) => (r[k] = parts[i]));
  const out = toReading(r);
  if (deviceMs != null) out.device_ms = deviceMs;
  return out;
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

  const deliver = (packet, byteLength) => {
    const r = parsePacket(packet);
    // A text packet of exactly 20 bytes that doesn't parse was almost certainly
    // cut off by the default BLE packet size (firmware without binary mode).
    const truncated = !r && byteLength === DEFAULT_MTU_PAYLOAD;
    if (onRaw) onRaw(packet, !!r, { truncated, info: !r && !truncated && isStatusLine(packet) });
    if (r && onReading) onReading(normalize(r));
  };

  const handler = (e) => {
    const v = e.target.value;
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);

    const bin = decodeBinaryPacket(bytes);
    if (bin) {
      const r = bin.reading;
      if (onRaw) {
        const f = (x) => x.toFixed(3);
        onRaw(`[bin] t=${bin.deviceMs} a=${f(r.acc_x)},${f(r.acc_y)},${f(r.acc_z)}g g=${f(r.gyro_x)},${f(r.gyro_y)},${f(r.gyro_z)}°/s`, true, { truncated: false });
      }
      if (onReading) onReading(normalize(r));
      return;
    }

    // Binary data that is not our 17-byte packet: show it as hex so it can be identified.
    if (bytes.some((b) => b < 9 || (b > 13 && b < 32) || b === 127)) {
      if (onRaw) onRaw(`[hex ${bytes.length} B] ${toHex(bytes)}`, false, { truncated: false });
      return;
    }

    const chunk = decoder.decode(bytes, { stream: true });
    if (/[\r\n]/.test(chunk)) lineMode = true;

    // One reading per notification, no newline (OA_IMU firmware)
    if (!lineMode) {
      if (chunk.trim()) deliver(chunk.trim(), bytes.byteLength);
      return;
    }

    buffer += chunk;
    const lines = buffer.split(/\r?\n|\r/);
    buffer = lines.pop();
    if (buffer.length > MAX_BUFFER) buffer = "";
    lines.forEach((l) => l.trim() && deliver(l.trim(), 0));
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

// ---- USB serial (Web Serial API, Chrome/Edge on desktop) ------------------
// Reads the same "millis,ax,ay,az,gx,gy,gz" lines the Arduino Serial Monitor
// shows. Only one program can open the port: close the Arduino Serial Monitor first.
export function serialSupported() {
  return typeof navigator !== "undefined" && !!navigator.serial;
}

export async function connectSerial({ onReading, onRaw, onDisconnect, baudRate = 115200 }) {
  if (!serialSupported()) throw new Error("USB serial needs Chrome or Edge on a computer.");
  const port = await navigator.serial.requestPort();
  try {
    await port.open({ baudRate });
  } catch (e) {
    throw new Error("Couldn't open the USB port. Close the Arduino Serial Monitor (or any other program using it) and try again.");
  }

  const decoder = new TextDecoder();
  const normalize = createUnitNormalizer();
  let buffer = "";
  let userClosed = false;
  let reader = null;

  const handleLine = (line) => {
    const t = line.trim();
    if (!t) return;
    const r = parsePacket(t);
    // Boot and status messages such as "[BLE] Advertising..." are not data.
    const info = !r && isStatusLine(t);
    if (onRaw) onRaw(t, !!r, { truncated: false, info });
    if (r && onReading) onReading(normalize(r));
  };

  (async () => {
    try {
      while (port.readable && !userClosed) {
        reader = port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n|\r/);
            buffer = lines.pop();
            if (buffer.length > MAX_BUFFER) buffer = "";
            lines.forEach(handleLine);
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch {
      // cable unplugged or device reset: handled below
    }
    try { await port.close(); } catch {}
    if (!userClosed && onDisconnect) onDisconnect();
  })();

  return {
    deviceName: "ESP32 (USB cable)",
    profile: "USB serial",
    disconnect: () => {
      userClosed = true;
      try { reader?.cancel(); } catch {}
    },
  };
}
