/**
 * OA Sentinel - Domain Types & Data Contracts
 * Defines strict types for Camera, ESP32 MPU6050, Multimodal Sync, and OA Risk Profile.
 */

/**
 * @typedef {Object} Patient
 * @property {string} id - Unique patient identifier (e.g., 'OA-2026-081')
 * @property {number} age - Patient age in years
 * @property {('Male'|'Female'|'Other')} sex - Biological sex / gender
 * @property {number} height_cm - Height in centimeters
 * @property {number} weight_kg - Body mass in kilograms
 * @property {number} bmi - Calculated Body Mass Index
 * @property {('Left'|'Right'|'Bilateral'|'None')} affected_side - Affected limb
 * @property {number} pain_score - VAS pain score (0 - 10)
 * @property {string} pain_duration - Duration of pain symptoms
 * @property {boolean} previous_oa - Prior clinical OA diagnosis
 * @property {string} previous_injury - Prior knee trauma or surgery
 * @property {('Sedentary'|'Lightly Active'|'Moderately Active'|'High')} activity_level
 * @property {string[]} planned_assessments - Selected functional protocols
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} IMUPacket
 * @property {number} timestamp - Hardware millisecond timestamp from ESP32 millis()
 * @property {number} ax - Acceleration X (g)
 * @property {number} ay - Acceleration Y (g)
 * @property {number} az - Acceleration Z (g)
 * @property {number} gx - Angular Velocity X (deg/s)
 * @property {number} gy - Angular Velocity Y (deg/s)
 * @property {number} gz - Angular Velocity Z (deg/s)
 * @property {number} [local_timestamp] - Browser performance.now() at packet receipt
 */

/**
 * @typedef {Object} CameraFeatures
 * @property {number} right_knee_rom_deg - Right knee Range of Motion (degrees)
 * @property {number} left_knee_rom_deg - Left knee Range of Motion (degrees)
 * @property {number} right_hip_rom_deg - Right hip Range of Motion (degrees)
 * @property {number} left_hip_rom_deg - Left hip Range of Motion (degrees)
 * @property {number} step_duration_sec - Step duration (seconds)
 * @property {number} stride_duration_sec - Stride duration (seconds)
 * @property {number} cadence_steps_min - Gait cadence (steps / minute)
 * @property {number} knee_rom_asymmetry_pct - Knee ROM asymmetry percentage
 * @property {number} step_time_asymmetry_pct - Step-time asymmetry percentage
 * @property {number} trunk_lean_deg - Trunk lateral tilt angle (degrees)
 * @property {number} [walking_velocity] - Estimated walking velocity (m/s)
 * @property {number} [stance_time] - Stance phase duration (seconds)
 * @property {number} [swing_time] - Swing phase duration (seconds)
 */

/**
 * @typedef {Object} SyncSample
 * @property {number} camera_timestamp - Milliseconds timestamp of video frame
 * @property {number} imu_timestamp - Milliseconds timestamp of nearest IMU reading
 * @property {number} diff_ms - Temporal offset error (|t_cam - t_imu|)
 * @property {('Excellent'|'Good'|'Warning')} quality - Synchronization quality
 * @property {Object} frame_pose - Key landmarks snapshot
 * @property {IMUPacket} imu_vector - Synchronized 6-DoF sensor vector
 */

/**
 * @typedef {Object} FeatureContribution
 * @property {string} feature - Feature name
 * @property {number} patient_value - Measured value
 * @property {number} reference_mean - Healthy cohort baseline mean
 * @property {number} impact - Signed SHAP-like contribution score
 * @property {('↑'|'↓')} direction - Contribution direction
 * @property {string} label - Display label
 * @property {string} interpretation - Clinical model interpretation
 */

/**
 * @typedef {Object} OARiskProfile
 * @property {number} screening_score - Overall prototype risk score (0 - 100)
 * @property {('LOW PROTOTYPE RISK'|'MODERATE PROTOTYPE RISK'|'HIGH PROTOTYPE RISK')} risk_category
 * @property {Object} sub_scores - Sub-domain scores (0 - 100)
 * @property {FeatureContribution[]} feature_contributions - SHAP-style explainability list
 * @property {Object} comparison - Camera vs IMU side-by-side comparison
 * @property {number} multimodal_confidence - Model confidence percentage
 * @property {number} trials_analyzed - Number of analyzed functional movement trials
 * @property {string} disclaimer - Mandatory screening prototype notice
 */

export const BLE_CONFIG = {
  DEVICE_NAME: "OA_IMU",
  SERVICE_UUID: "12345678-1234-1234-1234-1234567890ab",
  CHARACTERISTIC_UUID: "abcd1234-5678-90ab-cdef-1234567890ab",
  SAMPLING_FREQ_HZ: 50,
  ACCEL_RANGE: "±2g",
  GYRO_RANGE: "±250 deg/s",
  I2C_CLOCK: "400 kHz",
};

export const MANDATORY_DISCLAIMER =
  "OA Sentinel provides an AI-assisted screening/risk assessment and does not replace clinical diagnosis. OA Sentinel is a research and prototype screening system. It does not diagnose osteoarthritis, replace a physician, or provide medical treatment recommendations.";
