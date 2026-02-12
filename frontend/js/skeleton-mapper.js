// Skeleton Mapper - FIXED: Jacket positioning at shoulders, not face
// Prevents jacket from covering the face

class SkeletonMapper {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.initialized = false;
        this.lastPose = null;
        
        // Smoothing parameters - lower = more responsive, less drift
        this.smoothingFactor = 0.2;  // ✅ Reduced to prevent autonomous movement
        this.lastPosition = { x: 0, y: 0, z: 0 };
        this.lastRotation = { x: 0, y: 0, z: 0 };
        this.lastScale = 1.0;
        
        // Performance optimization
        this.lastUpdateTime = 0;
        this.updateInterval = 1000 / 60;  // ✅ 60 FPS for smoother tracking
        
        // ✅ Split layout calibration - jacket displays on right side
        this.calibration = {
            scaleMultiplier: 5.5,     // ✅ Bigger size for right panel
            depthMultiplier: -8.0,    // Z-axis (depth)
            verticalOffset: 0.0,      // ✅ Centered vertically
            horizontalOffset: 6.0,    // ✅ Shifted to the right
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
        if (!this.initialized || !poseData) {
            console.log('⚠️ Skeleton update skipped:', !this.initialized ? 'not initialized' : 'no pose data');
            return;
        }

        // Throttle updates to 30 FPS
        const now = performance.now();
        if (now - this.lastUpdateTime < this.updateInterval) {
            return;
        }
        this.lastUpdateTime = now;

        const jacket = modelLoader.getModel();
        if (!jacket) {
            console.log('⚠️ Jacket model not found');
            return;
        }

        const landmarks = poseData.landmarks;
        if (!landmarks || landmarks.length < 33) {
            console.log('⚠️ Invalid landmarks:', landmarks?.length);
            return;
        }

        try {
            // Get key body points
            const leftShoulder = landmarks[CONFIG.SKELETON.LANDMARKS.LEFT_SHOULDER];
            const rightShoulder = landmarks[CONFIG.SKELETON.LANDMARKS.RIGHT_SHOULDER];
            const leftHip = landmarks[CONFIG.SKELETON.LANDMARKS.LEFT_HIP];
            const rightHip = landmarks[CONFIG.SKELETON.LANDMARKS.RIGHT_HIP];
            const nose = landmarks[CONFIG.SKELETON.LANDMARKS.NOSE];

            // Check visibility
            if (!this.arePointsVisible([leftShoulder, rightShoulder], 0.3)) {
                console.log('⚠️ Shoulders not visible:', leftShoulder.visibility, rightShoulder.visibility);
                return;
            }

            // ✅ Calculate transformations using ONLY shoulders (not hips)
            const position = this.calculatePosition(leftShoulder, rightShoulder);
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

            // Auto-show jacket on first successful update
            if (!jacket.visible) {
                jacket.visible = true;
                console.log('✅ Jacket now visible and tracking shoulders');
            }

            this.lastPose = poseData;

        } catch (error) {
            console.error('Error updating skeleton:', error);
        }
    }

    /**
     * ✅ FIXED: Calculate position at SHOULDERS only, not torso
     */
    calculatePosition(leftShoulder, rightShoulder) {
        // ✅ Use ONLY shoulder center (not hips)
        const shoulderCenter = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2,
            z: (leftShoulder.z + rightShoulder.z) / 2
        };

        // Convert normalized coordinates (0-1) to 3D world space
        // ✅ Reduced multipliers for less sensitive, smoother movement
        const x = (shoulderCenter.x - 0.5) * 5 + this.calibration.horizontalOffset;
        
        // ✅ CRITICAL: Positive Y moves DOWN in Three.js (inverted)
        const y = -(shoulderCenter.y - 0.5) * 5 + this.calibration.verticalOffset;
        
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

        // Calculate body rotation (yaw)
        const shoulderWidth = Math.sqrt(dx * dx + dy * dy);
        const depthDiff = rightShoulder.z - leftShoulder.z;
        const yawAngle = Math.atan2(depthDiff, shoulderWidth) * 1.5;

        // Calculate pitch
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        const pitchAngle = (nose.y - shoulderCenterY) * 0.3;

        return {
            x: Math.PI + pitchAngle,  // ✅ Flip upright (180 degrees)
            y: Math.PI + yawAngle,    // ✅ Face camera (180 degrees)
            z: -rollAngle
        };
    }

    /**
     * Calculate scale based on shoulder width
     */
    calculateScale(leftShoulder, rightShoulder) {
        const dx = rightShoulder.x - leftShoulder.x;
        const dy = rightShoulder.y - leftShoulder.y;
        const shoulderWidth = Math.sqrt(dx * dx + dy * dy);

        // ✅ Bigger scale for split layout
        const scale = shoulderWidth * this.calibration.scaleMultiplier;

        return Utils.clamp(scale, 1.0, 4.5); // ✅ Allow bigger jacket
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
    arePointsVisible(points, minVisibility = 0.3) {
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
     * Update calibration values dynamically
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
     * Force show jacket
     */
    forceShowJacket() {
        const jacket = modelLoader.getModel();
        if (jacket) {
            jacket.visible = true;
            console.log('Jacket forced visible');
        }
    }
    
    /**
     * Hide jacket
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