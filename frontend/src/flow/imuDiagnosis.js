// Plain-language reason when a connected IMU gives no usable data.

const NO_DATA_AFTER_MS = 3000;

/** Plain-language reason when a connected device gives no usable data. */
export function diagnose({ connected, source, stats, sinceConnectMs, sample }) {
  if (!connected || source === "simulator" || sinceConnectMs < NO_DATA_AFTER_MS) return null;
  if (stats.received === 0) {
    return source === "usb"
      ? { title: "The USB port is open but nothing is arriving.", tips: [
          "Check the cable is a data cable (some charge-only cables carry no data).",
          "Press the EN/RESET button on the ESP32 once.",
          "Make sure the sketch uses Serial.begin(115200).",
        ] }
      : { title: "Connected, but the ESP32 is sending nothing over Bluetooth.", tips: [
          "Check you picked the right device in the Bluetooth list (OA_IMU).",
          "Open the Arduino Serial Monitor: it should print \"[BLE] Client connected.\" and a line of numbers every 20 ms. If the numbers are missing, the MPU6050 wiring (SDA 21, SCL 22) is the problem.",
          "Re-flash firmware/ESP32_MPU6050_OA_IMU.ino from the repository.",
          "Or connect with the USB cable instead (button above).",
        ] };
  }
  if (stats.decoded === 0 && stats.truncated > 0) {
    return { title: "Packets are arriving but are cut off at 20 bytes.", tips: [
      "The ESP32 sends text lines longer than 20 bytes, and Bluetooth only delivers the first 20 unless the sketch raises the packet size.",
      "Easiest fix without changing the sketch: connect with the USB cable instead (button above). USB has no 20-byte limit.",
      "Or flash firmware/ESP32_MPU6050_OA_IMU.ino, which sends 17-byte binary packets that always fit.",
    ] };
  }
  if (stats.decoded === 0 && stats.unrecognised > 0) {
    return { title: "Data is arriving, but in a format the app doesn't recognise.", tips: [
      `Example of what arrived: ${sample || "(see the serial monitor below)"}`,
      "Expected: \"ax,ay,az,gx,gy,gz\" or \"millis,ax,ay,az,gx,gy,gz\" per line, or the 17-byte binary packet.",
      "Re-flash firmware/ESP32_MPU6050_OA_IMU.ino, or send the example above so the app can be taught this format.",
    ] };
  }
  return null;
}
