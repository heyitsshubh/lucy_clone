// Skeleton Mapper - Maps MediaPipe pose landmarks to 3D jacket model
// FIXED VERSION - Correct scaling and positioning

class SkeletonMapper {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.initialized = false;
        this.lastPose = null;
        
        // Smoothing parameters
        this.smoothingFactor = 0.5; // ✅ Increased for smoother tracking
        this.lastPosition = { x: 0, y: 0, z: 0 };
        this.lastRotation = { x: 0, y: 0, z: 0 };
        this.lastScale = 1.0;
        
        // Performance optimization
        this.lastUpdateTime = 0;
        this.updateInterval = 1000 / 30; // 30 FPS
        
        // ✅ FIXED Calibration values - more realistic
        this.calibration = {
            scaleMultiplier: 3.5,    // ✅ Reduced from 8.0 (was too large)
            depthMultiplier: -8.0,   // ✅ Further back for better fit
            verticalOffset: -0.5,    // ✅ Slight adjustment
            horizontalOffset: 0.0,
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

        // Throttle updates to 30 FPS
        const now = performance.now();
        if (now - this.lastUpdateTime < this.updateInterval) {
            return;
        }
        this.lastUpdateTime = now;

        const jacket = modelLoader.getModel();
        if (!jacket) return;

        const landmarks = poseData.landmarks;
        if (!landmarks || landmarks.length < 33) return;

        try {
            // Get key body points
            const leftShoulder = landmarks[CONFIG.SKELETON.LANDMARKS.LEFT_SHOULDER];
            const rightShoulder = landmarks[CONFIG.SKELETON.LANDMARKS.RIGHT_SHOULDER];
            const leftHip = landmarks[CONFIG.SKELETON.LANDMARKS.LEFT_HIP];
            const rightHip = landmarks[CONFIG.SKELETON.LANDMARKS.RIGHT_HIP];
            const nose = landmarks[CONFIG.SKELETON.LANDMARKS.NOSE];

            // ✅ Check visibility with lower threshold
            if (!this.arePointsVisible([leftShoulder, rightShoulder, leftHip, rightHip], 0.3)) {
                console.warn('Key points not visible');
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

            // ✅ Auto-show jacket on first successful update
            if (!jacket.visible) {
                jacket.visible = true;
                console.log('✅ Jacket now visible and tracking body');
            }

            this.lastPose = poseData;

        } catch (error) {
            console.error('Error updating skeleton:', error);
        }
    }

    /**
     * Calculate 3D position for the jacket
     */
    calculatePosition(leftShoulder, rightShoulder, leftHip, rightHip) {
        // Calculate torso center (between shoulders and hips)
        const torsoCenter = {
            x: (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4,
            y: (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4,
            z: (leftShoulder.z + rightShoulder.z + leftHip.z + rightHip.z) / 4
        };

        // ✅ Convert normalized coordinates to 3D world space
        // MediaPipe gives 0-1, we need -5 to 5 range
        const x = (torsoCenter.x - 0.5) * 10 + this.calibration.horizontalOffset;
        const y = -(torsoCenter.y - 0.5) * 10 + this.calibration.verticalOffset;
        const z = this.calibration.depthMultiplier + (torsoCenter.z * 3); // ✅ Adjusted depth scaling

        return { x, y, z };
    }

    /**
     * Calculate rotation for the jacket
     */
    calculateRotation(leftShoulder, rightShoulder, nose) {
        // Calculate shoulder angle (roll) - when user tilts head
        const dx = rightShoulder.x - leftShoulder.x;
        const dy = rightShoulder.y - leftShoulder.y;
        const rollAngle = Math.atan2(dy, dx);

        // Calculate body rotation (yaw) - when user turns left/right
        const shoulderWidth = Math.sqrt(dx * dx + dy * dy);
        const depthDiff = rightShoulder.z - leftShoulder.z;
        const yawAngle = Math.atan2(depthDiff, shoulderWidth) * 1.5; // ✅ Reduced multiplier

        // Calculate pitch (forward/backward lean)
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        const pitchAngle = (nose.y - shoulderCenterY) * 0.3; // ✅ Reduced sensitivity

        return {
            x: pitchAngle,
            y: yawAngle,
            z: -rollAngle
        };
    }

    /**
     * Calculate scale based on shoulder width
     */
    calculateScale(leftShoulder, rightShoulder) {
        // Calculate shoulder width in normalized space (0-1)
        const dx = rightShoulder.x - leftShoulder.x;
        const dy = rightShoulder.y - leftShoulder.y;
        const shoulderWidth = Math.sqrt(dx * dx + dy * dy);

        // ✅ More reasonable scaling
        // Typical shoulder width: 0.2-0.35 normalized
        // Target jacket scale: 0.8-1.5
        const scale = shoulderWidth * this.calibration.scaleMultiplier;

        // ✅ Tighter clamp range for realistic sizing
        return Utils.clamp(scale, 0.6, 2.0);
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
    arePointsVisible(points, minVisibility = 0.3) { // ✅ Lowered threshold
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
            visible: jacket.visible,
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
     * Reset smoothing
     */
    reset() {
        this.lastPosition = null;
        this.lastRotation = null;
        this.lastScale = null;
        this.lastPose = null;
        console.log('Skeleton mapper reset');
    }

    /**
     * Update calibration values
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
    
    /**
     * Set update interval (FPS cap)
     */
    setUpdateInterval(fps) {
        this.updateInterval = 1000 / fps;
        console.log(`Skeleton updates capped at ${fps} FPS`);
    }
    
    /**
     * ✅ Force show jacket (for testing)
     */
    forceShowJacket() {
        const jacket = modelLoader.getModel();
        if (jacket) {
            jacket.visible = true;
            console.log('Jacket forced visible');
        }
    }
    
    /**
     * ✅ Hide jacket
     */
    hideJacket() {
        const jacket = modelLoader.getModel();
        if (jacket) {
            jacket.visible = false;
            console.log('Jacket hidden');
        }
    }
}

// Create global instance
const skeletonMapper = new SkeletonMapper();

// Debug logging
if (CONFIG.DEBUG.LOG_PERFORMANCE) {
    setInterval(() => {
        const info = skeletonMapper.getTransformInfo();
        if (info && CONFIG.DEBUG.VERBOSE) {
            console.log('Jacket Transform:', info);
        }
    }, 3000);
}