// Configuration file for Lucy Virtual Try-On
const CONFIG = {
    // Backend API configuration
    API: {
        BASE_URL: 'http://localhost:5000',
        WS_URL: 'ws://localhost:5000/ws',
        ENDPOINTS: {
            FABRIC_CATALOG: '/api/fabric/catalog',
            FABRIC_SCAN: '/api/fabric/scan',
            VIRTUAL_TRYON: '/virtual-tryon',
            HEALTH: '/health'
        }
    },

    // Camera configuration
    CAMERA: {
        WIDTH: 1280,
        HEIGHT: 720,
        FRAME_RATE: 30,
        FACING_MODE: 'user' // 'user' for front camera, 'environment' for back
    },

    // Three.js scene configuration
    SCENE: {
        BACKGROUND_COLOR: 0x000000,
        CAMERA_FOV: 50,
        CAMERA_NEAR: 0.1,
        CAMERA_FAR: 2000,
        AMBIENT_LIGHT_INTENSITY: 0.6,
        DIRECTIONAL_LIGHT_INTENSITY: 0.8
    },

    // Jacket model configuration
    JACKET: {
        MODEL_PATH: 'frontend/assets/models/14_Jacket.glb', 
        SCALE: 1.0,
        POSITION: { x: 0, y: 0, z: 0 },
        ROTATION: { x: 0, y: 0, z: 0 }
    },

    // MediaPipe Pose configuration
    POSE: {
        MODEL_COMPLEXITY: 1, // 0=Lite, 1=Full, 2=Heavy
        SMOOTH_LANDMARKS: true,
        SMOOTH_SEGMENTATION: true,
        MIN_DETECTION_CONFIDENCE: 0.5,
        MIN_TRACKING_CONFIDENCE: 0.5,
        ENABLE_SEGMENTATION: false
    },

    // Skeleton mapping configuration
    SKELETON: {
        // Smoothing factor for landmark positions (0-1, higher = smoother but more lag)
        SMOOTHING_FACTOR: 0.7,
        
        // Scale multipliers for different body parts
        SCALE_MULTIPLIERS: {
            SHOULDERS: 1.2,
            TORSO: 1.0,
            ARMS: 1.0
        },

        // MediaPipe landmark indices (do not change)
        LANDMARKS: {
            NOSE: 0,
            LEFT_EYE: 2,
            RIGHT_EYE: 5,
            LEFT_EAR: 7,
            RIGHT_EAR: 8,
            LEFT_SHOULDER: 11,
            RIGHT_SHOULDER: 12,
            LEFT_ELBOW: 13,
            RIGHT_ELBOW: 14,
            LEFT_WRIST: 15,
            RIGHT_WRIST: 16,
            LEFT_HIP: 23,
            RIGHT_HIP: 24,
            LEFT_KNEE: 25,
            RIGHT_KNEE: 26,
            LEFT_ANKLE: 27,
            RIGHT_ANKLE: 28
        }
    },

    // AI Pipeline configuration
    AI_PIPELINE: {
        ENABLED: true,
        KEYFRAME_INTERVAL: 1500, // Send keyframe every 1.5 seconds
        MAX_BLEND_ALPHA: 0.7, // Maximum AI blend (0-1)
        BLEND_TRANSITION_DURATION: 500, // Transition duration in ms
        JPEG_QUALITY: 0.75,
        MAX_RECONNECT_ATTEMPTS: 5,
        RECONNECT_DELAY: 3000
    },

    // Fabric texture configuration
    FABRIC: {
        DEFAULT_REPEAT: { u: 2, v: 2 }, // Texture tiling
        THUMBNAIL_SIZE: 80,
        MAX_UPLOAD_SIZE: 10 * 1024 * 1024 // 10MB
    },

    // Performance settings
    PERFORMANCE: {
        TARGET_FPS: 30,
        LOW_PERFORMANCE_THRESHOLD: 20, // Switch to low-quality mode below this FPS
        RENDER_SCALE: 1.0, // Reduce for better performance on low-end devices
        ENABLE_STATS: true // Show FPS counter
    },

    // UI configuration
    UI: {
        POSE_GUIDE_DURATION: 5000, // Show pose guide for 5 seconds
        HIDE_CONTROLS_DELAY: 5000, // Auto-hide UI after 5 seconds of inactivity
        TOAST_DURATION: 3000
    },

    // Development/Debug settings
    DEBUG: {
        SHOW_POSE_LANDMARKS: false,
        SHOW_SKELETON_BONES: false,
        LOG_PERFORMANCE: true,
        ENABLE_ORBIT_CONTROLS: false // Allow manual camera control for debugging
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}