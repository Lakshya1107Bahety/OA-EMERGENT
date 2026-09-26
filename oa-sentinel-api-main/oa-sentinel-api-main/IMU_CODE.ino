/*
  ========================================================================================
  OA Sentinel — ESP32 + MPU6050 Wearable IMU BLE Firmware
  ========================================================================================
  Hardware:
    - ESP32 Development Board
    - MPU6050 6-DoF IMU Sensor

  Pin Connections:
    - MPU6050 VCC -> ESP32 3.3V
    - MPU6050 GND -> ESP32 GND
    - MPU6050 SDA -> ESP32 GPIO 21
    - MPU6050 SCL -> ESP32 GPIO 22

  Sensor Configuration:
    - Accelerometer range: ±2g (scale factor 16384.0 LSB/g)
    - Gyroscope range:     ±250 deg/s (scale factor 131.0 LSB/(deg/s))
    - Sampling frequency:  50 Hz (20 ms interval)
    - I2C Clock speed:     400 kHz Fast-Mode

  BLE Configuration:
    - Device Name:         OA_IMU
    - BLE Service UUID:    12345678-1234-1234-1234-1234567890ab
    - BLE Char UUID:       abcd1234-5678-90ab-cdef-1234567890ab (NOTIFY, READ)

  Packet CSV Format:
    timestamp,AX,AY,AZ,GX,GY,GZ
    Example: 1250,0.0123,-0.0214,0.9876,0.1520,-0.0830,0.4210
  ========================================================================================
*/

#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SDA_PIN 21
#define SCL_PIN 22
#define MPU6050_ADDR 0x68

#define PWR_MGMT_1   0x6B
#define SMPLRT_DIV   0x19
#define CONFIG       0x1A
#define GYRO_CONFIG  0x1B
#define ACCEL_CONFIG 0x1C
#define ACCEL_XOUT_H 0x3B

#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab"
#define CHARACTERISTIC_UUID "abcd1234-5678-90ab-cdef-1234567890ab"

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

unsigned long lastSampleTime = 0;
const unsigned long sampleInterval = 20; // 50 Hz (20 ms)

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("[BLE] Client connected.");
  }
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("[BLE] Client disconnected. Restarting advertising...");
  }
};

void writeMPU(uint8_t reg, uint8_t data) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(reg);
  Wire.write(data);
  Wire.endTransmission(true);
}

void initMPU6050() {
  Wire.begin(SDA_PIN, SCL_PIN, 400000); // 400 kHz Fast I2C
  delay(100);

  // Wake up MPU6050 (reset sleep mode)
  writeMPU(PWR_MGMT_1, 0x00);
  delay(50);

  // Set sample rate divider (1kHz / (1 + 19) = 50Hz internal DLPF rate)
  writeMPU(SMPLRT_DIV, 19);

  // DLPF Config: 44Hz accel bandwidth, 42Hz gyro bandwidth
  writeMPU(CONFIG, 0x03);

  // Gyroscope config: ±250 deg/s (FS_SEL = 0)
  writeMPU(GYRO_CONFIG, 0x00);

  // Accelerometer config: ±2g (AFS_SEL = 0)
  writeMPU(ACCEL_CONFIG, 0x00);

  Serial.println("[MPU6050] Configured: ±2g, ±250 deg/s, 50 Hz, 400 kHz I2C.");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- OA Sentinel Wearable IMU Booting ---");

  initMPU6050();

  // Initialize BLE
  BLEDevice::init("OA_IMU");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );

  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06); // functions that help with iPhone connections
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Service started. Advertising as 'OA_IMU'...");
}

void loop() {
  unsigned long now = millis();

  // 50 Hz sampling loop
  if (now - lastSampleTime >= sampleInterval) {
    lastSampleTime = now;

    // Read 14 bytes (Accel X, Y, Z, Temp, Gyro X, Y, Z)
    Wire.beginTransmission(MPU6050_ADDR);
    Wire.write(ACCEL_XOUT_H);
    Wire.endTransmission(false);
    Wire.requestFrom(MPU6050_ADDR, 14, true);

    if (Wire.available() >= 14) {
      int16_t rawAX = (Wire.read() << 8) | Wire.read();
      int16_t rawAY = (Wire.read() << 8) | Wire.read();
      int16_t rawAZ = (Wire.read() << 8) | Wire.read();
      Wire.read(); Wire.read(); // Skip temperature
      int16_t rawGX = (Wire.read() << 8) | Wire.read();
      int16_t rawGY = (Wire.read() << 8) | Wire.read();
      int16_t rawGZ = (Wire.read() << 8) | Wire.read();

      // Convert to physical units
      // Accelerometer: ±2g -> 16384 LSB/g
      float ax = (float)rawAX / 16384.0f;
      float ay = (float)rawAY / 16384.0f;
      float az = (float)rawAZ / 16384.0f;

      // Gyroscope: ±250 deg/s -> 131.0 LSB/(deg/s)
      float gx = (float)rawGX / 131.0f;
      float gy = (float)rawGY / 131.0f;
      float gz = (float)rawGZ / 131.0f;

      // Format CSV: timestamp,AX,AY,AZ,GX,GY,GZ
      char packet[72];
      snprintf(packet, sizeof(packet), "%lu,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f",
               now, ax, ay, az, gx, gy, gz);

      if (deviceConnected) {
        pCharacteristic->setValue((uint8_t*)packet, strlen(packet));
        pCharacteristic->notify();
      }

      // Also echo to Serial for debugging/USB mode
      Serial.println(packet);
    }
  }

  // Handle BLE disconnect / reconnect cycle
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // give the bluetooth stack the chance to get things ready
    pServer->startAdvertising(); // restart advertising
    Serial.println("[BLE] Advertising restarted.");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
}
