/**
 * WebGLVisuals - 3D visualization engine using Three.js
 * This provides additional WebGL-based 3D visualizations for LiveArt
 */
class WebGLVisuals {
    constructor(containerId) {
        // Get the container
        this.container = document.getElementById(containerId);
        
        // Set up WebGL state and flags
        this.isInitialized = false;
        this.isActive = false;
        this.frameId = null;
        this.time = 0;
        this.lastTimeUpdated = 0;
        
        // FPS tracking
        this.fps = 0;
        this.fpsUpdateInterval = 500; // Update FPS display every 500ms
        this.lastFpsUpdate = 0;
        
        // Grid visibility flag
        this.showGrid = false; // Grid is hidden by default
        
        // 3D transformation properties that can be controlled via MIDI
        this.rotationX = 0;
        this.rotationY = 0;
        this.translationZ = 0;
        
        // Smoothing variables for transformations
        this._lastRotationX = 0;
        this._lastRotationY = 0;
        this._lastTranslationZ = 0;
        
        // Post-processing effects
        this.effectsEnabled = false;
        this.activeEffects = [];
        this.effectParams = {
            glitchIntensity: 0,
            bloomStrength: 0,
            bloomThreshold: 0.5,
            bloomRadius: 0,
            rgbShiftAmount: 0,
            vignetteAmount: 0
        };
        
        // Parameters (mirroring the same structure as in VisualEngine)
        this.params = {
            hue: 0.5,            // Base color hue (0-1)
            saturation: 0.8,     // Color saturation (0-1)
            brightness: 0.9,     // Color brightness (0-1)
            density: 0.5,        // Object density (0-1)
            speed: 0.5,          // Animation speed (0-1)
            size: 0.5,           // Object size (0-1)
            complexity: 0.5,     // Scene complexity (0-1)
            rotation: 0,         // Global rotation
            zoom: 1,             // Camera zoom
            reactivity: 0.5,     // Reactivity to changes
            smoothing: 0.5       // Parameter smoothing (0-1)
        };
        
        // Target parameters for smooth interpolation
        this.targetParams = {...this.params};
        
        // Visual scenes
        this.currentScene = 'cubeField';
        this.scenes = {
            cubeField: this.createCubeFieldScene.bind(this),
            tunnelEffect: this.createTunnelScene.bind(this),
            particleSystem: this.createParticleScene.bind(this),
            trailParticles: this.createTrailParticlesScene.bind(this)
        };
        
        // Control parameters for trail particles
        this.trailParams = {
            particleX: 0.5, // Center position X (0-1)
            particleY: 0.5, // Center position Y (0-1)
            particleSize: 0.5, // Size of particles (0-1)
            particleBrightness: 0.8, // Brightness of particles (0-1)
            trailLength: 0.7, // Length of the particle trails (0-1)
            particleCount: 100 // Number of particles
        };
        
        // Objects for current scene
        this.objects = {};
        
        // Promise that resolves when THREE.js is available
        this.threePromise = this.waitForTHREE();
    }
    
