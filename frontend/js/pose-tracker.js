// MediaPipe Pose tracking module for Lucy Virtual Try-On

class PoseTracker {
    constructor() {
        this.pose = null;
        this.camera = null;
        this.isInitialized = false;
        this.landmarks = null;
        this.worldLandmarks = null;
        this.smoothedLandmarks = null;
        this.callbacks = [];
        
        // Performance tracking
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
    }

    /**
     * Initialize MediaPipe Pose
     */
    async init() {
        try {
            console.log('Initializing MediaPipe Pose...');
            Utils.updateLoadingText('Loading AI pose tracking...');

            // Use window.Pose to access MediaPipe Pose class
            const Pose = window.Pose;
            if (!Pose) {
                throw new Error('MediaPipe Pose not loaded');
            }

            // Initialize Pose
            this.pose = new Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
                }
            });

            // Configure Pose options
            this.pose.setOptions({
                modelComplexity: CONFIG.POSE.MODEL_COMPLEXITY,
                smoothLandmarks: CONFIG.POSE.SMOOTH_LANDMARKS,
                enableSegmentation: CONFIG.POSE.ENABLE_SEGMENTATION,
                smoothSegmentation: CONFIG.POSE.SMOOTH_SEGMENTATION,
                minDetectionConfidence: CONFIG.POSE.MIN_DETECTION_CONFIDENCE,
                minTrackingConfidence: CONFIG.POSE.MIN_TRACKING_CONFIDENCE
            });

            // Set result callback
            this.pose.onResults((results) => this.onResults(results));

            this.isInitialized = true;
            Utils.updateStatus('tracking', true);
            console.log('MediaPipe Pose initialized');

        } catch (error) {
            console.error('Pose initialization failed:', error);
            Utils.updateStatus('tracking', false);
            throw new Error(`Pose tracking initialization failed: ${error.message}`);
        }
    }

    /**
     * Start pose tracking
     */
    async start() {
        if (!this.isInitialized) {
            throw new Error('Pose tracker not initialized');
        }

        try {
            // Get video element
            const video = document.getElementById('camera-video');
            
            // Create custom frame loop instead of MediaPipe Camera
            const sendFrame = async () => {
                if (this.pose && video.readyState >= 2) {
                    await this.pose.send({ image: video });
                }
                requestAnimationFrame(sendFrame);
            };
            
            // Start the frame loop
            requestAnimationFrame(sendFrame);
            console.log('Pose tracking started');

        } catch (error) {
            console.error('Error starting pose tracking:', error);
            Utils.showError('Could not start pose tracking');
            throw error;
        }
    }

    /**
     * Handle pose detection results
     */
    onResults(results) {
        // Update FPS
        this.updateFPS();

        if (!results.poseLandmarks) {
            this.landmarks = null;
            this.worldLandmarks = null;
            return;
        }

        // Store raw landmarks
        this.landmarks = results.poseLandmarks;
        this.worldLandmarks = results.poseWorldLandmarks;

        // Apply smoothing
        if (this.smoothedLandmarks && CONFIG.SKELETON.SMOOTHING_FACTOR > 0) {
            this.smoothedLandmarks = this.smoothLandmarks(
                results.poseLandmarks,
                this.smoothedLandmarks,
                CONFIG.SKELETON.SMOOTHING_FACTOR
            );
        } else {
            this.smoothedLandmarks = results.poseLandmarks;
        }

        // Debug visualization
        if (CONFIG.DEBUG.SHOW_POSE_LANDMARKS) {
            this.drawLandmarks(results);
        }

        // Trigger callbacks
        this.callbacks.forEach(callback => {
            callback({
                landmarks: this.smoothedLandmarks,
                worldLandmarks: this.worldLandmarks,
                rawLandmarks: this.landmarks
            });
        });
    }

    /**
     * Smooth landmarks using exponential moving average
     */
    smoothLandmarks(current, previous, alpha) {
        return current.map((landmark, i) => {
            const prev = previous[i];
            return {
                x: Utils.ema(landmark.x, prev.x, alpha),
                y: Utils.ema(landmark.y, prev.y, alpha),
                z: Utils.ema(landmark.z, prev.z, alpha),
                visibility: landmark.visibility
            };
        });
    }

    /**
     * Get specific landmark by name
     */
    getLandmark(name) {
        if (!this.smoothedLandmarks) return null;
        
        const index = CONFIG.SKELETON.LANDMARKS[name];
        if (index === undefined) return null;
        
        return this.smoothedLandmarks[index];
    }

    /**
     * Get multiple landmarks
     */
    getLandmarks(names) {
        return names.map(name => this.getLandmark(name));
    }

    /**
     * Check if pose is detected
     */
    isPoseDetected() {
        return this.smoothedLandmarks !== null;
    }

    /**
     * Calculate shoulder width
     */
    getShoulderWidth() {
        const leftShoulder = this.getLandmark('LEFT_SHOULDER');
        const rightShoulder = this.getLandmark('RIGHT_SHOULDER');
        
        if (!leftShoulder || !rightShoulder) return null;
        
        return Utils.distance2D(
            leftShoulder.x, leftShoulder.y,
            rightShoulder.x, rightShoulder.y
        );
    }

    /**
     * Calculate torso center
     */
    getTorsoCenter() {
        const leftShoulder = this.getLandmark('LEFT_SHOULDER');
        const rightShoulder = this.getLandmark('RIGHT_SHOULDER');
        const leftHip = this.getLandmark('LEFT_HIP');
        const rightHip = this.getLandmark('RIGHT_HIP');
        
        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;
        
        return {
            x: (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4,
            y: (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4,
            z: (leftShoulder.z + rightShoulder.z + leftHip.z + rightHip.z) / 4
        };
    }

    /**
     * Calculate body rotation (yaw)
     */
    getBodyRotation() {
        const leftShoulder = this.getLandmark('LEFT_SHOULDER');
        const rightShoulder = this.getLandmark('RIGHT_SHOULDER');
        
        if (!leftShoulder || !rightShoulder) return 0;
        
        // Calculate angle based on shoulder positions
        const dx = rightShoulder.x - leftShoulder.x;
        const dy = rightShoulder.y - leftShoulder.y;
        return Math.atan2(dy, dx);
    }

    /**
     * Register callback for pose updates
     */
    onPoseUpdate(callback) {
        this.callbacks.push(callback);
    }

    /**
     * Update FPS counter
     */
    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        const elapsed = now - this.lastFrameTime;
        
        if (elapsed >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / elapsed);
            Utils.updateFPS(this.fps);
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
    }

    /**
     * Draw landmarks for debugging
     */
    drawLandmarks(results) {
        const canvas = document.getElementById('pose-canvas');
        const canvasCtx = canvas.getContext('2d');
        
        canvas.width = CONFIG.CAMERA.WIDTH;
        canvas.height = CONFIG.CAMERA.HEIGHT;
        
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.poseLandmarks) {
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 4
            });
            drawLandmarks(canvasCtx, results.poseLandmarks, {
                color: '#FF0000',
                lineWidth: 2,
                radius: 6
            });
        }
        
        canvasCtx.restore();
    }

    /**
     * Stop pose tracking
     */
    stop() {
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }
        
        this.landmarks = null;
        this.worldLandmarks = null;
        this.smoothedLandmarks = null;
        Utils.updateStatus('tracking', false);
        console.log('Pose tracking stopped');
    }

    /**
     * Get current FPS
     */
    getFPS() {
        return this.fps;
    }
}

// Create global instance
const poseTracker = new PoseTracker();