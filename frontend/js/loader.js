// 3D Model loader for Lucy Virtual Try-On

class ModelLoader {
    constructor() {
        this.loader = new THREE.GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
        this.jacketModel = null;
        this.jacketMesh = null;
        this.jacketSkeleton = null;
        this.isLoaded = false;
        
        // Setup Meshopt decoder for compressed models
        this.setupMeshoptDecoder();
    }

    /**
     * Setup Meshopt decoder for compressed GLB files
     */
    setupMeshoptDecoder() {
        // Use the decoder from CDN
        if (typeof MeshoptDecoder !== 'undefined') {
            this.loader.setMeshoptDecoder(MeshoptDecoder);
            console.log('Meshopt decoder initialized');
        }
    }

    /**
     * Load jacket GLB model
     */
    async loadJacket(modelPath = CONFIG.JACKET.MODEL_PATH) {
        return new Promise((resolve, reject) => {
            console.log('Loading jacket model:', modelPath);
            Utils.updateLoadingText('Loading 3D jacket model...');

            this.loader.load(
                modelPath,
                (gltf) => {
                    try {
                        this.jacketModel = gltf.scene;
                        
                        // Find the main mesh
                        this.jacketMesh = this.findMesh(this.jacketModel);
                        
                        if (!this.jacketMesh) {
                            throw new Error('No mesh found in jacket model');
                        }

                        // Find skeleton/armature
                        this.jacketSkeleton = this.findSkeleton(this.jacketModel);
                        
                        if (this.jacketSkeleton) {
                            console.log('Skeleton found with', this.jacketSkeleton.bones.length, 'bones');
                        } else {
                            console.warn('No skeleton found in model - using mesh-only mode');
                        }

                        // Apply initial transforms
                        this.jacketModel.scale.set(
                            CONFIG.JACKET.SCALE,
                            CONFIG.JACKET.SCALE,
                            CONFIG.JACKET.SCALE
                        );
                        
                        this.jacketModel.position.set(
                            CONFIG.JACKET.POSITION.x,
                            CONFIG.JACKET.POSITION.y,
                            CONFIG.JACKET.POSITION.z
                        );
                        
                        this.jacketModel.rotation.set(
                            CONFIG.JACKET.ROTATION.x,
                            CONFIG.JACKET.ROTATION.y,
                            CONFIG.JACKET.ROTATION.z
                        );

                        // Initially hide the jacket
                        this.jacketModel.visible = false;

                        // Add to scene
                        sceneManager.add(this.jacketModel);
                        
                        this.isLoaded = true;
                        console.log('Jacket model loaded successfully');
                        resolve(this.jacketModel);

                    } catch (error) {
                        reject(error);
                    }
                },
                (progress) => {
                    const percent = (progress.loaded / progress.total * 100).toFixed(0);
                    Utils.updateLoadingText(`Loading jacket model... ${percent}%`);
                    console.log(`Loading progress: ${percent}%`);
                },
                (error) => {
                    console.error('Error loading jacket model:', error);
                    reject(new Error(`Failed to load jacket model: ${error.message}`));
                }
            );
        });
    }

    /**
     * Find the main mesh in the loaded model
     */
    findMesh(object) {
        let mesh = null;
        
        object.traverse((child) => {
            if (child.isMesh && !mesh) {
                mesh = child;
            }
        });
        
        return mesh;
    }

    /**
     * Find skeleton in the loaded model
     */
    findSkeleton(object) {
        let skeleton = null;
        
        object.traverse((child) => {
            if (child.isSkinnedMesh && child.skeleton) {
                skeleton = child.skeleton;
            }
        });
        
        return skeleton;
    }

    /**
     * Get all bones from skeleton
     */
    getBones() {
        if (!this.jacketSkeleton) return [];
        return this.jacketSkeleton.bones;
    }

    /**
     * Find bone by name
     */
    findBone(name) {
        if (!this.jacketSkeleton) return null;
        
        return this.jacketSkeleton.bones.find(bone => 
            bone.name.toLowerCase().includes(name.toLowerCase())
        );
    }

    /**
     * Show/hide jacket
     */
    setVisible(visible) {
        if (this.jacketModel) {
            this.jacketModel.visible = visible;
        }
    }

    /**
     * Update jacket position
     */
    setPosition(x, y, z) {
        if (this.jacketModel) {
            this.jacketModel.position.set(x, y, z);
        }
    }

    /**
     * Update jacket rotation
     */
    setRotation(x, y, z) {
        if (this.jacketModel) {
            this.jacketModel.rotation.set(x, y, z);
        }
    }

    /**
     * Update jacket scale
     */
    setScale(scale) {
        if (this.jacketModel) {
            this.jacketModel.scale.set(scale, scale, scale);
        }
    }

    /**
     * Get jacket mesh
     */
    getMesh() {
        return this.jacketMesh;
    }

    /**
     * Get jacket model
     */
    getModel() {
        return this.jacketModel;
    }

    /**
     * Get skeleton
     */
    getSkeleton() {
        return this.jacketSkeleton;
    }

    /**
     * Check if model is loaded
     */
    isModelLoaded() {
        return this.isLoaded;
    }

    /**
     * Load texture
     */
    async loadTexture(url) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    texture.encoding = THREE.sRGBEncoding;
                    texture.flipY = false; // Important for GLB models
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error('Error loading texture:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Dispose of model resources
     */
    dispose() {
        if (this.jacketModel) {
            this.jacketModel.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            this.disposeMaterial(material);
                        });
                    } else {
                        this.disposeMaterial(child.material);
                    }
                }
            });
            
            sceneManager.remove(this.jacketModel);
            this.jacketModel = null;
        }
        
        this.jacketMesh = null;
        this.jacketSkeleton = null;
        this.isLoaded = false;
        console.log('Model disposed');
    }

    /**
     * Dispose of material resources
     */
    disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.aoMap) material.aoMap.dispose();
        material.dispose();
    }
}

// Create global instance
const modelLoader = new ModelLoader();