    /**
     * Wait for THREE.js to be available in global scope
     */
    waitForTHREE() {
        return new Promise((resolve) => {
            // Check if THREE is already available
            if (typeof THREE !== 'undefined') {
                resolve();
                return;
            }
            
            // Otherwise check every 100ms
            const checkInterval = setInterval(() => {
                if (typeof THREE !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
    
    /**
     * Initialize the WebGL renderer and basic scene
     */
    async init() {
        if (this.isInitialized) return;
        
        // Wait for THREE.js to be available
        await this.threePromise;
        
        try {
            // Create renderer with better settings for visibility
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: false  // No transparency
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
            this.renderer.setClearColor(0x000000, 1); // Solid black background
            
            // Add renderer to container with improved positioning
            this.renderer.domElement.style.position = 'absolute';
            this.renderer.domElement.style.top = '0';
            this.renderer.domElement.style.left = '0';
            this.renderer.domElement.style.zIndex = '1'; // Make sure it's above the canvas
            this.renderer.domElement.style.display = 'none'; // Hidden initially
            this.container.parentNode.appendChild(this.renderer.domElement); // Attach to parent instead
            
            // Create camera
            this.camera = new THREE.PerspectiveCamera(
                75, window.innerWidth / window.innerHeight, 0.1, 1000
            );
            this.camera.position.z = 5;
            
            // Initialize post-processing effects
            this.initPostProcessing();
            
            // Handle resize
            window.addEventListener('resize', this.onResize.bind(this));
            
            // Set flag
            this.isInitialized = true;
            console.log('WebGL visualizations initialized');
            
            // Create initial scene
            this.loadScene(this.currentScene);
        } catch(err) {
            console.error('Error initializing WebGL:', err);
            // Hide the THREE.js error banner if it exists
            const errorBanner = document.querySelector('.three-error');
            if (errorBanner) {
                errorBanner.style.display = 'none';
            }
        }
    }
    
    /**
     * Load a specific scene
     * @param {string} sceneName - The name of the scene to load
     */
    loadScene(sceneName) {
        if (!this.isInitialized) {
            this.init().then(() => this.loadScene(sceneName));
            return;
        }
        
        // Check if the scene exists
        if (!this.scenes[sceneName]) {
            console.error(`Scene ${sceneName} does not exist`);
            return;
        }
        
        // Clean up previous scene
        if (this.scene) {
            this.disposeScene(this.scene);
        }
        
        // Create new scene
        this.scene = new THREE.Scene();
        
        // Reset objects
        this.objects = {};
        
        // Call the scene creation function
        try {
            this.scenes[sceneName]();
        } catch (e) {
            console.error(`Error creating scene ${sceneName}:`, e);
        }
        
        // Update current scene
        this.currentScene = sceneName;
        
        // Update the render pass in the composer if effects are enabled
        if (this.composer && this.effectsEnabled) {
            // Replace the first pass which should be the render pass
            if (this.composer.passes.length > 0 && this.composer.passes[0] instanceof THREE.RenderPass) {
                this.composer.passes[0] = new THREE.RenderPass(this.scene, this.camera);
            } else {
                // If for some reason we don't have a render pass, reinitialize post-processing
                this.initPostProcessing();
            }
        }
        
        // Force a render to update the scene with current parameters
        if (this.isActive && this.renderer) {
            try {
                if (this.effectsEnabled && this.composer) {
                    this.composer.render(0);
                } else {
                    this.renderer.render(this.scene, this.camera);
                }
            } catch (e) {
                console.warn("Error rendering new scene:", e);
            }
        }
        
        console.log(`Loaded WebGL scene: ${sceneName}`);
    }
    
    /**
     * Get the name of the current scene
     * @returns {string} The current scene name
     */
    getCurrentScene() {
        return this.currentScene;
    }
    
    /**
     * Dispose of a scene to prevent memory leaks
     * @param {THREE.Scene} scene - The scene to dispose
     */
    disposeScene(scene) {
        scene.traverse(object => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => this.disposeMaterial(material));
                } else {
                    this.disposeMaterial(object.material);
                }
            }
        });
    }
    
    /**
     * Dispose of a material to prevent memory leaks
     * @param {THREE.Material} material - The material to dispose
     */
    disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.aoMap) material.aoMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        if (material.bumpMap) material.bumpMap.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.displacementMap) material.displacementMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.alphaMap) material.alphaMap.dispose();
        if (material.envMap) material.envMap.dispose();
        material.dispose();
    }
    
    /**
     * Convert HSV to RGB for THREE.js colors
     * @param {number} h - Hue (0-1)
     * @param {number} s - Saturation (0-1)
     * @param {number} v - Value/Brightness (0-1)
     * @returns {THREE.Color} - THREE.js color
     */
    hsvToThree(h, s, v) {
        // Scale hue to 0-360
        h = h * 360;
        
        // Calculation
        const chroma = v * s;
        const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - chroma;
        
        let r, g, b;
        
        if (h < 60) {
            r = chroma; g = x; b = 0;
        } else if (h < 120) {
            r = x; g = chroma; b = 0;
        } else if (h < 180) {
            r = 0; g = chroma; b = x;
        } else if (h < 240) {
            r = 0; g = x; b = chroma;
        } else if (h < 300) {
            r = x; g = 0; b = chroma;
        } else {
            r = chroma; g = 0; b = x;
        }
        
        return new THREE.Color(r + m, g + m, b + m);
    }
    
    /**
     * Map a parameter from 0-1 to a given range
     * @param {number} value - Parameter value (0-1)
     * @param {number} min - Minimum output value
     * @param {number} max - Maximum output value
     * @returns {number} - Mapped value
     */
    mapParam(value, min, max) {
        return min + value * (max - min);
    }
    
    /**
     * Handle window resize
     */
    onResize() {
        if (!this.isInitialized) return;
        
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * Set a parameter value
     * @param {string} paramName - Parameter name
     * @param {number} value - Parameter value (0-1)
     */
    setParam(paramName, value) {
        // Handle regular parameters
        if (this.params.hasOwnProperty(paramName)) {
            // For the smoothing parameter itself, apply immediately with reactivity
            if (paramName === 'smoothing') {
                const reactivity = this.params.reactivity;
                this.params[paramName] = this.params[paramName] * (1 - reactivity) + value * reactivity;
                this.targetParams[paramName] = this.params[paramName];
                return;
            }
            
            // Core parameters like brightness should be reflected immediately in the UI
            // even while smoothly interpolating in the actual rendering
            if (paramName === 'brightness' || paramName === 'hue' || paramName === 'saturation') {
                // Update immediately for UI responsiveness
                this.params[paramName] = value;
                this.targetParams[paramName] = value;
            } else {
                // Apply reactivity to the target value for all other parameters
                const reactivity = this.params.reactivity;
                this.targetParams[paramName] = this.targetParams[paramName] * (1 - reactivity) + value * reactivity;
            }
        }
        
        // Handle 3D transformation parameters
        if (paramName === 'rotationX' || paramName === 'rotationY' || paramName === 'translationZ') {
            // Apply custom mapped values with min/max ranges
            let mappedValue;
            
            if (paramName === 'rotationX' || paramName === 'rotationY') {
                // Map from 0-1 to -PI to PI for rotations
                mappedValue = -Math.PI + value * (Math.PI * 2);
            } else if (paramName === 'translationZ') {
                // Map from 0-1 to -10 to 10 for translation
                mappedValue = -10 + value * 20;
            }
            
            // Apply the mapped value directly to the property
            this[paramName] = mappedValue;
            
            return; // Skip other parameter handling
        }
        
        // Handle trail particle parameters
        if (paramName === 'particleX' || 
            paramName === 'particleY' || 
            paramName === 'particleSize' || 
            paramName === 'particleBrightness' ||
            paramName === 'trailLength') {
            
            // Apply reactivity for smoother transitions
            const reactivity = this.params.reactivity || 0.5;
            this.trailParams[paramName] = this.trailParams[paramName] * (1 - reactivity) + value * reactivity;
            
            return; // Skip other parameter handling
        }
        
        // Check if this is an effect parameter
        this.setEffectParam(paramName, value);
    }
    
    /**
     * Set a post-processing effect parameter
     * @param {string} paramName - Effect parameter name
     * @param {number} value - Parameter value (0-1)
     */
    setEffectParam(paramName, value) {
        // Map parameter names to effect parameters
        switch (paramName) {
            case 'glitchIntensity':
            case 'bloomStrength':
            case 'bloomRadius':
            case 'bloomThreshold':
            case 'rgbShiftAmount':
            case 'vignetteAmount':
                // Apply reactivity for smoother transitions
                const reactivity = this.params.reactivity || 0.5;
                this.effectParams[paramName] = this.effectParams[paramName] * (1 - reactivity) + value * reactivity;
                break;
                
            // Special case for toggling effects on/off
            case 'effectsEnabled':
                this.effectsEnabled = value > 0.5;
                break;
        }
    }
    
    /**
     * Start rendering the WebGL scene
     */
    start() {
        if (!this.isInitialized) {
            this.init().then(() => this.start());
            return;
        }
        
        if (this.isActive) return;
        
        // Make sure the 2D canvas is hidden
        const canvas2D = document.getElementById('visualizer');
        if (canvas2D) {
            // Hide the 2D canvas completely
            canvas2D.style.visibility = 'hidden';
            canvas2D.style.display = 'none';
        }
        
        // Show the WebGL renderer with proper styling
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.visibility = 'visible';
        this.renderer.domElement.style.zIndex = '5'; // Ensure it's on top
        this.isActive = true;
        this.lastTimeUpdated = performance.now();
        
        // Make sure WebGL canvas is visible before rendering
        setTimeout(() => {
            this.renderer.render(this.scene, this.camera);
            this.animate();
            console.log('WebGL visualization render forced and animation started');
        }, 50);
        
        console.log('WebGL visualizations started, display:', this.renderer.domElement.style.display);
    }
    
    /**
     * Stop rendering the WebGL scene
     */
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        
        // Hide the renderer completely
        this.renderer.domElement.style.display = 'none';
        this.renderer.domElement.style.visibility = 'hidden';
        
        // Show the 2D canvas again
        const canvas2D = document.getElementById('visualizer');
        if (canvas2D) {
            canvas2D.style.visibility = 'visible';
            canvas2D.style.display = 'block';
        }
        
        console.log('WebGL visualizations stopped');
    }
    
    /**
     * Initialize post-processing pipeline
     */
    initPostProcessing() {
        // Only initialize if THREE is available
        if (typeof THREE === 'undefined' || !this.renderer || !this.isInitialized) return;
        
        try {
            // Try to import and initialize the EffectComposer and effects
            if (THREE.EffectComposer) {
                // Create effect composer
                this.composer = new THREE.EffectComposer(this.renderer);
                
                // Add render pass
                const renderPass = new THREE.RenderPass(this.scene, this.camera);
                this.composer.addPass(renderPass);
                
                // Setup potential effects (but don't enable them yet)
                this.setupEffects();
                
                // Enable effects
                this.effectsEnabled = true;
                console.log('WebGL post-processing initialized');
            } else {
                console.log('THREE.EffectComposer not available, post-processing disabled');
                this.effectsEnabled = false;
            }
        } catch (e) {
            console.warn('Could not initialize post-processing:', e);
            this.effectsEnabled = false;
        }
    }
    
    /**
     * Setup potential post-processing effects
     */
    setupEffects() {
        if (!this.composer) return;
        
        try {
            // Glitch effect
            if (THREE.GlitchPass) {
                this.glitchPass = new THREE.GlitchPass();
                this.glitchPass.goWild = false; // Not going completely wild
                this.glitchPass.enabled = false; // Off by default
                this.composer.addPass(this.glitchPass);
            }
            
            // RGB Shift effect
            if (THREE.ShaderPass && THREE.RGBShiftShader) {
                this.rgbShiftPass = new THREE.ShaderPass(THREE.RGBShiftShader);
                this.rgbShiftPass.uniforms.amount.value = 0.0;
                this.rgbShiftPass.enabled = false; // Off by default
                this.composer.addPass(this.rgbShiftPass);
            }
            
            // Bloom effect
            if (THREE.UnrealBloomPass) {
                this.bloomPass = new THREE.UnrealBloomPass(
                    new THREE.Vector2(window.innerWidth, window.innerHeight),
                    0.0, // strength
                    0.5, // radius
                    0.5  // threshold
                );
                this.bloomPass.enabled = false; // Off by default
                this.composer.addPass(this.bloomPass);
            }
            
            // Vignette effect
            if (THREE.ShaderPass && THREE.VignetteShader) {
                this.vignettePass = new THREE.ShaderPass(THREE.VignetteShader);
                this.vignettePass.uniforms.offset.value = 0.95;
                this.vignettePass.uniforms.darkness.value = 1.0; // Use black (1.0) instead of white
                this.vignettePass.enabled = false; // Off by default
                this.composer.addPass(this.vignettePass);
            }
            
            // Make sure the last pass renders to screen
            const lastPass = this.composer.passes[this.composer.passes.length - 1];
            if (lastPass) {
                lastPass.renderToScreen = true;
            }
            
            console.log('Post-processing effects setup complete');
        } catch (e) {
            console.warn('Could not setup some effects:', e);
        }
    }
    
    /**
     * Toggle grid visibility
     */
    toggleGrid() {
        this.showGrid = !this.showGrid;
        
        // Update any existing grid helpers in the scene
        if (this.objects.gridHelper) {
            this.objects.gridHelper.visible = this.showGrid;
        }
        
        console.log(`Grid visibility: ${this.showGrid ? 'visible' : 'hidden'}`);
    }
    
    /**
     * Update post-processing effects
     */
    updateEffects() {
        if (!this.effectsEnabled || !this.composer) {
            console.log('Effects disabled or composer not initialized');
            return;
        }
        
        // Debug what effects are currently set to
        console.log('3D Effects status:', {
            enabled: this.effectsEnabled,
            bloomStrength: this.effectParams.bloomStrength > 0 ? `${this.effectParams.bloomStrength.toFixed(2)}` : 'off',
            bloomRadius: this.effectParams.bloomRadius > 0 ? `${this.effectParams.bloomRadius.toFixed(2)}` : 'off',
            glitchIntensity: this.effectParams.glitchIntensity > 0 ? `${this.effectParams.glitchIntensity.toFixed(2)}` : 'off',
            rgbShift: this.effectParams.rgbShiftAmount > 0 ? `${this.effectParams.rgbShiftAmount.toFixed(2)}` : 'off',
            vignette: this.effectParams.vignetteAmount > 0 ? `${this.effectParams.vignetteAmount.toFixed(2)}` : 'off'
        });
        
        // Update Glitch effect
        if (this.glitchPass) {
            if (this.effectParams.glitchIntensity > 0) {
                this.glitchPass.enabled = true;
                // Set glitch intensity (controls probability of glitching)
                const glitchProbability = this.effectParams.glitchIntensity * 0.1;
                if (Math.random() < glitchProbability) {
                    this.glitchPass.curF = Math.random() * 64;
                    this.glitchPass.generateTrigger();
                }
            } else {
                this.glitchPass.enabled = false;
            }
        }
        
        // Update Bloom effect
        if (this.bloomPass) {
            if (this.effectParams.bloomStrength > 0) {
                this.bloomPass.enabled = true;
                this.bloomPass.strength = this.effectParams.bloomStrength * 2;
                this.bloomPass.radius = this.effectParams.bloomRadius * 1.5;
                this.bloomPass.threshold = this.effectParams.bloomThreshold;
            } else {
                this.bloomPass.enabled = false;
            }
        }
        
        // Update RGB Shift effect
        if (this.rgbShiftPass) {
            if (this.effectParams.rgbShiftAmount > 0) {
                this.rgbShiftPass.enabled = true;
                this.rgbShiftPass.uniforms.amount.value = this.effectParams.rgbShiftAmount * 0.02;
                this.rgbShiftPass.uniforms.angle.value = this.time * 0.5;
            } else {
                this.rgbShiftPass.enabled = false;
            }
        }
        
        // Update Vignette effect
        if (this.vignettePass) {
            if (this.effectParams.vignetteAmount > 0) {
                this.vignettePass.enabled = true;
                this.vignettePass.uniforms.offset.value = 0.95 - this.effectParams.vignetteAmount * 0.5;
                this.vignettePass.uniforms.darkness.value = this.effectParams.vignetteAmount * 1.5;
            } else {
                this.vignettePass.enabled = false;
            }
        }
    }
    
    /**
     * Animation loop
     */
    /**
     * Update the FPS counter display
     * @param {number} delta - Time in milliseconds since last frame
     */
    updateFPS(deltaSeconds) {
        // Convert delta seconds to milliseconds for consistency with VisualEngine
        const delta = deltaSeconds * 1000;
        
        // Calculate current FPS
        this.fps = 1000 / delta;
        
        // Update display occasionally to avoid rapid changes
        if (performance.now() - this.lastFpsUpdate > this.fpsUpdateInterval) {
            document.getElementById('fps').textContent = Math.round(this.fps);
            this.lastFpsUpdate = performance.now();
        }
    }
    
    animate() {
        if (!this.isActive) return;
        
        try {
            this.frameId = requestAnimationFrame(this.animate.bind(this));
            
            // Calculate delta time and update time counter
            const now = performance.now();
            const delta = (now - this.lastTimeUpdated) * 0.001; // Convert to seconds
            this.lastTimeUpdated = now;
            
            // Update parameters with smoothing
            this.updateParamsWithSmoothing(delta);
            
            // Update FPS counter
            this.updateFPS(delta);
            
            // Update global time (scaled by speed)
            this.time += delta * this.mapParam(this.params.speed, 0.2, 2);
            
            // Update scene objects - only if scene exists
            if (this.scene) {
                this.updateScene(delta);
            }
            
            // Update post-processing effects - check if we need to initialize effects
            if (this.effectsEnabled && (!this.composer || this.composer.passes.length <= 1)) {
                console.log('Effects were enabled but composer not initialized, initializing now');
                this.initPostProcessing();
            }
            
            // Always update effects if they're enabled
            if (this.effectsEnabled) {
                this.updateEffects();
            }
            
            // Render scene (with or without effects)
            if (this.effectsEnabled && this.composer && this.scene) {
                try {
                    // Make sure at least one pass is active
                    let anyPassEnabled = false;
                    for (let i = 0; i < this.composer.passes.length; i++) {
                        if (this.composer.passes[i].enabled) {
                            anyPassEnabled = true;
                            break;
                        }
                    }
                    
                    // If no passes are active, enable the bloom pass as default
                    if (!anyPassEnabled && this.bloomPass) {
                        console.log('No active passes found, enabling bloom as default');
                        this.bloomPass.enabled = true;
                        this.bloomPass.strength = 0.5;
                    }
                    
                    this.composer.render(delta);
                } catch (e) {
                    console.warn("Composer render error:", e);
                    // Fallback to standard renderer
                    this.renderer.render(this.scene, this.camera);
                }
            } else if (this.scene) {
                this.renderer.render(this.scene, this.camera);
            }
        } catch (e) {
            console.error("Error in animation loop:", e);
            // Don't let errors stop the animation
            this.frameId = requestAnimationFrame(this.animate.bind(this));
        }
    }
    
    /**
     * Update the current scene
     * @param {number} delta - Time since last frame in seconds
     */
    updateScene(delta) {
        if (!this.scene) return;
        
        // Common parameters
        const rotationSpeed = this.mapParam(this.params.rotation, -0.5, 0.5) * delta;
        
        // Apply MIDI controllable transformations (rotation) with smooth interpolation
        // Calculate smoother rotation transitions
        if (this._lastRotationX === undefined) this._lastRotationX = this.rotationX;
        if (this._lastRotationY === undefined) this._lastRotationY = this.rotationY;
        if (this._lastTranslationZ === undefined) this._lastTranslationZ = this.translationZ;
        
        // Interpolate rotation X with easing
        this._lastRotationX += (this.rotationX - this._lastRotationX) * 0.1;
        this.scene.rotation.x = this._lastRotationX;
        
        // Interpolate rotation Y with easing
        this._lastRotationY += (this.rotationY - this._lastRotationY) * 0.1;
        this.scene.rotation.y = this._lastRotationY;
        
        // Add general scene rotation from rotation param if enabled
        this.scene.rotation.z += rotationSpeed;
        
        // Update camera zoom and Z position with smooth interpolation
        const baseZoom = this.mapParam(this.params.zoom, 2, 10);
        this._lastTranslationZ += (this.translationZ - this._lastTranslationZ) * 0.1;
        this.camera.position.z = baseZoom + this._lastTranslationZ;
        
        // Scene-specific updates
        switch (this.currentScene) {
            case 'cubeField':
                this.updateCubeFieldScene(delta);
                break;
            case 'tunnelEffect':
                this.updateTunnelScene(delta);
                break;
            case 'particleSystem':
                this.updateParticleScene(delta);
                break;
            case 'trailParticles':
                this.updateTrailParticlesScene(delta);
                break;
        }
    }
    
    /**
     * Create a field of animated cubes
     */
    createCubeFieldScene() {
        // Base parameters
        const cubeCount = Math.floor(this.mapParam(this.params.density, 50, 500));
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        
        // Add stronger lighting for better visibility
        const ambientLight = new THREE.AmbientLight(0x808080, 1.5);
        this.scene.add(ambientLight);
        
        // Add directional light with increased intensity
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 5, 5);
        this.scene.add(dirLight);
        
        // Add a second directional light from another angle
        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight2.position.set(-5, -2, 3);
        this.scene.add(dirLight2);
        
        // Create cubes
        const cubes = [];
        const cubeSize = this.mapParam(this.params.size, 0.1, 0.5); // Larger size for visibility
        const spread = this.mapParam(this.params.complexity, 5, 15);
        
        // Single geometry and materials for better performance
        const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const materials = [];
        
        // Create cubes with vibrant colors
        for (let i = 0; i < cubeCount; i++) {
            // Vary color slightly
            const colorHue = (hue + i / cubeCount * 0.3) % 1;
            const material = new THREE.MeshPhongMaterial({
                color: this.hsvToThree(colorHue, saturation, brightness),
                shininess: 80,
                specular: new THREE.Color(0x888888), // Brighter specular highlights
                emissive: this.hsvToThree(colorHue, saturation * 0.5, brightness * 0.2) // Add emissive for glow
            });
            materials.push(material);
            
            const cube = new THREE.Mesh(geometry, material);
            
            // Random position
            cube.position.x = (Math.random() - 0.5) * spread;
            cube.position.y = (Math.random() - 0.5) * spread;
            cube.position.z = (Math.random() - 0.5) * spread;
            
            // Random rotation
            cube.rotation.x = Math.random() * Math.PI * 2;
            cube.rotation.y = Math.random() * Math.PI * 2;
            cube.rotation.z = Math.random() * Math.PI * 2;
            
            // Store original properties for animation
            cube.userData = {
                originalPosition: cube.position.clone(),
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 2,
                    y: (Math.random() - 0.5) * 2,
                    z: (Math.random() - 0.5) * 2
                }
            };
            
            this.scene.add(cube);
            cubes.push(cube);
        }
        
        // Create a subtle background with a grid
        const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
        gridHelper.visible = this.showGrid; // Set visibility based on showGrid flag
        this.scene.add(gridHelper);
        
        // Store in objects
        this.objects.cubes = cubes;
        this.objects.geometry = geometry;
        this.objects.materials = materials;
        this.objects.gridHelper = gridHelper;
    }
    
    /**
     * Update the cube field scene
     * @param {number} delta - Time since last frame in seconds
     */
    updateCubeFieldScene(delta) {
        if (!this.objects.cubes) return;
        
        const cubes = this.objects.cubes;
        const speed = this.mapParam(this.params.speed, 0.1, 2);
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const waveScale = this.mapParam(this.params.complexity, 0.5, 3);
        
        // Rotate camera
        this.scene.rotation.y += this.params.rotation * delta * 0.5;
        
        // Update each cube
        cubes.forEach((cube, i) => {
            // Update rotation
            cube.rotation.x += cube.userData.rotationSpeed.x * delta * speed;
            cube.rotation.y += cube.userData.rotationSpeed.y * delta * speed;
            cube.rotation.z += cube.userData.rotationSpeed.z * delta * speed;
            
            // Update position with wave motion
            const originalPos = cube.userData.originalPosition;
            const timeOffset = this.time + i * 0.05;
            const waveX = Math.sin(timeOffset) * waveScale;
            const waveY = Math.cos(timeOffset * 0.7) * waveScale;
            const waveZ = Math.sin(timeOffset * 0.3) * Math.cos(timeOffset * 0.5) * waveScale;
            
            cube.position.x = originalPos.x + waveX;
            cube.position.y = originalPos.y + waveY;
            cube.position.z = originalPos.z + waveZ;
            
            // Update color
            const colorHue = (hue + i / cubes.length * 0.3) % 1;
            if (this.objects.materials && this.objects.materials[i]) {
                this.objects.materials[i].color = this.hsvToThree(colorHue, saturation, brightness);
            }
        });
    }
    
    /**
     * Create an endless tunnel effect with improved visibility
     */
    createTunnelScene() {
        // Add stronger ambient light
        const ambientLight = new THREE.AmbientLight(0x888888, 1.5);
        this.scene.add(ambientLight);
        
        // Add point light at camera position
        const pointLight = new THREE.PointLight(0xffffff, 2, 50);
        pointLight.position.set(0, 0, 3);
        this.scene.add(pointLight);
        
        // Parameters
        const tunnelRadius = 5;
        const tunnelLength = 30;
        const segments = Math.max(6, Math.floor(this.mapParam(this.params.complexity, 8, 24)));
        const rings = Math.floor(this.mapParam(this.params.density, 20, 100));
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        
        // Create tunnel segments
        const tunnelSegments = [];
        const materials = [];
        
        // Add a background sphere for additional effect
        const bgSphereGeometry = new THREE.SphereGeometry(40, 32, 32);
        const bgSphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.BackSide,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const bgSphere = new THREE.Mesh(bgSphereGeometry, bgSphereMaterial);
        this.scene.add(bgSphere);
        this.objects.bgSphere = bgSphere;
        
        // Create a group to hold all rings
        const tunnelGroup = new THREE.Group();
        this.scene.add(tunnelGroup);
        this.objects.tunnelGroup = tunnelGroup;
        
        try {
            // Create rings with better visibility
            for (let ring = 0; ring < rings; ring++) {
                const z = ring * (tunnelLength / rings) - tunnelLength / 2;
                const ringRadius = tunnelRadius * (1 + Math.sin(ring * 0.2) * 0.2);
                
                // Create a simple circle with segments
                const geometry = new THREE.BufferGeometry();
                const positions = [];
                
                // Create vertices in a circle
                for (let i = 0; i <= segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    const x = Math.cos(angle) * ringRadius;
                    const y = Math.sin(angle) * ringRadius;
                    positions.push(x, y, 0);
                }
                
                // Create lines connecting the vertices
                const indices = [];
                for (let i = 0; i < segments; i++) {
                    indices.push(i, i + 1);
                }
                indices.push(segments, 0); // Close the loop
                
                // Set geometry attributes
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geometry.setIndex(indices);
                
                // Move to the right z position
                geometry.translate(0, 0, z);
                
                // Create material with varying color
                const ringHue = (hue + ring / rings * 0.5) % 1;
                const material = new THREE.LineBasicMaterial({
                    color: this.hsvToThree(ringHue, saturation, brightness),
                    linewidth: 2
                });
                materials.push(material);
                
                // Create the ring mesh as a line loop
                const ring_obj = new THREE.LineLoop(geometry, material);
                
                ring_obj.userData = {
                    originalZ: z,
                    hueOffset: ring / rings * 0.5
                };
                
                tunnelGroup.add(ring_obj);
                tunnelSegments.push(ring_obj);
            }
            
            // Also add some straight lines connecting the rings for a grid effect
            const gridLines = 12; // Number of grid lines
            for (let i = 0; i < gridLines; i++) {
                const angle = (i / gridLines) * Math.PI * 2;
                const x = Math.cos(angle) * tunnelRadius;
                const y = Math.sin(angle) * tunnelRadius;
                
                // Create a line geometry
                const lineGeometry = new THREE.BufferGeometry();
                const positions = [
                    x, y, -tunnelLength/2,  // Start point
                    x, y, tunnelLength/2    // End point
                ];
                
                lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                
                // Create material with hue based on angle
                const lineHue = (hue + i / gridLines) % 1;
                const material = new THREE.LineBasicMaterial({
                    color: this.hsvToThree(lineHue, saturation * 0.8, brightness * 0.6),
                    linewidth: 1,
                    transparent: true,
                    opacity: 0.5
                });
                
                materials.push(material);
                
                // Create line and add to group
                const line = new THREE.Line(lineGeometry, material);
                tunnelGroup.add(line);
                tunnelSegments.push(line);
            }
            
            // Store objects 
            this.objects.tunnelSegments = tunnelSegments;
            this.objects.materials = materials;
            
        } catch (error) {
            console.error("Error creating tunnel scene:", error);
        }
    }
    
    /**
     * Update the tunnel effect scene
     * @param {number} delta - Time since last frame in seconds
     */
    updateTunnelScene(delta) {
        if (!this.objects.tunnelSegments) return;
        
        const tunnelSegments = this.objects.tunnelSegments;
        const tunnelLength = 30;
        const speed = this.mapParam(this.params.speed, 0.5, 5) * delta;
        const rotation = this.mapParam(this.params.rotation, -1, 1);
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        
        // Rotate the entire tunnel group for a global rotation effect
        if (this.objects.tunnelGroup) {
            this.objects.tunnelGroup.rotation.z += rotation * delta;
        }
        
        // Update each tunnel segment
        tunnelSegments.forEach((segment, i) => {
            // Only move ring segments (not grid lines) along z-axis
            if (segment.userData && segment.userData.originalZ !== undefined) {
                // Get the original z position from userData
                let z = segment.userData.originalZ + speed * this.time * 5;
                
                // Create a repeating motion by using modulo
                z = z % tunnelLength - tunnelLength / 2;
                
                // Set new z position 
                segment.position.z = z;
                
                // Update colors for rings with smooth transition
                const ringHue = (hue + segment.userData.hueOffset + this.time * 0.1) % 1;
                if (this.objects.materials && this.objects.materials[i]) {
                    this.objects.materials[i].color = this.hsvToThree(ringHue, saturation, brightness);
                }
            }
        });
        
        // Also update the background sphere rotation
        if (this.objects.bgSphere) {
            this.objects.bgSphere.rotation.x = this.time * 0.05;
            this.objects.bgSphere.rotation.y = this.time * 0.1;
        }
    }
    
    /**
     * Create a 3D particle system with enhanced visuals
     */
    createParticleScene() {
        // Parameters
        const particleCount = Math.floor(this.mapParam(this.params.density, 2000, 15000));
        const particleSize = this.mapParam(this.params.size, 0.05, 0.3);
        const spread = this.mapParam(this.params.complexity, 5, 15);
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        
        // Create a particle texture for better visibility
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        
        // Draw a soft circle with gradient
        const gradient = ctx.createRadialGradient(
            size/2, size/2, 0,
            size/2, size/2, size/2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create particle geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3); // x, y, z for each particle
        const colors = new Float32Array(particleCount * 3); // r, g, b for each particle
        const sizes = new Float32Array(particleCount); // Size variation
        const velocities = []; // Store velocities in userData
        
        // Create particles with random positions, colors, sizes, and velocities
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Position - create a sphere volume distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = Math.cbrt(Math.random()) * spread; // Cube root for uniform volume distribution
            
            positions[i3] = Math.sin(phi) * Math.cos(theta) * radius;
            positions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * radius;
            positions[i3 + 2] = Math.cos(phi) * radius;
            
            // Color (vary based on position and distance from center)
            const distanceRatio = radius / spread;
            const particleHue = (hue + distanceRatio * 0.5) % 1;
            const color = this.hsvToThree(particleHue, saturation, brightness);
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Size variation - particles farther from center are larger
            sizes[i] = particleSize * (0.5 + distanceRatio);
            
            // Velocity - spiral motion
            const speed = 0.02 + Math.random() * 0.03;
            velocities.push({
                x: (Math.random() - 0.5) * speed,
                y: (Math.random() - 0.5) * speed,
                z: (Math.random() - 0.5) * speed,
                // Add orbital component
                orbit: Math.random() * Math.PI * 2,
                orbitSpeed: (Math.random() * 0.5 + 0.5) * 0.01,
                orbitRadius: radius * (0.1 + Math.random() * 0.2)
            });
        }
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Create enhanced particle material
        const material = new THREE.PointsMaterial({
            size: particleSize,
            vertexColors: true,
            map: texture,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            vertexColors: true
        });
        
        // Create particle system
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        // Add a dim point light at center for ambiance
        const centerLight = new THREE.PointLight(
            this.hsvToThree(hue, saturation * 0.7, brightness).getHex(),
            0.8,
            spread * 2
        );
        this.scene.add(centerLight);
        
        // Store in objects
        this.objects.particles = particles;
        this.objects.velocities = velocities;
        this.objects.particleCount = particleCount;
        this.objects.centerLight = centerLight;
        this.objects.textureCanvas = canvas; // Store for possible updates
    }
    
    /**
     * Create a trail particles scene
     * Particles that leave a glowing trail as they move
     */
    createTrailParticlesScene() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x222222, 1.0);
        this.scene.add(ambientLight);
        
        // Add directional light for some depth
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(0, 1, 2);
        this.scene.add(dirLight);
        
        // Add point light at center for more glow
        const centerLight = new THREE.PointLight(0xffffff, 1.5, 50);
        centerLight.position.set(0, 0, 0);
        this.scene.add(centerLight);
        
        // Base parameters - similar to particle system
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const particleCount = Math.floor(this.mapParam(this.params.density, 500, 3000));
        const spread = this.mapParam(this.params.complexity, 5, 15);
        
        // Store particle count in trail params
        this.trailParams.particleCount = particleCount;
        
        // Create particle texture - same as regular particles
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        
        // Draw a soft circle with gradient
        const gradient = ctx.createRadialGradient(
            size/2, size/2, 0,
            size/2, size/2, size/2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create main particles group
        const particlesGroup = new THREE.Group();
        this.scene.add(particlesGroup);
        
        // Trail length from params
        const trailLength = Math.floor(this.mapParam(this.trailParams.trailLength, 10, 30));
        
        // Arrays to store particles data
        const particles = [];
        const trails = [];
        const velocities = [];
        
        // Create particles and their trails
        for (let i = 0; i < particleCount; i++) {
            // Create particle position using sphere distribution - just like in particle system
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = Math.cbrt(Math.random()) * spread; // Cube root for uniform volume distribution
            
            const x = Math.sin(phi) * Math.cos(theta) * radius;
            const y = Math.sin(phi) * Math.sin(theta) * radius;
            const z = Math.cos(phi) * radius;
            
            // Color varies by distance from center
            const distanceRatio = radius / spread;
            const particleHue = (hue + distanceRatio * 0.5) % 1;
            const particleColor = this.hsvToThree(particleHue, saturation, brightness);
            
            // Create particle size based on params
            const particleSize = this.mapParam(this.params.size, 0.05, 0.3) * (0.5 + distanceRatio);
            
            // Initialize trail array for this particle
            const trail = [];
            for (let j = 0; j < trailLength; j++) {
                trail.push(new THREE.Vector3(x, y, z));
            }
            trails.push(trail);
            
            // Create line for the trail
            const trailGeometry = new THREE.BufferGeometry();
            const linePositions = new Float32Array(trailLength * 3);
            
            // Fill initial positions
            for (let j = 0; j < trailLength; j++) {
                const idx = j * 3;
                linePositions[idx] = x;
                linePositions[idx + 1] = y;
                linePositions[idx + 2] = z;
            }
            
            trailGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
            
            // Create trail material with fade
            const trailMaterial = new THREE.LineBasicMaterial({
                color: particleColor,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending
            });
            
            // Create line
            const trailLine = new THREE.Line(trailGeometry, trailMaterial);
            particlesGroup.add(trailLine);
            
            // Store velocity info like in particle system
            const speed = 0.02 + Math.random() * 0.03;
            const velocity = {
                x: (Math.random() - 0.5) * speed,
                y: (Math.random() - 0.5) * speed,
                z: (Math.random() - 0.5) * speed,
                orbit: Math.random() * Math.PI * 2,
                orbitSpeed: (Math.random() * 0.5 + 0.5) * 0.01,
                orbitRadius: radius * (0.1 + Math.random() * 0.2)
            };
            velocities.push(velocity);
            
            // Store particle info
            particles.push({
                position: new THREE.Vector3(x, y, z),
                color: particleColor,
                size: particleSize,
                trail: trail,
                trailLine: trailLine,
                trailGeometry: trailGeometry,
                trailPositions: linePositions,
                originalRadius: radius
            });
        }
        
        // Create particle system point cloud for heads
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleColors = new Float32Array(particleCount * 3);
        const particleSizes = new Float32Array(particleCount);
        
        // Fill particle attributes
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const p = particles[i];
            
            particlePositions[i3] = p.position.x;
            particlePositions[i3 + 1] = p.position.y;
            particlePositions[i3 + 2] = p.position.z;
            
            particleColors[i3] = p.color.r;
            particleColors[i3 + 1] = p.color.g;
            particleColors[i3 + 2] = p.color.b;
            
            particleSizes[i] = p.size * 2; // Make head particles larger than regular particles
        }
        
        // Set particle geometry attributes
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
        
        // Create particle material
        const particleMaterial = new THREE.PointsMaterial({
            size: this.mapParam(this.params.size, 0.05, 0.3),
            vertexColors: true,
            map: texture,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        // Create point cloud
        const pointCloud = new THREE.Points(particleGeometry, particleMaterial);
        particlesGroup.add(pointCloud);
        
        // Add a subtle background with a grid
        const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
        gridHelper.visible = this.showGrid; // Set visibility based on showGrid flag
        this.scene.add(gridHelper);
        
        // Store everything in objects
        this.objects.particles = particles;
        this.objects.trails = trails;
        this.objects.velocities = velocities;
        this.objects.particleGeometry = particleGeometry;
        this.objects.particleMaterial = particleMaterial;
        this.objects.particlesGroup = particlesGroup;
        this.objects.centerLight = centerLight;
        this.objects.gridHelper = gridHelper;
        this.objects.trailLength = trailLength;
        this.objects.texture = texture;
        this.objects.particleCount = particleCount;
    }
    
    /**
     * Create a glowing particle texture
     */
    createParticleTexture() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        
        // Create a radial gradient for glow effect
        const gradient = ctx.createRadialGradient(
            size/2, size/2, 0,
            size/2, size/2, size/2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        return new THREE.CanvasTexture(canvas);
    }
    
    /**
     * Update the trail particles scene
     * @param {number} delta - Time since last frame in seconds
     */
    updateTrailParticlesScene(delta) {
        if (!this.objects.particles || !this.objects.trails || !this.objects.velocities) return;
        
        const particles = this.objects.particles;
        const trails = this.objects.trails;
        const velocities = this.objects.velocities;
        const particleCount = this.objects.particleCount;
        const trailLength = this.objects.trailLength || 20;
        const particlesGroup = this.objects.particlesGroup;
        
        // Get parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const speed = this.mapParam(this.params.speed, 0.5, 3) * delta;
        const spread = this.mapParam(this.params.complexity, 5, 15);
        
        // MIDI controlled parameters
        const trailLengthParam = this.trailParams.trailLength; // Affects trail opacity
        const particleBrightness = this.trailParams.particleBrightness; // Affects particle glow
        
        // Update center light color
        if (this.objects.centerLight) {
            this.objects.centerLight.color = this.hsvToThree(
                (hue + this.time * 0.1) % 1, 
                saturation * 0.7, 
                brightness
            );
        }
        
        // Get particle positions and colors from geometry
        const particlePositions = this.objects.particleGeometry.getAttribute('position').array;
        const particleColors = this.objects.particleGeometry.getAttribute('color').array;
        
        // Update each particle
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const particle = particles[i];
            const trail = trails[i];
            const v = velocities[i];
            
            // Calculate current position
            const x = particlePositions[i3];
            const y = particlePositions[i3 + 1];
            const z = particlePositions[i3 + 2];
            
            // Calculate distance from center
            const dist = Math.sqrt(x*x + y*y + z*z);
            
            // Apply orbital motion similar to particle system
            if (v.orbit !== undefined) {
                v.orbit += v.orbitSpeed * speed * 5;
                
                // Apply orbital component based on current position
                const orbitalInfluence = Math.min(1, dist / (spread * 0.5)); // More effect farther out
                
                // Create normalized direction vector from center
                let nx = x / (dist || 1);
                let ny = y / (dist || 1);
                let nz = z / (dist || 1);
                
                // Create perpendicular vector for orbit
                const px = -ny;
                const py = nx;
                const pz = 0; // Simplify by orbiting on XY plane
                
                // Update position with velocity and orbital component
                particlePositions[i3] += (v.x + px * v.orbitRadius * orbitalInfluence * Math.cos(v.orbit)) * speed;
                particlePositions[i3 + 1] += (v.y + py * v.orbitRadius * orbitalInfluence * Math.sin(v.orbit)) * speed;
                particlePositions[i3 + 2] += (v.z + pz * v.orbitRadius * orbitalInfluence) * speed;
            } else {
                // Basic motion for particles without orbital component
                particlePositions[i3] += v.x * speed;
                particlePositions[i3 + 1] += v.y * speed;
                particlePositions[i3 + 2] += v.z * speed;
            }
            
            // Apply gravitational pull toward/away from center based on time
            const gravityDirection = Math.sin(this.time * 0.2) > 0 ? 1 : -1;
            const gravity = gravityDirection * speed * 0.05;
            
            // Direction to/from center
            const newX = particlePositions[i3];
            const newY = particlePositions[i3 + 1];
            const newZ = particlePositions[i3 + 2];
            const newDist = Math.sqrt(newX*newX + newY*newY + newZ*newZ);
            
            if (newDist > 0.1) { // Avoid division by zero
                particlePositions[i3] -= (newX / newDist) * gravity * newDist * 0.1;
                particlePositions[i3 + 1] -= (newY / newDist) * gravity * newDist * 0.1;
                particlePositions[i3 + 2] -= (newZ / newDist) * gravity * newDist * 0.1;
            }
            
            // Boundary check with smooth reset
            const maxDist = spread * 0.8;
            if (newDist > maxDist) {
                // Reset to random position closer to center
                const resetDist = maxDist * 0.3;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                particlePositions[i3] = Math.sin(phi) * Math.cos(theta) * resetDist;
                particlePositions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * resetDist;
                particlePositions[i3 + 2] = Math.cos(phi) * resetDist;
                
                // Randomize orbit
                if (v.orbit !== undefined) {
                    v.orbit = Math.random() * Math.PI * 2;
                }
            }
            
            // Update color based on position and time with MIDI brightness control
            const finalDist = Math.sqrt(
                particlePositions[i3]*particlePositions[i3] + 
                particlePositions[i3+1]*particlePositions[i3+1] + 
                particlePositions[i3+2]*particlePositions[i3+2]
            );
            const distRatio = finalDist / spread;
            
            const particleHue = (hue + distRatio * 0.5 + this.time * 0.05) % 1;
            const color = this.hsvToThree(
                particleHue, 
                Math.min(1, saturation * (0.7 + distRatio * 0.5)), 
                Math.min(1, brightness * particleBrightness * (0.7 + distRatio * 0.3))
            );
            
            particleColors[i3] = color.r;
            particleColors[i3 + 1] = color.g;
            particleColors[i3 + 2] = color.b;
            
            // Update particle's stored position
            particle.position.set(
                particlePositions[i3],
                particlePositions[i3 + 1],
                particlePositions[i3 + 2]
            );
            
            // Update trail positions (shift all positions forward)
            for (let j = trailLength - 1; j > 0; j--) {
                trail[j].copy(trail[j - 1]);
            }
            
            // Head of trail is at current particle position
            trail[0].copy(particle.position);
            
            // Update trail line positions
            for (let j = 0; j < trailLength; j++) {
                const idx = j * 3;
                particle.trailPositions[idx] = trail[j].x;
                particle.trailPositions[idx + 1] = trail[j].y;
                particle.trailPositions[idx + 2] = trail[j].z;
            }
            
            // Apply fade to trail end by adjusting positions
            const fadeStartIndex = Math.floor(trailLength * 0.6);
            if (trailLength > fadeStartIndex) {
                for (let j = fadeStartIndex; j < trailLength; j++) {
                    const fadeRatio = (j - fadeStartIndex) / (trailLength - fadeStartIndex);
                    const idx = j * 3;
                    
                    // Get position and previous position
                    const x = particle.trailPositions[idx];
                    const y = particle.trailPositions[idx + 1];
                    const z = particle.trailPositions[idx + 2];
                    
                    const prevIdx = Math.max(0, (j - 1) * 3);
                    const prevX = particle.trailPositions[prevIdx];
                    const prevY = particle.trailPositions[prevIdx + 1];
                    const prevZ = particle.trailPositions[prevIdx + 2];
                    
                    // Move point closer to previous point
                    particle.trailPositions[idx] = x + (prevX - x) * fadeRatio * 0.3;
                    particle.trailPositions[idx + 1] = y + (prevY - y) * fadeRatio * 0.3;
                    particle.trailPositions[idx + 2] = z + (prevZ - z) * fadeRatio * 0.3;
                }
            }
            
            // Update trail line material color and opacity
            particle.trailLine.material.color = color;
            
            // Adjust trail opacity based on MIDI control
            const trailOpacity = this.mapParam(trailLengthParam, 0.2, 0.8);
            particle.trailLine.material.opacity = trailOpacity;
            
            // Mark buffer for update
            particle.trailGeometry.getAttribute('position').needsUpdate = true;
        }
        
        // Update geometry attributes
        this.objects.particleGeometry.getAttribute('position').needsUpdate = true;
        this.objects.particleGeometry.getAttribute('color').needsUpdate = true;
        
        // Rotate the entire particle system
        particlesGroup.rotation.y += this.params.rotation * delta * 0.2;
    }
    
    /**
     * Update the particle system scene with enhanced motion
     * @param {number} delta - Time since last frame in seconds
     */
    updateParticleScene(delta) {
        if (!this.objects.particles) return;
        
        const particles = this.objects.particles;
        const velocities = this.objects.velocities;
        const positions = particles.geometry.attributes.position.array;
        const colors = particles.geometry.attributes.color.array;
        const sizes = particles.geometry.attributes.size ? particles.geometry.attributes.size.array : null;
        const particleCount = this.objects.particleCount;
        const speed = this.mapParam(this.params.speed, 0.5, 3) * delta;
        const spread = this.mapParam(this.params.complexity, 5, 15);
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        
        // Rotate whole system
        particles.rotation.y += this.params.rotation * delta * 0.2;
        
        // Update center light color
        if (this.objects.centerLight) {
            this.objects.centerLight.color = this.hsvToThree(
                (hue + this.time * 0.1) % 1, 
                saturation * 0.7, 
                brightness
            );
        }
        
        // Update each particle
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const v = velocities[i];
            
            // Calculate current distance from center
            const x = positions[i3];
            const y = positions[i3 + 1];
            const z = positions[i3 + 2];
            const dist = Math.sqrt(x*x + y*y + z*z);
            
            // Update orbital motion
            if (v.orbit !== undefined) {
                v.orbit += v.orbitSpeed * speed * 5;
                
                // Apply orbital component based on current position
                const orbitalInfluence = Math.min(1, dist / (spread * 0.5)); // More effect farther out
                
                // Create normalized direction vector from center
                let nx = x / (dist || 1);
                let ny = y / (dist || 1);
                let nz = z / (dist || 1);
                
                // Create perpendicular vector for orbit
                const px = -ny;
                const py = nx;
                const pz = 0; // Simplify by orbiting on XY plane
                
                // Add orbital motion to velocity
                positions[i3] += (v.x + px * v.orbitRadius * orbitalInfluence * Math.cos(v.orbit)) * speed;
                positions[i3 + 1] += (v.y + py * v.orbitRadius * orbitalInfluence * Math.sin(v.orbit)) * speed;
                positions[i3 + 2] += (v.z + pz * v.orbitRadius * orbitalInfluence) * speed;
            } else {
                // Basic motion for particles without orbital component
                positions[i3] += v.x * speed;
                positions[i3 + 1] += v.y * speed;
                positions[i3 + 2] += v.z * speed;
            }
            
            // Apply gravitational pull toward/away from center based on time
            const gravityDirection = Math.sin(this.time * 0.2) > 0 ? 1 : -1;
            const gravity = gravityDirection * speed * 0.05;
            
            // Direction to/from center
            const newX = positions[i3];
            const newY = positions[i3 + 1];
            const newZ = positions[i3 + 2];
            const newDist = Math.sqrt(newX*newX + newY*newY + newZ*newZ);
            
            if (newDist > 0.1) { // Avoid division by zero
                positions[i3] -= (newX / newDist) * gravity * newDist * 0.1;
                positions[i3 + 1] -= (newY / newDist) * gravity * newDist * 0.1;
                positions[i3 + 2] -= (newZ / newDist) * gravity * newDist * 0.1;
            }
            
            // Boundary check with smooth reset
            const maxDist = spread * 0.8;
            if (newDist > maxDist) {
                // Reset to random position closer to center
                const resetDist = maxDist * 0.3;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                positions[i3] = Math.sin(phi) * Math.cos(theta) * resetDist;
                positions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * resetDist;
                positions[i3 + 2] = Math.cos(phi) * resetDist;
                
                // Randomize orbit
                if (v.orbit !== undefined) {
                    v.orbit = Math.random() * Math.PI * 2;
                }
            }
            
            // Update color based on position and time
            const finalDist = Math.sqrt(
                positions[i3]*positions[i3] + 
                positions[i3+1]*positions[i3+1] + 
                positions[i3+2]*positions[i3+2]
            );
            const distRatio = finalDist / spread;
            
            const particleHue = (hue + distRatio * 0.5 + this.time * 0.05) % 1;
            const color = this.hsvToThree(
                particleHue, 
                Math.min(1, saturation * (0.7 + distRatio * 0.5)), 
                Math.min(1, brightness * (0.7 + distRatio * 0.3))
            );
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Update size if we have a size attribute
            if (sizes) {
                // Pulse size with time and distance
                const pulse = 0.8 + Math.sin(this.time * 2 + i * 0.1) * 0.2;
                const sizeFactor = this.mapParam(this.params.size, 0.05, 0.3);
                sizes[i] = sizeFactor * (0.3 + distRatio * 0.7) * pulse;
            }
        }
        
        // Set flags to update buffers
        particles.geometry.attributes.position.needsUpdate = true;
        particles.geometry.attributes.color.needsUpdate = true;
        if (sizes) {
            particles.geometry.attributes.size.needsUpdate = true;
        }
    }
}