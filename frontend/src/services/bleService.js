/**
 * OA Sentinel - Web Bluetooth Service
 * Interfaces with ESP32 + MPU6050 wearable IMU via standard Web Bluetooth API (GATT).
 * 
 * Hardware protocol:
 * - Device Name: OA_IMU
 * - Service UUID: 12345678-1234-1234-1234-1234567890ab
 * - Characteristic UUID: abcd1234-5678-90ab-cdef-1234567890ab
 * - Packet format: UTF-8 CSV: "timestamp,ax,ay,az,gx,gy,gz"
 */

export const BLE_UUIDS = {
  SERVICE: "12345678-1234-1234-1234-1234567890ab",
  CHARACTERISTIC: "abcd1234-5678-90ab-cdef-1234567890ab",
  DEVICE_NAME: "OA_IMU",
  // Nordic UART fallback in case of alternative ESP32 test firmware
  NUS_SERVICE: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  NUS_TX: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
};

export function isWebBluetoothSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
}

class BLEService {
  constructor() {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.isConnected = false;
    this.deviceName = "";
    this.packetCount = 0;
    this.lastPacketTime = 0;
    this.lastHardwareTimestamp = 0;
    this.samplingRateHz = 0;
    this.sampleTimeHistory = [];
    this.listeners = new Set();
    this.disconnectListeners = new Set();
    this.textDecoder = new TextDecoder("utf-8");
    this.buffer = "";
  }

  /**
   * Connect to ESP32 OA_IMU via Web Bluetooth
   */
  async connect() {
    if (!isWebBluetoothSupported()) {
      throw new Error("BLE connection requires a compatible browser/device (Chrome, Edge, Opera with Bluetooth enabled).");
    }

    try {
      // Request device with specific filters for OA_IMU and UUIDs
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: BLE_UUIDS.DEVICE_NAME },
          { services: [BLE_UUIDS.SERVICE] },
        ],
        optionalServices: [BLE_UUIDS.SERVICE, BLE_UUIDS.NUS_SERVICE],
      }).catch(async () => {
        // Fallback filter if name prefix or acceptAllDevices is required
        return await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [BLE_UUIDS.SERVICE, BLE_UUIDS.NUS_SERVICE],
        });
      });

      if (!device || !device.gatt) {
        throw new Error("No compatible Bluetooth device selected.");
      }

      this.device = device;
      this.deviceName = device.name || "OA_IMU";

      // Listen for unexpected GATT disconnect
      device.addEventListener("gattserverdisconnected", this.handleDisconnect.bind(this));

      // Connect to GATT Server
      const server = await device.gatt.connect();
      this.server = server;

      // Locate Service
      let service;
      let charUUID = BLE_UUIDS.CHARACTERISTIC;
      try {
        service = await server.getPrimaryService(BLE_UUIDS.SERVICE);
      } catch (err) {
        // Try fallback NUS service if custom UUID isn't found
        service = await server.getPrimaryService(BLE_UUIDS.NUS_SERVICE);
        charUUID = BLE_UUIDS.NUS_TX;
      }

      // Get Characteristic
      const characteristic = await service.getCharacteristic(charUUID);
      this.characteristic = characteristic;

      // Start Notifications
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", this.handlePacket.bind(this));

      this.isConnected = true;
      this.packetCount = 0;
      this.sampleTimeHistory = [];

      return {
        success: true,
        deviceName: this.deviceName,
        serviceUuid: service.uuid,
        characteristicUuid: characteristic.uuid,
      };
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Handle incoming raw characteristic data
   */
  handlePacket(event) {
    const rawValue = event.target.value;
    const text = this.textDecoder.decode(rawValue);
    this.buffer += text;

    // Split on newline or carriage return
    const lines = this.buffer.split(/\r?\n/);
    // Keep last partial line in buffer
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const packet = this.parseCSVLine(trimmed);
      if (packet) {
        this.updateDiagnostics(packet);
        this.notifyListeners(packet);
      }
    }
  }

  /**
   * Parse CSV format: timestamp,ax,ay,az,gx,gy,gz
   */
  parseCSVLine(line) {
    // If sent as JSON
    if (line.startsWith("{")) {
      try {
        const obj = JSON.parse(line);
        return {
          timestamp: Number(obj.timestamp ?? obj.t ?? Date.now()),
          ax: Number(obj.ax ?? obj.acc_x ?? 0),
          ay: Number(obj.ay ?? obj.acc_y ?? 0),
          az: Number(obj.az ?? obj.acc_z ?? 0),
          gx: Number(obj.gx ?? obj.gyro_x ?? 0),
          gy: Number(obj.gy ?? obj.gyro_y ?? 0),
          gz: Number(obj.gz ?? obj.gyro_z ?? 0),
          local_timestamp: performance.now(),
        };
      } catch {
        return null;
      }
    }

    const tokens = line.split(/[,\s]+/).map(Number);
    if (tokens.length >= 7 && tokens.every((n) => !Number.isNaN(n))) {
      return {
        timestamp: tokens[0],
        ax: tokens[1],
        ay: tokens[2],
        az: tokens[3],
        gx: tokens[4],
        gy: tokens[5],
        gz: tokens[6],
        local_timestamp: performance.now(),
      };
    } else if (tokens.length === 6 && tokens.every((n) => !Number.isNaN(n))) {
      // 6-axis without timestamp: generate monotonic timestamp
      return {
        timestamp: Math.round(performance.now()),
        ax: tokens[0],
        ay: tokens[1],
        az: tokens[2],
        gx: tokens[3],
        gy: tokens[4],
        gz: tokens[5],
        local_timestamp: performance.now(),
      };
    }
    return null;
  }

  /**
   * Calculate live frequency and packet diagnostics
   */
  updateDiagnostics(packet) {
    this.packetCount += 1;
    this.lastPacketTime = Date.now();
    this.lastHardwareTimestamp = packet.timestamp;

    const now = performance.now();
    this.sampleTimeHistory.push(now);
    if (this.sampleTimeHistory.length > 50) {
      this.sampleTimeHistory.shift();
    }

    if (this.sampleTimeHistory.length >= 10) {
      const dtSec = (this.sampleTimeHistory[this.sampleTimeHistory.length - 1] - this.sampleTimeHistory[0]) / 1000;
      if (dtSec > 0) {
        this.samplingRateHz = Math.round((this.sampleTimeHistory.length - 1) / dtSec);
      }
    }
  }

  notifyListeners(packet) {
    for (const listener of this.listeners) {
      try {
        listener(packet);
      } catch (err) {
        console.error("BLE packet subscriber error:", err);
      }
    }
  }

  onReading(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onDisconnect(callback) {
    this.disconnectListeners.add(callback);
    return () => this.disconnectListeners.delete(callback);
  }

  handleDisconnect() {
    this.isConnected = false;
    for (const listener of this.disconnectListeners) {
      try {
        listener();
      } catch {}
    }
    this.cleanup();
  }

  disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      try {
        this.device.gatt.disconnect();
      } catch {}
    }
    this.handleDisconnect();
  }

  cleanup() {
    this.isConnected = false;
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.buffer = "";
  }

  getStatus() {
    return {
      supported: isWebBluetoothSupported(),
      connected: this.isConnected,
      deviceName: this.deviceName || "OA_IMU",
      packetCount: this.packetCount,
      samplingRateHz: this.samplingRateHz || 0,
      lastTimestamp: this.lastHardwareTimestamp,
      lastReceivedAt: this.lastPacketTime,
    };
  }
}

export const bleService = new BLEService();
export default bleService;
