// Skeleton Mapper - Maps MediaPipe pose landmarks to 3D jacket model
// This is the critical component that makes the jacket follow the user's body

class SkeletonMapper {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.initialized = false;
        this.lastPose = null;
        
        // Smoothing parameters
        this.smoothingFactor = 0.3; // 0 = no smoothing, 1 = max smoothing
        this.lastPosition = { x: 0, y: 0, z: 0 };
        this.lastRotation = { x: 0, y: 0, z: 0 };
        this.lastScale = 1.0;
        
        // Calibration values (adjust based on testing)
        this.calibration = {
            scaleMultiplier: 8.0,    // How much to scale based on shoulder width
            depthMultiplier: -5.0,   // Z-axis positioning
            verticalOffset: -1.0,    // Y-axis offset (negative = up)
            horizontalOffset: 0.0,   // X-axis offset
        };
    }

    /**
     * Initialize the skeleton mapper
     */
    init(width, height) {
        this.width = width;
        this.height = height;
        this.initialized = true;
        console.log("✅ SkeletonMapper initialized:", width, "x", height);
    }

    /**
     * Update jacket position/rotation/scale based on pose data
     */
    update(poseData) {
        if (!this.initialized || !poseData) return;

        const jacket = modelLoader.getModel();
        if (!jacket || !jacket.visible) return;

        const landmarks = poseData.landmarks;
        if (!landmarks || landmarks.length < 33) return;

        try {
            // Get key body points
            const leftShoulder = landmarks[CONFIG.SKELETON.LANDMARKS.LEFT_SHOULDER];
            const rightShoulder = landmarks[CONFIG.SKELETON.LANDMARKS.RIGHT_SHOULDER];
            const leftHip = landmarks[CONFIG.SKELETON.LANDMARKS.LEFT_HIP];
            const rightHip = landmarks[CONFIG.SKELETON.LANDMARKS.RIGHT_HIP];
            const nose = landmarks[CONFIG.SKELETON.LANDMARKS.NOSE];

            // Check visibility
            if (!this.arePointsVisible([leftShoulder, rightShoulder, leftHip, rightHip])) {
                return;
            }

            // Calculate transformations
            const position = this.calculatePosition(leftShoulder, rightShoulder, leftHip, rightHip);
            const rotation = this.calculateRotation(leftShoulder, rightShoulder, nose);
            const scale = this.calculateScale(leftShoulder, rightShoulder);

            // Apply smoothing
            const smoothedPosition = this.smoothPosition(position);
            const smoothedRotation = this.smoothRotation(rotation);
            const smoothedScale = this.smoothScale(scale);

            // Apply to jacket
            jacket.position.set(smoothedPosition.x, smoothedPosition.y, smoothedPosition.z);
            jacket.rotation.set(smoothedRotation.x, smoothedRotation.y, smoothedRotation.z);
            jacket.scale.set(smoothedScale, smoothedScale, smoothedScale);

            this.lastPose = poseData;

        } catch (error) {
            console.error('Error updating skeleton:', error);
        }
    }

    /**
     * Calculate 3D position for the jacket
     */
    calculatePosition(leftShoulder, rightShoulder, leftHip, rightHip) {
        // Calculate shoulder center (where jacket should be positioned)
        const shoulderCenter = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2,
            z: (leftShoulder.z + rightShoulder.z) / 2
        };

        // Convert normalized coordinates (0-1) to 3D world space (-5 to 5)
        const x = (shoulderCenter.x - 0.5) * 10 + this.calibration.horizontalOffset;
        const y = -(shoulderCenter.y - 0.5) * 10 + this.calibration.verticalOffset;
        const z = this.calibration.depthMultiplier + (shoulderCenter.z * 2);

        return { x, y, z };
    }

    /**
     * Calculate rotation for the jacket
     */
    calculateRotation(leftShoulder, rightShoulder, nose) {
        // Calculate shoulder angle (roll)
        const dx = rightShoulder.x - leftShoulder.x;
        const dy = rightShoulder.y - leftShoulder.y;
        const rollAngle = Math.atan2(dy, dx);

        // Calculate body rotation (yaw) using shoulder line
        // Positive when person turns right, negative when turning left
        const shoulderMidZ = (leftShoulder.z + rightShoulder.z) / 2;
        const shoulderWidth = Math.sqrt(dx * dx + dy * dy);
        const depthDiff = rightShoulder.z - leftShoulder.z;
        const yawAngle = Math.atan2(depthDiff, shoulderWidth) * 2; // Amplify for visibility

        // Calculate pitch (forward/backward tilt)
        // Using nose position relative to shoulder center
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        const pitchAngle = (nose.y - shoulderCenterY) * 0.5; // Small pitch adjustment

        return {
            x: pitchAngle,        // Pitch (looking up/down)
            y: yawAngle,          // Yaw (turning left/right)
            z: -rollAngle         // Roll (tilting head)
        };
    }

    /**
     * Calculate scale based on shoulder width
     */
    calculateScale(leftShoulder, rightShoulder) {
        // Calculate shoulder width in normalized space
        const dx = rightShoulder.x - leftShoulder.x;
        const dy = rightShoulder.y - leftShoulder.y;
        const shoulderWidth = Math.sqrt(dx * dx + dy * dy);

        // Scale jacket proportionally to shoulder width
        // Typical shoulder width in frame is 0.2-0.4 (normalized)
        // We want jacket to be roughly 1.0-2.0 in scale
        const scale = shoulderWidth * this.calibration.scaleMultiplier;

        // Clamp to reasonable values
        return Utils.clamp(scale, 0.5, 3.0);
    }

    /**
     * Smooth position using exponential moving average
     */
    smoothPosition(position) {
        if (!this.lastPosition) {
            this.lastPosition = position;
            return position;
        }

        const smoothed = {
            x: Utils.ema(position.x, this.lastPosition.x, this.smoothingFactor),
            y: Utils.ema(position.y, this.lastPosition.y, this.smoothingFactor),
            z: Utils.ema(position.z, this.lastPosition.z, this.smoothingFactor)
        };

        this.lastPosition = smoothed;
        return smoothed;
    }

    /**
     * Smooth rotation
     */
    smoothRotation(rotation) {
        if (!this.lastRotation) {
            this.lastRotation = rotation;
            return rotation;
        }

        const smoothed = {
            x: Utils.ema(rotation.x, this.lastRotation.x, this.smoothingFactor),
            y: Utils.ema(rotation.y, this.lastRotation.y, this.smoothingFactor),
            z: Utils.ema(rotation.z, this.lastRotation.z, this.smoothingFactor)
        };

        this.lastRotation = smoothed;
        return smoothed;
    }

    /**
     * Smooth scale
     */
    smoothScale(scale) {
        if (!this.lastScale) {
            this.lastScale = scale;
            return scale;
        }

        const smoothed = Utils.ema(scale, this.lastScale, this.smoothingFactor);
        this.lastScale = smoothed;
        return smoothed;
    }

    /**
     * Check if key points are visible
     */
    arePointsVisible(points, minVisibility = 0.5) {
        return points.every(point => 
            point && point.visibility !== undefined && point.visibility > minVisibility
        );
    }

    /**
     * Get current jacket transform info (for debugging)
     */
    getTransformInfo() {
        const jacket = modelLoader.getModel();
        if (!jacket) return null;

        return {
            position: {
                x: jacket.position.x.toFixed(2),
                y: jacket.position.y.toFixed(2),
                z: jacket.position.z.toFixed(2)
            },
            rotation: {
                x: (jacket.rotation.x * 180 / Math.PI).toFixed(1) + '°',
                y: (jacket.rotation.y * 180 / Math.PI).toFixed(1) + '°',
                z: (jacket.rotation.z * 180 / Math.PI).toFixed(1) + '°'
            },
            scale: jacket.scale.x.toFixed(2)
        };
    }

    /**
     * Reset smoothing (call when pose is lost)
     */
    reset() {
        this.lastPosition = null;
        this.lastRotation = null;
        this.lastScale = null;
        this.lastPose = null;
    }

    /**
     * Update calibration values (for fine-tuning)
     */
    updateCalibration(params) {
        this.calibration = { ...this.calibration, ...params };
        console.log('Calibration updated:', this.calibration);
    }

    /**
     * Get calibration values
     */
    getCalibration() {
        return { ...this.calibration };
    }
}

// Create global instance
const skeletonMapper = new SkeletonMapper();

// Debug: Log transform info every 2 seconds (only in debug mode)
if (CONFIG.DEBUG.LOG_PERFORMANCE) {
    setInterval(() => {
        const info = skeletonMapper.getTransformInfo();
        if (info && CONFIG.DEBUG.SHOW_SKELETON_BONES) {
            console.log('Jacket Transform:', info);
        }
    }, 2000);
}