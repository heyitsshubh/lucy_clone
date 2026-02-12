// PBR Materials manager for Lucy Virtual Try-On

class MaterialsManager {
    constructor() {
        this.currentMaterial = null;
        this.currentFabric = null;
        this.textures = {
            diffuse: null,
            normal: null,
            roughness: null
        };
    }

    /**
     * Apply fabric material to jacket
     */
    async applyFabric(fabricData) {
        try {
            console.log('Applying fabric:', fabricData.name);
            
            const mesh = modelLoader.getMesh();
            if (!mesh) {
                throw new Error('Jacket mesh not found');
            }

            // -----------------------------
            // ✅ COLOR-BASED FABRIC
            // -----------------------------
            if (fabricData.color) {
                const material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(fabricData.color),
                    roughness: fabricData.roughness || 0.8,
                    metalness: fabricData.metalness || 0.0,
                    side: THREE.DoubleSide
                });

                const oldMaterial = mesh.material;

                mesh.material = material;
                this.currentMaterial = material;
                this.currentFabric = fabricData;

                if (oldMaterial && oldMaterial !== material) {
                    this.disposeMaterial(oldMaterial);
                }

                modelLoader.setVisible(true);

                console.log('Fabric applied (color):', fabricData.name);
                return true;
            }

            // -----------------------------
            // ✅ TEXTURE-BASED (PBR) FABRIC
            // -----------------------------
            const [diffuseMap, normalMap, roughnessMap] = await Promise.all([
                fabricData.diffuseUrl ? this.loadTexture(fabricData.diffuseUrl) : null,
                fabricData.normalUrl ? this.loadTexture(fabricData.normalUrl) : null,
                fabricData.roughnessUrl ? this.loadTexture(fabricData.roughnessUrl) : null
            ]);

            // Configure texture tiling
            [diffuseMap, normalMap, roughnessMap].forEach(texture => {
                if (texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(
                        CONFIG.FABRIC.DEFAULT_REPEAT.u,
                        CONFIG.FABRIC.DEFAULT_REPEAT.v
                    );
                }
            });

            const material = new THREE.MeshStandardMaterial({
                map: diffuseMap,
                normalMap: normalMap,
                roughnessMap: roughnessMap,
                roughness: fabricData.roughness || 0.8,
                metalness: fabricData.metalness || 0.0,
                envMapIntensity: 1.0,
                side: THREE.FrontSide
            });

            const oldMaterial = mesh.material;

            mesh.material = material;
            this.currentMaterial = material;
            this.currentFabric = fabricData;

            this.textures.diffuse = diffuseMap;
            this.textures.normal = normalMap;
            this.textures.roughness = roughnessMap;

            if (oldMaterial && oldMaterial !== material) {
                this.disposeMaterial(oldMaterial);
            }

            modelLoader.setVisible(true);

            console.log('Fabric applied successfully');
            return true;

        } catch (error) {
            console.error('Error applying fabric:', error);
            Utils.showError('Could not apply fabric');
            return false;
        }
    }

    /**
     * Load texture with proper configuration
     */
    async loadTexture(url) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.load(
                url,
                (texture) => {
                    texture.encoding = THREE.sRGBEncoding;
                    texture.flipY = false;
                    texture.anisotropy = 16;
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error('Texture load error:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Update texture tiling/repeat
     */
    updateTextureRepeat(u, v) {
        Object.values(this.textures).forEach(texture => {
            if (texture) {
                texture.repeat.set(u, v);
            }
        });
    }

    /**
     * Update material properties
     */
    updateMaterialProperties(properties) {
        if (!this.currentMaterial) return;

        if (properties.roughness !== undefined) {
            this.currentMaterial.roughness = properties.roughness;
        }
        if (properties.metalness !== undefined) {
            this.currentMaterial.metalness = properties.metalness;
        }
        if (properties.envMapIntensity !== undefined) {
            this.currentMaterial.envMapIntensity = properties.envMapIntensity;
        }

        this.currentMaterial.needsUpdate = true;
    }

    /**
     * Get current fabric
     */
    getCurrentFabric() {
        return this.currentFabric;
    }

    /**
     * Get current material
     */
    getCurrentMaterial() {
        return this.currentMaterial;
    }

    /**
     * Remove current fabric
     */
    removeFabric() {
        if (this.currentMaterial) {
            this.disposeMaterial(this.currentMaterial);
            this.currentMaterial = null;
        }

        this.currentFabric = null;

        Object.keys(this.textures).forEach(key => {
            this.textures[key] = null;
        });

        modelLoader.setVisible(false);
    }

    /**
     * Dispose of material and its textures
     */
    disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.aoMap) material.aoMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        material.dispose();
    }

    /**
     * Create default material (for testing)
     */
    createDefaultMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0x4477ff,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.FrontSide
        });
    }

    /**
     * Clone current material
     */
    cloneMaterial() {
        if (!this.currentMaterial) return null;
        return this.currentMaterial.clone();
    }
}

// Create global instance
const materialsManager = new MaterialsManager();
