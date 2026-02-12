// Fabric selector UI module

class FabricSelector {
    constructor() {
        this.fabrics = [];
        this.selectedFabric = null;
        this.container = document.getElementById('fabric-scroll');
        this.scanBtn = document.getElementById('scan-fabric-btn');
        this.scanModal = document.getElementById('fabric-scan-modal');
        this.isLoading = false;
    }

    /**
     * Initialize fabric selector
     */
    async init() {
        try {
            console.log('Initializing fabric selector...');
            
            // Load fabric catalog from backend
            await this.loadCatalog();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('Fabric selector initialized');
            
        } catch (error) {
            console.error('Error initializing fabric selector:', error);
            Utils.showError('Could not load fabric catalog');
        }
    }

    /**
     * Load fabric catalog from backend
     */
    async loadCatalog() {
        try {
            const response = await fetch(
                `${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.FABRIC_CATALOG}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to load catalog');
            }
            
            const data = await response.json();
            this.fabrics = data.fabrics || [];
            
            console.log(`Loaded ${this.fabrics.length} fabrics`);
            this.renderFabrics();
            
        } catch (error) {
            console.error('Error loading catalog:', error);
            
            // Use default/mock fabrics if backend unavailable
            this.fabrics = this.getMockFabrics();
            this.renderFabrics();
        }
    }

    /**
     * Get mock fabrics for testing
     */
    getMockFabrics() {
        return [
            {
                id: 'denim-blue',
                name: 'Blue Denim',
                color: '#4169E1',  // Use solid color instead of textures
                roughness: 0.8,
                metalness: 0.0
            },
            {
                id: 'leather-black',
                name: 'Black Leather',
                color: '#1a1a1a',
                roughness: 0.4,
                metalness: 0.1
            },
            {
                id: 'cotton-grey',
                name: 'Grey Cotton',
                color: '#808080',
                roughness: 0.9,
                metalness: 0.0
            },
            {
                id: 'wool-navy',
                name: 'Navy Wool',
                color: '#000080',
                roughness: 0.7,
                metalness: 0.0
            },
            {
                id: 'silk-champagne',
                name: 'Champagne Silk',
                color: '#F7E7CE',
                roughness: 0.3,
                metalness: 0.2
            },
            {
                id: 'polyester-red',
                name: 'Red Polyester',
                color: '#DC143C',
                roughness: 0.6,
                metalness: 0.0
            }
        ];
    }

    /**
     * Render fabric items in UI
     */
    renderFabrics() {
        this.container.innerHTML = '';
        
        this.fabrics.forEach(fabric => {
            const item = this.createFabricItem(fabric);
            this.container.appendChild(item);
        });
    }

    /**
     * Create fabric item element
     */
    createFabricItem(fabric) {
        const item = document.createElement('div');
        item.className = 'fabric-item';
        item.dataset.fabricId = fabric.id;
        
        const thumbnail = document.createElement('div');
        thumbnail.className = 'fabric-thumbnail';
        
        // Use solid color if available, otherwise try image URLs
        if (fabric.color) {
            thumbnail.style.backgroundColor = fabric.color;
        } else if (fabric.thumbnail || fabric.diffuseUrl) {
            thumbnail.style.backgroundImage = `url(${fabric.thumbnail || fabric.diffuseUrl})`;
        }
        
        const name = document.createElement('span');
        name.textContent = fabric.name;
        
        item.appendChild(thumbnail);
        item.appendChild(name);
        
        // Click handler
        item.addEventListener('click', () => this.selectFabric(fabric));
        
        return item;
    }

    /**
     * Select a fabric
     */
    async selectFabric(fabric) {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            console.log('Selecting fabric:', fabric.name);
            
            // Update UI
            document.querySelectorAll('.fabric-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            const selectedItem = document.querySelector(`[data-fabric-id="${fabric.id}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
            
            // Show fabric info
            const infoEl = document.getElementById('selected-fabric-info');
            const nameEl = infoEl.querySelector('.fabric-name');
            nameEl.textContent = fabric.name;
            infoEl.style.display = 'block';
            
            // Apply fabric to jacket
            const success = await materialsManager.applyFabric(fabric);
            
            if (success) {
                this.selectedFabric = fabric;
            }
            
        } catch (error) {
            console.error('Error selecting fabric:', error);
            Utils.showError('Could not apply fabric');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Scan fabric button
        this.scanBtn.addEventListener('click', () => {
            this.openScanModal();
        });
        
        // Close scan modal
        document.getElementById('fabric-scan-close').addEventListener('click', () => {
            this.closeScanModal();
        });
        
        // File upload
        document.getElementById('fabric-upload').addEventListener('change', (e) => {
            this.handleFabricUpload(e.target.files[0]);
        });
    }

    /**
     * Open fabric scan modal
     */
    openScanModal() {
        this.scanModal.classList.add('active');
    }

    /**
     * Close fabric scan modal
     */
    closeScanModal() {
        this.scanModal.classList.remove('active');
        document.getElementById('scan-processing').style.display = 'none';
    }

    /**
     * Handle fabric photo upload
     */
    async handleFabricUpload(file) {
        if (!file) return;
        
        try {
            // Show processing UI
            document.getElementById('scan-processing').style.display = 'block';
            
            // Convert to base64
            const base64 = await Utils.blobToBase64(file);
            
            // Send to backend for processing
            const response = await fetch(
                `${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.FABRIC_SCAN}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ image: base64 })
                }
            );
            
            if (!response.ok) {
                throw new Error('Fabric processing failed');
            }
            
            const data = await response.json();
            
            // Create fabric object from processed data
            const customFabric = {
                id: `custom-${Date.now()}`,
                name: 'Custom Fabric',
                diffuseUrl: data.diffuseUrl,
                normalUrl: data.normalUrl,
                roughnessUrl: data.roughnessUrl,
                thumbnail: data.diffuseUrl,
                roughness: data.roughness || 0.8,
                metalness: data.metalness || 0.0
            };
            
            // Add to catalog
            this.fabrics.unshift(customFabric);
            this.renderFabrics();
            
            // Select the new fabric
            await this.selectFabric(customFabric);
            
            // Close modal
            this.closeScanModal();
            
            Utils.showError('Fabric scanned successfully!'); // Using error toast for success message
            
        } catch (error) {
            console.error('Error uploading fabric:', error);
            Utils.showError('Could not process fabric photo');
        } finally {
            document.getElementById('scan-processing').style.display = 'none';
        }
    }

    /**
     * Get selected fabric
     */
    getSelectedFabric() {
        return this.selectedFabric;
    }

    /**
     * Add custom fabric to catalog
     */
    addFabric(fabric) {
        this.fabrics.push(fabric);
        this.renderFabrics();
    }
}

// Create global instance
const fabricSelector = new FabricSelector();