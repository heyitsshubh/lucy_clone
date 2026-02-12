// Composite Renderer - Combines camera feed with 3D jacket overlay
// This is what creates the AR experience

class CompositeRenderer {
    constructor() {
        this.canvas = document.getElementById('main-canvas');
        this.ctx = null;
        this.videoTexture = null;
        this.videoPlane = null;
        this.isRunning = false;
        this.animationId = null;
        
        // AI blending
        this.aiCanvas = document.createElement('canvas');
        this.aiCtx = this.aiCanvas.getContext('2d');
        this.latestAIFrame = null;
        
        // Performance tracking
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.fps = 0;
    }

    /**
     * Initialize the composite renderer
     */
    init(width, height) {
        try {
            console.log('Initializing CompositeRenderer...');
            
            // Store dimensions
            this.width = width;
            this.height = height;
            
            // Setup canvas
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.ctx = this.canvas.getContext('2d');
            
            // Setup AI canvas (same size as video)
            this.aiCanvas.width = width;
            this.aiCanvas.height = height;
            
            // Setup video texture for background
            this.setupVideoBackground();
            
            // Handle window resize
            window.addEventListener('resize', () => this.onResize());
            
            console.log('✅ CompositeRenderer initialized');
            
        } catch (error) {
            console.error('CompositeRenderer initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup video background in Three.js scene
     */
    setupVideoBackground() {
        const video = cameraManager.video;
        
        if (!video) {
            console.warn('Camera video not available for background');
            return;
        }

        // Create video texture
        this.videoTexture = new THREE.VideoTexture(video);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
        this.videoTexture.format = THREE.RGBFormat;

        // Create plane geometry to fit the screen
        const aspect = this.width / this.height;
        const planeWidth = 20;
        const planeHeight = planeWidth / aspect;
        
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const material = new THREE.MeshBasicMaterial({
            map: this.videoTexture,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.videoPlane = new THREE.Mesh(geometry, material);
        this.videoPlane.position.z = -10; // Behind everything
        
        // Add to scene
        sceneManager.add(this.videoPlane);
        
        console.log('Video background setup complete');
    }

    /**
     * Start the render loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('Starting render loop...');
        this.render();
    }

    /**
     * Stop the render loop
     */
    stop() {
        this.isRunning = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        console.log('Render loop stopped');
    }

    /**
     * Main render loop
     */
    render() {
        if (!this.isRunning) return;

        try {
            // Update video texture
            if (this.videoTexture) {
                this.videoTexture.needsUpdate = true;
            }

            // Render Three.js scene (camera feed + 3D jacket)
            sceneManager.render();

            // If AI enhancement is active, blend it in
            if (aiPipeline.isActive() && aiPipeline.getBlendAlpha() > 0) {
                this.blendAIFrame();
            }

            // Update FPS counter
            this.updateFPS();

        } catch (error) {
            console.error('Render error:', error);
        }

        // Request next frame
        this.animationId = requestAnimationFrame(() => this.render());
    }

    /**
     * Blend AI-enhanced frame with current render
     */
    blendAIFrame() {
        const aiFrame = aiPipeline.getLatestFrame();
        const alpha = aiPipeline.getBlendAlpha();
        
        if (!aiFrame || alpha <= 0) return;

        try {
            // Create temporary image from base64
            const img = new Image();
            img.src = aiFrame;
            
            img.onload = () => {
                // Get canvas context
                const ctx = this.canvas.getContext('2d');
                
                // Save current composite
                const currentFrame = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                
                // Draw AI frame
                ctx.globalAlpha = alpha;
                ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                
                // Restore alpha
                ctx.globalAlpha = 1.0;
            };
            
        } catch (error) {
            console.error('Error blending AI frame:', error);
        }
    }

    /**
     * Capture current frame as base64
     */
    captureFrame() {
        if (!this.canvas) return null;
        
        try {
            // Ensure latest render
            if (this.videoTexture) {
                this.videoTexture.needsUpdate = true;
            }
            sceneManager.render();
            
            // Capture canvas
            return this.canvas.toDataURL('image/png');
            
        } catch (error) {
            console.error('Error capturing frame:', error);
            return null;
        }
    }

    /**
     * Update FPS counter
     */
    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        const elapsed = now - this.lastFpsUpdate;
        
        if (elapsed >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / elapsed);
            Utils.updateFPS(this.fps);
            
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            
            // Performance warning
            if (this.fps < CONFIG.PERFORMANCE.LOW_PERFORMANCE_THRESHOLD) {
                console.warn(`Low FPS detected: ${this.fps}`);
            }
        }
    }

    /**
     * Handle window resize
     */
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Update canvas size
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Update Three.js renderer
        const renderer = sceneManager.getRenderer();
        if (renderer) {
            renderer.setSize(width, height);
        }
        
        // Update camera aspect ratio
        const camera = sceneManager.getCamera();
        if (camera) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
        
        // Update video plane size
        if (this.videoPlane) {
            const aspect = this.width / this.height;
            const planeWidth = 20;
            const planeHeight = planeWidth / aspect;
            
            this.videoPlane.geometry.dispose();
            this.videoPlane.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        }
        
        console.log(`Window resized: ${width}x${height}`);
    }

    /**
     * Get current FPS
     */
    getFPS() {
        return this.fps;
    }

    /**
     * Toggle video background visibility
     */
    toggleVideoBackground(visible) {
        if (this.videoPlane) {
            this.videoPlane.visible = visible;
        }
    }

    /**
     * Set video background opacity
     */
    setVideoOpacity(opacity) {
        if (this.videoPlane && this.videoPlane.material) {
            this.videoPlane.material.opacity = opacity;
            this.videoPlane.material.transparent = opacity < 1.0;
        }
    }

    /**
     * Take high-quality screenshot
     */
    async takeScreenshot(format = 'image/png', quality = 1.0) {
        // Ensure latest render
        sceneManager.render();
        
        // Capture at current canvas resolution
        return this.canvas.toDataURL(format, quality);
    }

    /**
     * Get render statistics
     */
    getStats() {
        return {
            fps: this.fps,
            isRunning: this.isRunning,
            canvasSize: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            videoTextureActive: this.videoTexture !== null,
            aiBlending: aiPipeline.isActive()
        };
    }

    /**
     * Dispose resources
     */
    dispose() {
        this.stop();
        
        if (this.videoTexture) {
            this.videoTexture.dispose();
            this.videoTexture = null;
        }
        
        if (this.videoPlane) {
            this.videoPlane.geometry.dispose();
            this.videoPlane.material.dispose();
            sceneManager.remove(this.videoPlane);
            this.videoPlane = null;
        }
        
        console.log('CompositeRenderer disposed');
    }
}

// Create global instance
const compositeRenderer = new CompositeRenderer();

// Debug: Log stats periodically
if (CONFIG.DEBUG.LOG_PERFORMANCE) {
    setInterval(() => {
        const stats = compositeRenderer.getStats();
        console.log('Renderer Stats:', stats);
    }, 5000);
}