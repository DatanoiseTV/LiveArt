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
            trailParticles: this.createTrailParticlesScene.bind(this),
            // New visualizers
            nebulaVortex: this.createNebulaVortexScene.bind(this),
            crystalFractals: this.createCrystalFractalsScene.bind(this),
            oceanWaves: this.createOceanWavesScene.bind(this),
            crtOscilloscope: this.createCRTOscilloscopeScene.bind(this)
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
        try {
            // Validate inputs
            if (typeof paramName !== 'string') {
                console.error(`Invalid parameter name type: ${typeof paramName}`, paramName);
                return;
            }
            
            if (typeof value !== 'number' || isNaN(value)) {
                console.error(`Invalid value for parameter ${paramName}: ${value}`);
                return;
            }
            
            // Clamp value to appropriate range based on parameter
            if (paramName === 'rotation') {
                // Rotation can be negative
                value = Math.max(-1, Math.min(1, value));
                // Always log rotation changes for debugging
                console.log(`WebGL setting rotation param: ${value.toFixed(2)} - auto-rotation ${value === 0 ? 'DISABLED' : 'ENABLED'}`);
            } else {
                // All other params are 0-1
                value = Math.max(0, Math.min(1, value));
                
                // Log parameter settings for debugging (avoid spamming console)
                if (paramName !== 'hue' && paramName !== 'brightness' && paramName !== 'saturation') {
                    console.log(`WebGL setting param: ${paramName} = ${value.toFixed(2)}`);
                }
            }
            
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
                return;
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
        } catch (err) {
            console.error(`Error setting WebGL parameter ${paramName}:`, err);
        }
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
            const fpsElement = document.getElementById('fps');
            if (fpsElement) {
                fpsElement.textContent = Math.round(this.fps);
            }
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
        
        // Read parameters
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
        
        // IMPORTANT: Do NOT auto-rotate by default - disable all auto-rotation
        // Only apply rotation when user explicitly sets it through rotation parameter
        const isRotating = this.params.rotation !== 0 && Math.abs(rotationSpeed) > 0.001;
        
        // Debug output if we haven't logged rotation state recently
        if (!this._lastRotationCheck || Date.now() - this._lastRotationCheck > 5000) {
            console.log(`WebGL scene rotation currently ${isRotating ? 'ENABLED' : 'DISABLED'}, param=${this.params.rotation}, speed=${rotationSpeed.toFixed(5)}`);
            this._lastRotationCheck = Date.now();
        }
        
        if (isRotating) {
            this.scene.rotation.z += rotationSpeed;
        } else {
            // Ensure Z rotation is reset/stable when no rotation is applied
            this.scene.rotation.z = this.scene.rotation.z;  // This line maintains current value
        }
        
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
            case 'nebulaVortex':
                this.updateNebulaVortexScene(delta);
                break;
            case 'crystalFractals':
                this.updateCrystalFractalsScene(delta);
                break;
            case 'oceanWaves':
                this.updateOceanWavesScene(delta);
                break;
            case 'crtOscilloscope':
                this.updateCRTOscilloscopeScene(delta);
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
        // Add dynamic lighting system
        const ambientLight = new THREE.AmbientLight(0x222222, 1.0);
        this.scene.add(ambientLight);
        
        // Add central sweeping light
        const centerLight = new THREE.PointLight(0xffffff, 3, 50);
        centerLight.position.set(0, 0, 5);
        this.scene.add(centerLight);
        
        // Add rotating side lights for dramatic effect
        const light1 = new THREE.PointLight(0x2222ff, 2, 30);
        light1.position.set(10, 0, 0);
        this.scene.add(light1);
        
        const light2 = new THREE.PointLight(0xff2222, 2, 30);
        light2.position.set(-10, 0, 0);
        this.scene.add(light2);
        
        // Parameters
        const tunnelRadius = 5;
        const tunnelLength = 30;
        const segments = Math.max(12, Math.floor(this.mapParam(this.params.complexity, 16, 36))); // More segments for smoother look
        const rings = Math.floor(this.mapParam(this.params.density, 30, 120)); // More rings
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        
        // Create tunnel segments
        const tunnelSegments = [];
        const materials = [];
        
        // Create a dynamic starfield background
        const bgSphereGeometry = new THREE.SphereGeometry(40, 64, 64);
        
        // Create a custom shader for animated star field
        const starsMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                baseColor: { value: new THREE.Color(0x000011) },
                starColor: { value: new THREE.Color(this.hsvToThree(hue, 0.2, 0.8)) }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 baseColor;
                uniform vec3 starColor;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                // Hash function for pseudo-randomness
                float hash(vec3 p) {
                    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
                    p += dot(p, p.zxy + 19.19);
                    return fract(p.x * p.y * p.z);
                }
                
                void main() {
                    // Generate stars based on position
                    vec3 pos = normalize(vPosition);
                    float h = hash(floor(pos * 500.0));
                    float star = step(0.99, h); // Only brightest stars
                    
                    // Add twinkling effect
                    float twinkle = sin(time * 3.0 * h + h * 10.0) * 0.5 + 0.5;
                    
                    // Star color with twinkling
                    vec3 color = baseColor;
                    color = mix(color, starColor, star * twinkle);
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        const bgSphere = new THREE.Mesh(bgSphereGeometry, starsMaterial);
        this.scene.add(bgSphere);
        this.objects.bgSphere = bgSphere;
        this.objects.starsMaterial = starsMaterial;
        
        // Add nebula clouds for depth
        const nebulaGeometry = new THREE.SphereGeometry(38, 32, 32);
        const nebulaMaterial = new THREE.MeshBasicMaterial({
            color: this.hsvToThree(hue, 0.5, 0.2),
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.4,
            map: this.createNebulaNoise()
        });
        
        const nebulaMesh = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
        this.scene.add(nebulaMesh);
        this.objects.nebulaMesh = nebulaMesh;
        
        // Create a group to hold all rings
        const tunnelGroup = new THREE.Group();
        this.scene.add(tunnelGroup);
        this.objects.tunnelGroup = tunnelGroup;
        
        try {
            // Create rings with dynamic patterns and shapes
            for (let ring = 0; ring < rings; ring++) {
                const z = ring * (tunnelLength / rings) - tunnelLength / 2;
                
                // Create more interesting ring patterns with sine wave variations
                const ringPhase = ring * 0.05;
                const ringFrequency = 2 + (ring % 5) * 0.5; // Vary the frequency for different rings
                const distortAmount = 0.1 + (ring % 3) * 0.1; // Vary distortion per ring
                
                // Vary ring radius based on position for a more organic tunnel
                const baseRadius = tunnelRadius * (1 + Math.sin(ring * 0.2) * 0.2);
                
                // Different ring patterns - alternate between styles
                const ringStyle = ring % 4;
                let geometry;
                
                if (ringStyle === 0) {
                    // Standard circular ring with wave distortion
                    geometry = new THREE.BufferGeometry();
                    const positions = [];
                    
                    // Create vertices in a circle with wave distortion
                    for (let i = 0; i <= segments; i++) {
                        const angle = (i / segments) * Math.PI * 2;
                        
                        // Add wavy effect
                        const waveFactor = Math.sin(angle * ringFrequency + ringPhase) * distortAmount;
                        const ringRadius = baseRadius * (1 + waveFactor);
                        
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
                    geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geometry.setIndex(indices);
                } 
                else if (ringStyle === 1) {
                    // Star-shaped ring
                    const positions = [];
                    const numPoints = Math.max(5, Math.floor(segments/4)); // Fewer points for star shape
                    const innerRadius = baseRadius * 0.6;
                    const outerRadius = baseRadius * 1.2;
                    
                    // Create star points
                    for (let i = 0; i <= numPoints * 2; i++) {
                        const angle = (i / (numPoints * 2)) * Math.PI * 2;
                        const radius = i % 2 === 0 ? outerRadius : innerRadius;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        positions.push(x, y, 0);
                    }
                    
                    // Create lines connecting the vertices
                    const indices = [];
                    for (let i = 0; i < numPoints * 2; i++) {
                        indices.push(i, i + 1);
                    }
                    indices.push(numPoints * 2, 0); // Close the loop
                    
                    // Set geometry attributes
                    geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geometry.setIndex(indices);
                }
                else if (ringStyle === 2) {
                    // Polygon ring
                    const sides = Math.max(3, Math.floor(3 + Math.random() * 5)); // 3 to 8 sides
                    geometry = new THREE.BufferGeometry();
                    const positions = [];
                    
                    // Create polygon vertices
                    for (let i = 0; i <= sides; i++) {
                        const angle = (i / sides) * Math.PI * 2;
                        const x = Math.cos(angle) * baseRadius;
                        const y = Math.sin(angle) * baseRadius;
                        positions.push(x, y, 0);
                    }
                    
                    // Create lines connecting the vertices
                    const indices = [];
                    for (let i = 0; i < sides; i++) {
                        indices.push(i, i + 1);
                    }
                    indices.push(sides, 0); // Close the loop
                    
                    // Set geometry attributes
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geometry.setIndex(indices);
                }
                else {
                    // Spiral ring
                    geometry = new THREE.BufferGeometry();
                    const positions = [];
                    const numArms = 2 + (ring % 3); // 2-4 spiral arms
                    const turns = 1 + (ring % 3) * 0.25; // How many times around the circle
                    
                    // Create spiral arms
                    for (let arm = 0; arm < numArms; arm++) {
                        const armOffset = (arm / numArms) * Math.PI * 2;
                        
                        for (let i = 0; i <= segments / numArms; i++) {
                            const ratio = i / (segments / numArms);
                            const angle = ratio * Math.PI * 2 * turns + armOffset;
                            const radius = baseRadius * (0.5 + ratio * 0.5);
                            
                            const x = Math.cos(angle) * radius;
                            const y = Math.sin(angle) * radius;
                            positions.push(x, y, 0);
                        }
                    }
                    
                    // Set geometry attributes - no indices for spiral (not a loop)
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                }
                
                // Move to the right z position
                geometry.translate(0, 0, z);
                
                // Create material with varying color and glow effect
                const ringHue = (hue + ring / rings * 0.5) % 1;
                const material = new THREE.LineBasicMaterial({
                    color: this.hsvToThree(ringHue, saturation, brightness),
                    linewidth: 2,
                    transparent: true,
                    opacity: 0.8
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
        const complexity = this.mapParam(this.params.complexity, 1, 5);
        
        // Animate dynamic lights
        // Central sweeping light - move in a figure 8 pattern
        if (this.scene.children[1] && this.scene.children[1].isPointLight) {
            const centerLight = this.scene.children[1];
            const lightRadius = 3 + Math.sin(this.time) * 2;
            const t = this.time * 0.5;
            centerLight.position.x = Math.sin(t) * lightRadius;
            centerLight.position.y = Math.sin(t * 2) * lightRadius * 0.5;
            centerLight.position.z = 5 + Math.cos(t) * 2;
            centerLight.intensity = 2 + Math.sin(t * 0.7) * 0.5;
            
            // Update color based on hue
            centerLight.color = this.hsvToThree(hue, saturation * 0.5, brightness);
        }
        
        // Animate side lights - rotate around tunnel
        if (this.scene.children[2] && this.scene.children[2].isPointLight) {
            const light1 = this.scene.children[2];
            const t = this.time * 0.7;
            light1.position.x = Math.cos(t) * 12;
            light1.position.y = Math.sin(t) * 12;
            light1.position.z = Math.sin(t * 2) * 5;
            light1.intensity = 1 + Math.sin(t * 1.3) * 0.5;
            
            // Use complementary color
            light1.color = this.hsvToThree((hue + 0.5) % 1, saturation * 0.7, brightness * 0.8);
        }
        
        if (this.scene.children[3] && this.scene.children[3].isPointLight) {
            const light2 = this.scene.children[3];
            const t = this.time * 0.5 + Math.PI; // Offset from first light
            light2.position.x = Math.cos(t) * 12;
            light2.position.y = Math.sin(t) * 12;
            light2.position.z = Math.sin(t * 2) * 5;
            light2.intensity = 1 + Math.sin(t * 1.7) * 0.5;
            
            // Use triadic color
            light2.color = this.hsvToThree((hue + 0.33) % 1, saturation * 0.7, brightness * 0.8);
        }
        
        // Disable all rotation unless explicitly set by user
        if (this.objects.tunnelGroup) {
            if (this.params.rotation !== 0 && Math.abs(rotation) > 0.001) {
                // Only apply rotation when explicitly set
                this.objects.tunnelGroup.rotation.z += rotation * delta * (0.5 + complexity * 0.1);
                // Add slight tilt animation only when rotation is on
                this.objects.tunnelGroup.rotation.x = Math.sin(this.time * 0.2) * 0.05;
                this.objects.tunnelGroup.rotation.y = Math.cos(this.time * 0.3) * 0.05;
            } else {
                // No rotation - keep absolutely still
                this.objects.tunnelGroup.rotation.x = 0;
                this.objects.tunnelGroup.rotation.y = 0;
                // Keep z rotation fixed (no incremental changes)
                this.objects.tunnelGroup.rotation.z = this.objects.tunnelGroup.rotation.z;
            }
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
                
                // Add subtle wobble to each ring
                segment.rotation.x = Math.sin(this.time * 0.5 + i * 0.1) * 0.05;
                segment.rotation.y = Math.cos(this.time * 0.3 + i * 0.1) * 0.05;
                
                // Update colors for rings with smooth transition
                const ringHue = (hue + segment.userData.hueOffset + this.time * 0.1) % 1;
                if (this.objects.materials && this.objects.materials[i]) {
                    this.objects.materials[i].color = this.hsvToThree(ringHue, saturation, brightness);
                    
                    // Pulse opacity for glow effect
                    if (this.objects.materials[i].transparent) {
                        this.objects.materials[i].opacity = 0.6 + Math.sin(this.time * 2 + i * 0.2) * 0.3;
                    }
                }
            }
        });
        
        // Update starfield shader uniforms
        if (this.objects.starsMaterial && this.objects.starsMaterial.uniforms) {
            this.objects.starsMaterial.uniforms.time.value = this.time;
            this.objects.starsMaterial.uniforms.starColor.value = this.hsvToThree(
                (hue + 0.1) % 1, 
                saturation * 0.5, 
                brightness * 0.8
            );
        }
        
        // Also update the background sphere rotation
        if (this.objects.bgSphere) {
            this.objects.bgSphere.rotation.x = this.time * 0.05;
            this.objects.bgSphere.rotation.y = this.time * 0.1;
        }
        
        // Update nebula background
        if (this.objects.nebulaMesh) {
            this.objects.nebulaMesh.rotation.x = this.time * 0.02;
            this.objects.nebulaMesh.rotation.y = this.time * 0.03;
            this.objects.nebulaMesh.rotation.z = this.time * 0.01;
            
            // Update nebula color
            this.objects.nebulaMesh.material.color = this.hsvToThree(
                (hue + 0.1) % 1, 
                saturation * 0.5, 
                brightness * 0.2
            );
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
        const size = 256; // Larger for better quality
        canvas.width = size;
        canvas.height = size;
        
        // Create a radial gradient for phosphor glow effect
        // More intense in center for that classic CRT look
        const gradient = ctx.createRadialGradient(
            size/2, size/2, 0,
            size/2, size/2, size/2
        );
        
        // Brighter, more saturated center for oscilloscope dots
        gradient.addColorStop(0, 'rgba(230, 255, 230, 1.0)');    // Bright core
        gradient.addColorStop(0.1, 'rgba(150, 255, 150, 0.9)');  // Green phosphor
        gradient.addColorStop(0.3, 'rgba(80, 255, 80, 0.8)');    // Medium glow
        gradient.addColorStop(0.6, 'rgba(40, 220, 40, 0.3)');    // Outer glow
        gradient.addColorStop(1, 'rgba(20, 100, 20, 0.0)');      // Fade out
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        return new THREE.CanvasTexture(canvas);
    }
    
    /**
     * Create a nebula noise texture for backgrounds
     */
    createNebulaNoise() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        
        // Fill with black
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, size, size);
        
        // Create perlin-like noise using multiple passes of cloud patterns
        for (let i = 0; i < 5; i++) {
            // Vary cloud size and intensity per layer
            const cloudSize = 70 + Math.random() * 100;
            const intensity = 0.1 + Math.random() * 0.3;
            
            // Draw multiple random cloud shapes
            for (let cloud = 0; cloud < 10; cloud++) {
                const x = Math.random() * size;
                const y = Math.random() * size;
                
                // Create radial gradient for each cloud
                const gradient = ctx.createRadialGradient(
                    x, y, 0,
                    x, y, cloudSize
                );
                
                // Different opacity for different layers
                gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
                gradient.addColorStop(0.5, `rgba(255, 255, 255, ${intensity * 0.5})`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, size, size);
            }
        }
        
        // Add some brighter spots
        for (let spot = 0; spot < 20; spot++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const spotSize = 5 + Math.random() * 15;
            
            const gradient = ctx.createRadialGradient(
                x, y, 0,
                x, y, spotSize
            );
            
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    /**
     * Create a Nebula Vortex scene with swirling cosmic clouds
     */
    createNebulaVortexScene() {
        // Add ambient light (very dark for nebula feel)
        const ambientLight = new THREE.AmbientLight(0x050505, 0.3);
        this.scene.add(ambientLight);
        
        // Add dimmer point light at center
        const centerLight = new THREE.PointLight(0xffffff, 0.5, 50);
        centerLight.position.set(0, 0, 0);
        this.scene.add(centerLight);
        
        // Add subdued secondary lights for more complex illumination
        const light1 = new THREE.PointLight(0x3322aa, 0.4, 30);
        light1.position.set(15, 5, 10);
        this.scene.add(light1);
        
        const light2 = new THREE.PointLight(0x990033, 0.4, 30);
        light2.position.set(-15, -5, -10);
        this.scene.add(light2);
        
        // Get parameters 
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const complexity = Math.floor(this.mapParam(this.params.complexity, 5, 15));
        // Dramatically reduce particle count for better performance
        const density = Math.floor(this.mapParam(this.params.density, 10000, 40000));
        
        // Create the particle texture for nebula
        const particleTexture = this.createParticleTexture();
        
        // Create groups to organize particles
        const nebulaGroup = new THREE.Group();
        this.scene.add(nebulaGroup);
        
        // Create the nebula particles
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(density * 3);
        const colors = new Float32Array(density * 3);
        const sizes = new Float32Array(density);
        const alphas = new Float32Array(density);
        const velocities = [];
        
        // Generate spiral arms based on complexity
        const arms = Math.max(2, Math.floor(complexity / 2));
        const spread = 15;
        const spiralTightness = 2.5 - (this.params.complexity * 1.5); // Tighter spirals with higher complexity
        
        // Create particles with nebula distribution
        for (let i = 0; i < density; i++) {
            const i3 = i * 3;
            
            // Choose a random arm
            const arm = Math.floor(Math.random() * arms);
            
            // Angle along spiral with some randomness
            const armOffset = (arm / arms) * Math.PI * 2;
            const dist = Math.random() * spread;
            const angle = dist * spiralTightness + armOffset;
            
            // Basic spiral position
            let posX = Math.cos(angle) * dist;
            let posY = Math.sin(angle) * dist;
            
            // Height is a disk with falloff from center
            const heightScale = 2.0 * (1 - Math.min(1, dist / spread));
            let posZ = (Math.random() - 0.5) * heightScale;
            
            // Add some random scatter to create volume
            posX += (Math.random() - 0.5) * 2;
            posY += (Math.random() - 0.5) * 2;
            posZ += (Math.random() - 0.5) * 0.5;
            
            // Set position
            positions[i3] = posX;
            positions[i3 + 1] = posY;
            positions[i3 + 2] = posZ;
            
            // Particle size based on distance from center (larger towards center)
            const distFromCenter = Math.sqrt(posX * posX + posY * posY + posZ * posZ);
            const distRatio = Math.min(1, distFromCenter / spread);
            const invertedDistRatio = 1 - distRatio;
            
            // Size variation - center particles are larger
            const baseSize = this.mapParam(this.params.size, 0.05, 0.25);
            sizes[i] = baseSize * (0.2 + invertedDistRatio * 0.8 + Math.random() * 0.3);
            
            // Color varies along spiral arms and by distance
            const particleHue = (hue + (arm / arms) * 0.3 + distRatio * 0.4) % 1;
            const color = this.hsvToThree(
                particleHue,
                Math.min(1, saturation * (0.4 + distRatio * 0.4)),
                Math.min(1, brightness * (0.3 + invertedDistRatio * 0.4))
            );
            
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Alpha - center of nebula is more dense
            alphas[i] = 0.1 + invertedDistRatio * 0.9;
            
            // Particle velocity - orbit around center
            const orbitSpeed = 0.05 * (1.5 - distRatio); // Faster orbit closer to center
            const radialSpeed = 0.01 * (Math.random() - 0.3); // Slow drift in/out
            
            velocities.push({
                orbitSpeed: orbitSpeed,
                radialSpeed: radialSpeed,
                verticalSpeed: (Math.random() - 0.5) * 0.01, // Slow drift up/down
                angle: angle,
                dist: dist,
                arm: arm,
                initialPosZ: posZ
            });
        }
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Create material with custom shader to allow alpha per-particle
        const material = new THREE.PointsMaterial({
            size: 1.0, // Base size multiplier
            vertexColors: true,
            map: particleTexture,
            transparent: true,
            opacity: 0.4, // Lower opacity for darker nebula feel
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        // Create particles system
        const particles = new THREE.Points(geometry, material);
        nebulaGroup.add(particles);
        
        // Add stronger depth effect to the scene
        const fogColor = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.05);
        
        // Create a subtle dust cloud in background
        const dustCount = Math.min(density / 20, 1000); // Limit dust particles for performance
        const dustGeometry = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(dustCount * 3);
        const dustColors = new Float32Array(dustCount * 3);
        const dustSizes = new Float32Array(dustCount);
        
        // Fill dust particles with random positions in a larger sphere
        for (let i = 0; i < dustCount; i++) {
            const i3 = i * 3;
            
            // Random position in a sphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = spread * 1.5 * Math.cbrt(Math.random()); // Cube root for uniform density
            
            dustPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
            dustPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            dustPositions[i3 + 2] = r * Math.cos(phi);
            
            // Small size for background dust
            dustSizes[i] = this.mapParam(this.params.size, 0.02, 0.1) * (0.3 + Math.random() * 0.7);
            
            // Subtle colors, darker and desaturated compared to nebula
            const dustHue = (hue + Math.random() * 0.2) % 1;
            const color = this.hsvToThree(
                dustHue,
                saturation * 0.4,
                brightness * 0.2
            );
            
            dustColors[i3] = color.r;
            dustColors[i3 + 1] = color.g;
            dustColors[i3 + 2] = color.b;
        }
        
        // Set geometry attributes for dust
        dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
        dustGeometry.setAttribute('size', new THREE.BufferAttribute(dustSizes, 1));
        
        // Create dust material - much more transparent than main nebula
        const dustMaterial = new THREE.PointsMaterial({
            size: 0.7, // Smaller dust particles
            vertexColors: true,
            map: particleTexture,
            transparent: true,
            opacity: 0.08, // Extremely subtle background dust
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        // Create dust particle system
        const dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        nebulaGroup.add(dustParticles);
        
        // Store objects for update
        this.objects.particles = particles;
        this.objects.dustParticles = dustParticles;
        this.objects.velocities = velocities;
        this.objects.centerLight = centerLight;
        this.objects.light1 = light1;
        this.objects.light2 = light2;
        this.objects.nebulaGroup = nebulaGroup;
        this.objects.particleCount = density;
        this.objects.spread = spread;
        this.objects.arms = arms;
        this.objects.spiralTightness = spiralTightness;
    }
    
    /**
     * Create a Crystal Energy Field scene with dynamic energy patterns
     */
    createCrystalFractalsScene() {
        // Add dark ambient light for mood
        const ambientLight = new THREE.AmbientLight(0x000011, 0.2);
        this.scene.add(ambientLight);
        
        // Add main directional light for accent
        const dirLight = new THREE.DirectionalLight(0x3366ff, 0.7);
        dirLight.position.set(1, 2, 3);
        this.scene.add(dirLight);
        
        // Add vibrant colored point lights
        const light1 = new THREE.PointLight(0x00ffff, 1.5, 50);
        light1.position.set(10, 5, 10);
        this.scene.add(light1);
        
        const light2 = new THREE.PointLight(0xff00ff, 1.2, 50);
        light2.position.set(-15, -5, 12);
        this.scene.add(light2);
        
        const light3 = new THREE.PointLight(0xffaa00, 1.0, 40);
        light3.position.set(5, -10, -10);
        this.scene.add(light3);
        
        // Get parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const density = Math.floor(this.mapParam(this.params.density, 5, 15));
        const complexity = Math.floor(this.mapParam(this.params.complexity, 4, 12));
        
        // Create a group to hold all crystal objects
        const crystalGroup = new THREE.Group();
        this.scene.add(crystalGroup);
        
        // Create central energy field - glowing sphere
        const coreRadius = 4;
        const coreGeometry = new THREE.IcosahedronGeometry(coreRadius, 4);
        const coreMaterial = new THREE.MeshPhongMaterial({
            color: this.hsvToThree(hue, saturation * 0.9, brightness * 0.9).getHex(),
            emissive: this.hsvToThree(hue, saturation * 0.8, brightness * 0.5).getHex(),
            specular: 0xffffff,
            shininess: 100,
            transparent: true,
            opacity: 0.7,
            wireframe: true
        });
        
        const coreField = new THREE.Mesh(coreGeometry, coreMaterial);
        crystalGroup.add(coreField);
        
        // Add a glow sphere inside
        const glowGeometry = new THREE.SphereGeometry(coreRadius * 0.8, 32, 32);
        const glowMaterial = new THREE.MeshPhongMaterial({
            color: this.hsvToThree(hue, saturation * 0.5, brightness * 0.8).getHex(),
            emissive: this.hsvToThree(hue, saturation * 0.8, brightness * 0.6).getHex(),
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        coreField.add(glowSphere);
        
        // Create orbital ring system
        const rings = [];
        const ringCount = density;
        const baseRingSize = this.mapParam(this.params.size, 1, 3);
        
        for (let i = 0; i < ringCount; i++) {
            // Ring parameters
            const ringRadius = coreRadius * 1.5 + i * 1.2;
            const tubeRadius = baseRingSize * (0.1 + Math.random() * 0.2);
            const ringResolution = Math.max(32, Math.floor(64 * this.params.complexity));
            
            // Create ring geometry - use torus for a full circle
            let ringGeometry;
            
            // Alternate between different types of geometry for variety
            const geoType = i % 4;
            switch(geoType) {
                case 0: // Regular torus
                    ringGeometry = new THREE.TorusGeometry(
                        ringRadius, tubeRadius, 16, ringResolution
                    );
                    break;
                case 1: // Knot
                    ringGeometry = new THREE.TorusKnotGeometry(
                        ringRadius * 0.6, tubeRadius * 1.2, 
                        ringResolution, 8, 2, 3
                    );
                    break;
                case 2: // Partial ring (arc)
                    // Create custom arc geometry
                    const arcGeometry = new THREE.BufferGeometry();
                    const arcVertices = [];
                    const arcFraction = 0.6 + Math.random() * 0.3; // How much of a full circle
                    const arcStart = Math.random() * Math.PI * 2;
                    const arcEnd = arcStart + arcFraction * Math.PI * 2;
                    
                    // Create points along the arc
                    for (let a = arcStart; a <= arcEnd; a += (arcEnd - arcStart) / ringResolution) {
                        const x = ringRadius * Math.cos(a);
                        const y = ringRadius * Math.sin(a);
                        
                        // Create tube around this point
                        for (let t = 0; t < Math.PI * 2; t += Math.PI / 8) {
                            const nx = Math.cos(t) * tubeRadius;
                            const ny = Math.sin(t) * tubeRadius;
                            
                            // Rotate tube points around the arc center
                            const rotX = nx * Math.cos(a) - ny * Math.sin(a);
                            const rotY = nx * Math.sin(a) + ny * Math.cos(a);
                            
                            arcVertices.push(x + rotX, y + rotY, 0);
                        }
                    }
                    
                    arcGeometry.setAttribute('position', 
                        new THREE.Float32BufferAttribute(arcVertices, 3)
                    );
                    
                    ringGeometry = arcGeometry;
                    break;
                case 3: // Thin polygonal ring
                    // Create a simple polygonal ring with fewer sides
                    const segments = 3 + Math.floor(Math.random() * 5); // 3-7 sides
                    const polyGeometry = new THREE.BufferGeometry();
                    const polyVertices = [];
                    
                    for (let s = 0; s < segments; s++) {
                        const angle = (s / segments) * Math.PI * 2;
                        const nextAngle = ((s + 1) % segments / segments) * Math.PI * 2;
                        
                        const x1 = ringRadius * Math.cos(angle);
                        const y1 = ringRadius * Math.sin(angle);
                        const x2 = ringRadius * Math.cos(nextAngle);
                        const y2 = ringRadius * Math.sin(nextAngle);
                        
                        // Create a cylinder between each pair of points
                        const direction = new THREE.Vector3(x2 - x1, y2 - y1, 0).normalize();
                        const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                        
                        const cylinderGeo = new THREE.CylinderGeometry(
                            tubeRadius, tubeRadius, length, 8, 1
                        );
                        
                        // Rotate and position the cylinder
                        cylinderGeo.rotateZ(Math.atan2(direction.y, direction.x));
                        cylinderGeo.translate(x1 + (x2 - x1) / 2, y1 + (y2 - y1) / 2, 0);
                        
                        // Add vertices to main geometry
                        const cylPositions = cylinderGeo.getAttribute('position').array;
                        for (let v = 0; v < cylPositions.length; v += 3) {
                            polyVertices.push(
                                cylPositions[v], cylPositions[v+1], cylPositions[v+2]
                            );
                        }
                    }
                    
                    polyGeometry.setAttribute('position',
                        new THREE.Float32BufferAttribute(polyVertices, 3)
                    );
                    
                    ringGeometry = polyGeometry;
                    break;
            }
            
            // Ensure we have geometry
            if (!ringGeometry) continue;
            
            // Create varying materials for rings
            const materialType = Math.floor(Math.random() * 3);
            let ringMaterial;
            
            // Generate color based on position and core color
            const ringHue = (hue + (i / ringCount) * 0.7) % 1;
            
            switch(materialType) {
                case 0: // Phong with emissive
                    ringMaterial = new THREE.MeshPhongMaterial({
                        color: this.hsvToThree(ringHue, saturation, brightness * 0.8).getHex(),
                        emissive: this.hsvToThree(ringHue, saturation * 0.8, brightness * 0.3).getHex(),
                        specular: 0xffffff,
                        shininess: 100,
                        transparent: true,
                        opacity: 0.8
                    });
                    break;
                case 1: // Wireframe
                    ringMaterial = new THREE.MeshBasicMaterial({
                        color: this.hsvToThree(ringHue, saturation, brightness).getHex(),
                        wireframe: true,
                        transparent: true,
                        opacity: 0.6
                    });
                    break;
                case 2: // Points
                    // If it's a points material, we'll handle it specially
                    const pointGeometry = new THREE.BufferGeometry();
                    const positions = ringGeometry.getAttribute('position').array;
                    const pointCount = positions.length / 3;
                    
                    // Create point cloud from ring vertices
                    const pointPositions = new Float32Array(pointCount * 3);
                    const pointColors = new Float32Array(pointCount * 3);
                    const pointSizes = new Float32Array(pointCount);
                    
                    for (let p = 0; p < pointCount; p++) {
                        const p3 = p * 3;
                        pointPositions[p3] = positions[p3];
                        pointPositions[p3+1] = positions[p3+1];
                        pointPositions[p3+2] = positions[p3+2];
                        
                        // Vary color slightly by position
                        const pointHue = (ringHue + (p / pointCount) * 0.1) % 1;
                        const color = this.hsvToThree(
                            pointHue, saturation, brightness
                        );
                        
                        pointColors[p3] = color.r;
                        pointColors[p3+1] = color.g;
                        pointColors[p3+2] = color.b;
                        
                        // Vary size
                        pointSizes[p] = tubeRadius * (0.8 + Math.random() * 0.4);
                    }
                    
                    pointGeometry.setAttribute('position', 
                        new THREE.BufferAttribute(pointPositions, 3)
                    );
                    pointGeometry.setAttribute('color',
                        new THREE.BufferAttribute(pointColors, 3)
                    );
                    pointGeometry.setAttribute('size',
                        new THREE.BufferAttribute(pointSizes, 1)
                    );
                    
                    ringMaterial = new THREE.PointsMaterial({
                        size: tubeRadius * 2,
                        vertexColors: true,
                        map: this.createParticleTexture(),
                        transparent: true,
                        depthWrite: false,
                        blending: THREE.AdditiveBlending
                    });
                    
                    // Create points system
                    const ringPoints = new THREE.Points(pointGeometry, ringMaterial);
                    
                    // Add to scene with random rotation
                    ringPoints.rotation.x = Math.random() * Math.PI;
                    ringPoints.rotation.y = Math.random() * Math.PI;
                    ringPoints.rotation.z = Math.random() * Math.PI;
                    
                    crystalGroup.add(ringPoints);
                    
                    // Store for animation
                    rings.push({
                        object: ringPoints,
                        material: ringMaterial,
                        type: 'points',
                        radius: ringRadius,
                        rotationAxis: new THREE.Vector3(
                            Math.random() - 0.5,
                            Math.random() - 0.5,
                            Math.random() - 0.5
                        ).normalize(),
                        rotationSpeed: (Math.random() - 0.5) * 0.3,
                        hue: ringHue
                    });
                    
                    // Skip regular mesh creation for points
                    continue;
            }
            
            // Create ring mesh
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            
            // Randomize ring orientation
            ring.rotation.x = Math.random() * Math.PI;
            ring.rotation.y = Math.random() * Math.PI; 
            ring.rotation.z = Math.random() * Math.PI;
            
            // Add to scene
            crystalGroup.add(ring);
            
            // Store for animation
            rings.push({
                object: ring,
                material: ringMaterial,
                type: materialType,
                radius: ringRadius,
                rotationAxis: new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5, 
                    Math.random() - 0.5
                ).normalize(),
                rotationSpeed: (Math.random() - 0.5) * 0.3,
                hue: ringHue
            });
        }
        
        // Add floating crystal shards around the rings
        const shardCount = complexity * 12;
        const shards = [];
        
        for (let i = 0; i < shardCount; i++) {
            // Create shard geometry
            const shardType = Math.floor(Math.random() * 4);
            let shardGeometry;
            
            switch(shardType) {
                case 0:
                    shardGeometry = new THREE.TetrahedronGeometry(
                        this.mapParam(this.params.size, 0.3, 0.8)
                    );
                    break;
                case 1:
                    shardGeometry = new THREE.OctahedronGeometry(
                        this.mapParam(this.params.size, 0.2, 0.6)
                    );
                    break;
                case 2:
                    shardGeometry = new THREE.IcosahedronGeometry(
                        this.mapParam(this.params.size, 0.2, 0.5)
                    );
                    break;
                case 3:
                    // Custom shard shape
                    shardGeometry = new THREE.BufferGeometry();
                    
                    // Simple triangular prism
                    const size = this.mapParam(this.params.size, 0.3, 0.7);
                    const height = size * (1 + Math.random());
                    
                    const vertices = [
                        // Base triangle
                        -size/2, -height/2, -size/2,
                        size/2, -height/2, -size/2,
                        0, -height/2, size/2,
                        // Top triangle
                        -size/2, height/2, -size/2,
                        size/2, height/2, -size/2,
                        0, height/2, size/2
                    ];
                    
                    const indices = [
                        // Base
                        0, 1, 2,
                        // Top
                        3, 5, 4,
                        // Sides
                        0, 3, 1,
                        1, 3, 4,
                        1, 4, 2,
                        2, 4, 5,
                        2, 5, 0,
                        0, 5, 3
                    ];
                    
                    shardGeometry.setAttribute('position',
                        new THREE.Float32BufferAttribute(vertices, 3)
                    );
                    shardGeometry.setIndex(indices);
                    shardGeometry.computeVertexNormals();
                    break;
            }
            
            // Calculate position - distributed at various distances
            const distanceTiers = [6, 9, 12, 15, 18];
            const distance = distanceTiers[Math.floor(Math.random() * distanceTiers.length)];
            const azimuth = Math.random() * Math.PI * 2;
            const elevation = (Math.random() - 0.5) * Math.PI;
            
            const position = new THREE.Vector3(
                distance * Math.cos(azimuth) * Math.cos(elevation),
                distance * Math.sin(elevation),
                distance * Math.sin(azimuth) * Math.cos(elevation)
            );
            
            // Color based on distance and position
            const shardHue = (hue + (distance / 20) * 0.5 + (azimuth / (Math.PI * 2)) * 0.2) % 1;
            
            // Create material - either glassy or crystalline
            const isCrystalline = Math.random() > 0.5;
            
            const shardMaterial = isCrystalline ?
                // Crystalline material
                new THREE.MeshPhongMaterial({
                    color: this.hsvToThree(shardHue, saturation * 0.9, brightness * 0.8).getHex(),
                    emissive: this.hsvToThree(shardHue, saturation * 0.7, brightness * 0.3).getHex(),
                    specular: 0xffffff,
                    shininess: 70,
                    flatShading: true
                }) :
                // Glassy material
                new THREE.MeshPhysicalMaterial({
                    color: this.hsvToThree(shardHue, saturation * 0.6, brightness * 0.9).getHex(),
                    metalness: 0.1,
                    roughness: 0.2,
                    transmission: 0.6, // Glassy transmission
                    transparent: true,
                    opacity: 0.7,
                    clearcoat: 0.3,
                    clearcoatRoughness: 0.1
                });
            
            // Create mesh
            const shard = new THREE.Mesh(shardGeometry, shardMaterial);
            
            // Set position and random rotation
            shard.position.copy(position);
            shard.rotation.x = Math.random() * Math.PI * 2;
            shard.rotation.y = Math.random() * Math.PI * 2;
            shard.rotation.z = Math.random() * Math.PI * 2;
            
            // Add to scene
            crystalGroup.add(shard);
            
            // Store for animation
            shards.push({
                mesh: shard,
                material: shardMaterial,
                hue: shardHue,
                orbitCenter: new THREE.Vector3(0, 0, 0),
                orbitRadius: distance,
                orbitSpeed: (Math.random() - 0.5) * 0.05,
                orbitAxis: new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize(),
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.2,
                    y: (Math.random() - 0.5) * 0.2,
                    z: (Math.random() - 0.5) * 0.2
                },
                pulseRate: 0.5 + Math.random() * 1.5,
                pulsePhase: Math.random() * Math.PI * 2
            });
        }
        
        // Add fog for depth effect
        const fogColor = new THREE.Color(0x000011);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.02);
        
        // Store objects for updates
        this.objects.coreField = coreField;
        this.objects.glowSphere = glowSphere;
        this.objects.rings = rings;
        this.objects.shards = shards;
        this.objects.crystalGroup = crystalGroup;
        this.objects.light1 = light1;
        this.objects.light2 = light2;
        this.objects.light3 = light3;
        this.objects.directionalLight = dirLight;
    }
    
    /**
     * Update Crystal Energy Field scene
     * @param {number} delta - Time since last frame in seconds
     */
    updateCrystalFractalsScene(delta) {
        if (!this.objects.crystalGroup) return;
        
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const speed = this.mapParam(this.params.speed, 0.5, 3) * delta;
        const rotation = this.mapParam(this.params.rotation, -0.2, 0.2) * delta;
        
        // Update core field
        if (this.objects.coreField) {
            // Rotate core field for base movement
            this.objects.coreField.rotation.x += rotation * 0.3;
            this.objects.coreField.rotation.y += rotation * 0.4;
            this.objects.coreField.rotation.z += rotation * 0.2;
            
            // Pulse core field with time
            const pulseFactor = 0.95 + Math.sin(this.time * speed * 0.5) * 0.05;
            this.objects.coreField.scale.set(pulseFactor, pulseFactor, pulseFactor);
            
            // Update core field color
            if (this.objects.coreField.material) {
                const pulseHue = (hue + this.time * 0.03) % 1;
                this.objects.coreField.material.color = this.hsvToThree(
                    pulseHue, saturation * 0.9, brightness * 0.9
                );
                this.objects.coreField.material.emissive = this.hsvToThree(
                    pulseHue, saturation * 0.8, brightness * 0.5
                );
            }
            
            // Update inner glow sphere
            if (this.objects.glowSphere && this.objects.glowSphere.material) {
                const glowHue = (hue + this.time * 0.05 + 0.1) % 1;
                this.objects.glowSphere.material.color = this.hsvToThree(
                    glowHue, saturation * 0.5, brightness * 0.8
                );
                this.objects.glowSphere.material.emissive = this.hsvToThree(
                    glowHue, saturation * 0.8, brightness * 0.6
                );
            }
        }
        
        // Update rings
        if (this.objects.rings) {
            this.objects.rings.forEach(ring => {
                // Rotate ring around its custom axis
                ring.object.rotateOnAxis(
                    ring.rotationAxis, 
                    ring.rotationSpeed * speed
                );
                
                // Update ring color based on time
                const ringHue = (ring.hue + this.time * 0.02) % 1;
                
                if (ring.type === 'points') {
                    // For points, update the colors array
                    if (ring.object.geometry.getAttribute('color')) {
                        const colors = ring.object.geometry.getAttribute('color').array;
                        const count = colors.length / 3;
                        
                        for (let i = 0; i < count; i++) {
                            const i3 = i * 3;
                            // Vary color slightly by position
                            const pointHue = (ringHue + (i / count) * 0.1) % 1;
                            const color = this.hsvToThree(
                                pointHue, saturation, brightness
                            );
                            
                            colors[i3] = color.r;
                            colors[i3+1] = color.g;
                            colors[i3+2] = color.b;
                        }
                        
                        ring.object.geometry.getAttribute('color').needsUpdate = true;
                    }
                } else {
                    // For regular materials
                    if (ring.material.color) {
                        if (ring.type === 0) { // Phong with emissive
                            ring.material.color = this.hsvToThree(
                                ringHue, saturation, brightness * 0.8
                            );
                            ring.material.emissive = this.hsvToThree(
                                ringHue, saturation * 0.8, brightness * 0.3
                            );
                        } else { // Wireframe
                            ring.material.color = this.hsvToThree(
                                ringHue, saturation, brightness
                            );
                        }
                    }
                }
            });
        }
        
        // Update shards
        if (this.objects.shards) {
            this.objects.shards.forEach(shard => {
                // Rotate shard
                shard.mesh.rotation.x += shard.rotationSpeed.x * speed;
                shard.mesh.rotation.y += shard.rotationSpeed.y * speed;
                shard.mesh.rotation.z += shard.rotationSpeed.z * speed;
                
                // Orbit around center
                // Create a rotation matrix for the orbit
                const orbitMatrix = new THREE.Matrix4().makeRotationAxis(
                    shard.orbitAxis, 
                    shard.orbitSpeed * speed
                );
                
                // Apply the rotation to the position vector
                shard.mesh.position.sub(shard.orbitCenter);
                shard.mesh.position.applyMatrix4(orbitMatrix);
                shard.mesh.position.add(shard.orbitCenter);
                
                // Pulse color based on time
                const pulseHue = (shard.hue + this.time * 0.03) % 1;
                const pulseFactor = 0.9 + Math.sin(this.time * shard.pulseRate + shard.pulsePhase) * 0.1;
                
                // Update material based on type
                if (shard.material.emissive) {
                    // Phong material
                    shard.material.color = this.hsvToThree(
                        pulseHue, saturation * 0.9, brightness * 0.8 * pulseFactor
                    );
                    shard.material.emissive = this.hsvToThree(
                        pulseHue, saturation * 0.7, brightness * 0.3 * pulseFactor
                    );
                } else {
                    // Physical material (glassy)
                    shard.material.color = this.hsvToThree(
                        pulseHue, saturation * 0.6, brightness * 0.9 * pulseFactor
                    );
                }
            });
        }
        
        // Update accent lights
        if (this.objects.light1) {
            this.objects.light1.color = this.hsvToThree(
                (hue + 0.3) % 1,
                saturation * 0.8,
                brightness * 0.9
            );
            
            // Move light in a circular path
            const lightAngle = this.time * 0.1;
            this.objects.light1.position.x = Math.cos(lightAngle) * 15;
            this.objects.light1.position.z = Math.sin(lightAngle) * 15;
        }
        
        if (this.objects.light2) {
            this.objects.light2.color = this.hsvToThree(
                (hue + 0.7) % 1,
                saturation * 0.8,
                brightness * 0.9
            );
            
            // Move light in a circular path (opposite direction)
            const lightAngle = -this.time * 0.15 + Math.PI;
            this.objects.light2.position.x = Math.cos(lightAngle) * 12;
            this.objects.light2.position.z = Math.sin(lightAngle) * 12;
        }
        
        if (this.objects.light3) {
            this.objects.light3.color = this.hsvToThree(
                (hue + 0.5) % 1,
                saturation * 0.7,
                brightness * 0.9
            );
            
            // Move light in a vertical pattern
            this.objects.light3.position.y = Math.sin(this.time * 0.2) * 10;
        }
        
        // Slow rotation of whole scene
        if (this.objects.crystalGroup) {
            this.objects.crystalGroup.rotation.y += rotation * 0.05;
        }
    }
    
    /**
     * Update Crystal Fractals scene
     * @param {number} delta - Time since last frame in seconds
     */
    updateCrystalFractalsScene(delta) {
        if (!this.objects.crystals) return;
        
        const crystals = this.objects.crystals;
        const speed = this.mapParam(this.params.speed, 0.5, 3) * delta;
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const rotation = this.mapParam(this.params.rotation, -0.2, 0.2) * delta;
        
        // Rotate entire crystal group
        if (this.objects.crystalGroup) {
            this.objects.crystalGroup.rotation.y += rotation;
        }
        
        // Update accent lights
        if (this.objects.light1) {
            this.objects.light1.color = this.hsvToThree(
                (hue + 0.5) % 1, // Complementary color
                saturation * 0.8,
                brightness * 0.9
            );
        }
        
        if (this.objects.light2) {
            this.objects.light2.color = this.hsvToThree(
                (hue + 0.8) % 1, // Triadic color
                saturation * 0.8,
                brightness * 0.9
            );
        }
        
        // Update each crystal
        crystals.forEach(crystal => {
            // Apply individual rotation
            crystal.mesh.rotation.x += crystal.rotationSpeed.x * speed;
            crystal.mesh.rotation.y += crystal.rotationSpeed.y * speed;
            crystal.mesh.rotation.z += crystal.rotationSpeed.z * speed;
            
            // Pulse color based on time
            const pulseHue = (crystal.hue + this.time * 0.05) % 1;
            const pulseFactor = 0.9 + Math.sin(this.time * crystal.growthRate + crystal.growthPhase) * 0.1;
            
            // Update material
            crystal.material.color = this.hsvToThree(
                pulseHue,
                saturation * (0.8 + pulseFactor * 0.2),
                brightness * pulseFactor
            );
            
            // Subtle emission for glow effect
            crystal.material.emissive = this.hsvToThree(
                pulseHue,
                saturation * 0.5,
                brightness * 0.1 * pulseFactor
            );
        });
        
        // Update dust particles
        if (this.objects.dustParticles) {
            this.objects.dustParticles.rotation.y += rotation * 0.1;
        }
    }
    
    /**
     * Update the Nebula Vortex scene
     * @param {number} delta - Time since last frame in seconds
     */
    updateNebulaVortexScene(delta) {
        if (!this.objects.particles || !this.objects.velocities) return;
        
        const particles = this.objects.particles;
        const dustParticles = this.objects.dustParticles;
        const velocities = this.objects.velocities;
        const positions = particles.geometry.attributes.position.array;
        const colors = particles.geometry.attributes.color.array;
        const sizes = particles.geometry.attributes.size.array;
        const particleCount = this.objects.particleCount;
        const speed = this.mapParam(this.params.speed, 0.5, 3) * delta;
        const spread = this.objects.spread || 15;
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const rotation = this.mapParam(this.params.rotation, -0.5, 0.5) * delta;
        const arms = this.objects.arms || 3;
        const spiralTightness = this.objects.spiralTightness || 1;
        
        // Performance optimization: Only update particles every other frame
        // or if parameters have changed
        const shouldUpdateParticles = (this.time * 1000) % 2 < 1 || 
                                     this.objects.lastHue !== hue || 
                                     this.objects.lastSaturation !== saturation ||
                                     this.objects.lastBrightness !== brightness;
        
        // Store current parameters for change detection
        this.objects.lastHue = hue;
        this.objects.lastSaturation = saturation;
        this.objects.lastBrightness = brightness;
        
        // Rotate the whole nebula group
        if (this.objects.nebulaGroup) {
            this.objects.nebulaGroup.rotation.z += rotation * 0.2;
        }
        
        // Update center light color based on hue
        if (this.objects.centerLight) {
            this.objects.centerLight.color = this.hsvToThree(hue, saturation * 0.3, brightness * 0.6);
        }
        
        // Update accent lights with complementary colors
        if (this.objects.light1) {
            this.objects.light1.color = this.hsvToThree((hue + 0.5) % 1, saturation * 0.5, brightness * 0.6);
        }
        
        if (this.objects.light2) {
            this.objects.light2.color = this.hsvToThree((hue + 0.8) % 1, saturation * 0.5, brightness * 0.6);
        }
        
        // Only update particles when necessary
        if (shouldUpdateParticles) {
            // Update particles in batches for better performance
            const batchSize = 100;
            const numBatches = Math.ceil(particleCount / batchSize);
            const startBatch = Math.floor(Math.random() * numBatches); // Randomize which batch to update
            
            // Update one batch of particles per frame in a round-robin fashion
            for (let b = 0; b < 1; b++) {
                const batchIndex = (startBatch + b) % numBatches;
                const startIdx = batchIndex * batchSize;
                const endIdx = Math.min(startIdx + batchSize, particleCount);
                
                for (let i = startIdx; i < endIdx; i++) {
                    const i3 = i * 3;
                    const v = velocities[i];
                    
                    // Current position
                    const x = positions[i3];
                    const y = positions[i3 + 1];
                    const z = positions[i3 + 2];
                    
                    // Calculate current distance and angle from center
                    const currentDist = Math.sqrt(x * x + y * y);
                    let currentAngle = Math.atan2(y, x);
                    
                    // Update angle based on orbit speed
                    currentAngle += v.orbitSpeed * speed * 2; // Speed up animation to compensate for less frequent updates
                    
                    // Update distance based on radial speed
                    let newDist = currentDist + v.radialSpeed * speed * 2;
                    
                    // Constrain distance 
                    if (newDist < 0.5) newDist = 0.5;
                    if (newDist > spread * 1.2) newDist = spread * 1.2;
                    
                    // Update position
                    positions[i3] = Math.cos(currentAngle) * newDist;
                    positions[i3 + 1] = Math.sin(currentAngle) * newDist;
                    
                    // Simplified z-position update (less computation)
                    const zOscillation = Math.sin(this.time * 0.2 + v.arm) * 0.5;
                    positions[i3 + 2] = v.initialPosZ + zOscillation;
                    
                    // Update color based on arm and time - simplified
                    const distRatio = newDist / spread;
                    const particleHue = (hue + (v.arm / arms) * 0.3 + distRatio * 0.4) % 1;
                    const invertedDistRatio = 1 - Math.min(1, distRatio);
                    
                    const color = this.hsvToThree(
                        particleHue,
                        Math.min(1, saturation * (0.4 + distRatio * 0.4)),
                        Math.min(1, brightness * (0.3 + invertedDistRatio * 0.4))
                    );
                    
                    colors[i3] = color.r;
                    colors[i3 + 1] = color.g;
                    colors[i3 + 2] = color.b;
                    
                    // Simplified size update
                    const baseSize = this.mapParam(this.params.size, 0.05, 0.25);
                    sizes[i] = baseSize * (0.2 + invertedDistRatio * 0.8);
                }
            }
            
            // Update geometry attributes
            particles.geometry.attributes.position.needsUpdate = true;
            particles.geometry.attributes.color.needsUpdate = true;
            particles.geometry.attributes.size.needsUpdate = true;
        }
        
        // Update dust particles - simple rotation
        if (dustParticles) {
            dustParticles.rotation.y += rotation * 0.05;
            dustParticles.rotation.x += rotation * 0.02;
        }
    }
    
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
     * Create an Ocean Waves scene with undulating water and reflections
     */
    createOceanWavesScene() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x222222, 0.6);
        this.scene.add(ambientLight);
        
        // Add directional light for sun-like illumination
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(1, 1, 1);
        this.scene.add(dirLight);
        
        // Add accent light for subtle color
        const blueLight = new THREE.PointLight(0x0066ff, 0.8, 50);
        blueLight.position.set(-10, 5, 10);
        this.scene.add(blueLight);
        
        // Get parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const waveSize = this.mapParam(this.params.size, 30, 80); // Size of ocean plane
        const complexity = Math.floor(this.mapParam(this.params.complexity, 50, 200)); // Resolution of ocean grid
        
        // Create a group to hold all ocean elements
        const oceanGroup = new THREE.Group();
        this.scene.add(oceanGroup);
        
        // Create ocean plane with high detail
        const oceanGeometry = new THREE.PlaneGeometry(
            waveSize, waveSize, 
            complexity, complexity
        );
        
        // Ocean material with realistic water properties
        const waterColor = this.hsvToThree(
            hue, 
            saturation * 0.9, 
            brightness * 0.7
        );
        
        // Create custom material for water
        const oceanMaterial = new THREE.MeshPhysicalMaterial({
            color: waterColor,
            metalness: 0.1,
            roughness: 0.2,
            transparent: true,
            opacity: 0.9,
            reflectivity: 1.0,
            clearcoat: 0.5, // Adds a clear coat layer
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide
        });
        
        // Create ocean mesh
        const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
        ocean.rotation.x = -Math.PI / 2; // Horizontal
        ocean.position.y = -5; // Slightly below center
        oceanGroup.add(ocean);
        
        // Store vertices for wave animation
        const originalVertices = [];
        const vertexCount = oceanGeometry.attributes.position.count;
        
        // Save original positions and create wave parameters for each vertex
        for (let i = 0; i < vertexCount; i++) {
            const x = oceanGeometry.attributes.position.getX(i);
            const y = oceanGeometry.attributes.position.getY(i);
            const z = oceanGeometry.attributes.position.getZ(i);
            
            originalVertices.push({
                x: x,
                y: y,
                z: z,
                // Wave parameters - each vertex has different wave behavior
                waveParams: {
                    frequency1: 0.02 + Math.random() * 0.01,
                    frequency2: 0.05 + Math.random() * 0.02,
                    frequency3: 0.01 + Math.random() * 0.005,
                    amplitude1: 0.5 + Math.random() * 0.5,
                    amplitude2: 0.3 + Math.random() * 0.2,
                    amplitude3: 0.8 + Math.random() * 0.4,
                    phase1: Math.random() * Math.PI * 2,
                    phase2: Math.random() * Math.PI * 2,
                    phase3: Math.random() * Math.PI * 2
                }
            });
        }
        
        // Create skybox with dynamic color
        const skyColor = this.hsvToThree(
            (hue + 0.5) % 1, // Complementary color for sky
            saturation * 0.5,
            brightness * 0.9
        );
        
        const horizonColor = this.hsvToThree(
            (hue + 0.1) % 1,
            saturation * 0.6,
            brightness * 0.8
        );
        
        // Create sky dome
        const skyGeometry = new THREE.SphereGeometry(waveSize * 0.8, 32, 32);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: skyColor },
                bottomColor: { value: horizonColor },
                offset: { value: 10 },
                exponent: { value: 0.6 }
            },
            // Simple vertex/fragment shaders for gradient sky
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    float t = max(0.0, min(1.0, pow(h, exponent)));
                    gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        sky.position.y = 0;
        oceanGroup.add(sky);
        
        // Add some foam particles on the surface
        const foamCount = 500;
        const foamGeometry = new THREE.BufferGeometry();
        const foamPositions = new Float32Array(foamCount * 3);
        const foamSizes = new Float32Array(foamCount);
        
        for (let i = 0; i < foamCount; i++) {
            const i3 = i * 3;
            
            // Random position on the water plane
            const x = (Math.random() - 0.5) * waveSize * 0.9;
            const z = (Math.random() - 0.5) * waveSize * 0.9;
            
            foamPositions[i3] = x;
            foamPositions[i3 + 1] = 0; // Will be updated with wave height
            foamPositions[i3 + 2] = z;
            
            // Random sizes
            foamSizes[i] = 0.1 + Math.random() * 0.3;
        }
        
        foamGeometry.setAttribute('position', new THREE.BufferAttribute(foamPositions, 3));
        foamGeometry.setAttribute('size', new THREE.BufferAttribute(foamSizes, 1));
        
        // Create white foam particle texture
        const foamTextureCanvas = document.createElement('canvas');
        const foamCtx = foamTextureCanvas.getContext('2d');
        foamTextureCanvas.width = 128;
        foamTextureCanvas.height = 128;
        
        // Draw soft white circle
        const foamGradient = foamCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
        foamGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        foamGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        foamGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        foamCtx.fillStyle = foamGradient;
        foamCtx.fillRect(0, 0, 128, 128);
        
        const foamTexture = new THREE.CanvasTexture(foamTextureCanvas);
        
        // Create foam material
        const foamMaterial = new THREE.PointsMaterial({
            size: 1.0,
            map: foamTexture,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        // Create foam particles
        const foam = new THREE.Points(foamGeometry, foamMaterial);
        foam.position.y = -4.8; // Slightly above water
        foam.rotation.x = -Math.PI / 2; // Align with water plane
        oceanGroup.add(foam);
        
        // Store objects for updates
        this.objects.ocean = ocean;
        this.objects.oceanGeometry = oceanGeometry;
        this.objects.originalVertices = originalVertices;
        this.objects.vertexCount = vertexCount;
        this.objects.oceanGroup = oceanGroup;
        this.objects.foam = foam;
        this.objects.sky = sky;
        this.objects.skyMaterial = skyMaterial;
        this.objects.dirLight = dirLight;
        this.objects.blueLight = blueLight;
        this.objects.waveSize = waveSize;
    }
    
    /**
     * Update Ocean Waves scene
     * @param {number} delta - Time since last frame in seconds
     */
    updateOceanWavesScene(delta) {
        if (!this.objects.ocean || !this.objects.originalVertices) return;
        
        const ocean = this.objects.ocean;
        const oceanGeometry = this.objects.oceanGeometry;
        const originalVertices = this.objects.originalVertices;
        const vertexCount = this.objects.vertexCount;
        const speed = this.mapParam(this.params.speed, 0.3, 2) * delta;
        const waveHeight = this.mapParam(this.params.complexity, 0.5, 3);
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const rotation = this.mapParam(this.params.rotation, -0.1, 0.1) * delta;
        
        // Update water color
        if (ocean.material) {
            // Water color with added brightness for realism
            ocean.material.color = this.hsvToThree(hue, saturation * 0.9, brightness * 0.7);
            
            // Update emissive for subtle glow
            ocean.material.emissive = this.hsvToThree(hue, saturation * 0.5, brightness * 0.1);
        }
        
        // Update sky colors
        if (this.objects.skyMaterial && this.objects.skyMaterial.uniforms) {
            // Update sky gradient colors
            this.objects.skyMaterial.uniforms.topColor.value = this.hsvToThree(
                (hue + 0.5) % 1,
                saturation * 0.5,
                brightness * 0.9
            );
            
            this.objects.skyMaterial.uniforms.bottomColor.value = this.hsvToThree(
                (hue + 0.1) % 1,
                saturation * 0.6, 
                brightness * 0.8
            );
        }
        
        // Update directional light for sun effect
        if (this.objects.dirLight) {
            this.objects.dirLight.color = this.hsvToThree(
                (hue + 0.1) % 1,
                saturation * 0.3,
                brightness
            );
        }
        
        // Update colored accent light
        if (this.objects.blueLight) {
            this.objects.blueLight.color = this.hsvToThree(
                hue,
                saturation * 0.8,
                brightness * 0.7
            );
        }
        
        // Update wave animation
        const positions = oceanGeometry.attributes.position.array;
        
        for (let i = 0; i < vertexCount; i++) {
            const i3 = i * 3;
            const vertex = originalVertices[i];
            const waveParams = vertex.waveParams;
            
            // Calculate distance from center for radial waves
            const x = vertex.x;
            const y = vertex.y;
            const distanceFromCenter = Math.sqrt(x * x + y * y);
            
            // Multiple wave components for complex ocean wave effect
            const wave1 = Math.sin(this.time * speed * waveParams.frequency1 + waveParams.phase1 + distanceFromCenter * 0.1) * waveParams.amplitude1;
            const wave2 = Math.sin(this.time * speed * waveParams.frequency2 + waveParams.phase2 + x * 0.2) * waveParams.amplitude2;
            const wave3 = Math.cos(this.time * speed * waveParams.frequency3 + waveParams.phase3 + y * 0.15) * waveParams.amplitude3;
            
            // Combine wave components with adjusted wave height
            const waveZ = (wave1 + wave2 + wave3) * waveHeight;
            
            // Original position + wave height
            positions[i3 + 2] = vertex.z + waveZ;
        }
        
        // Mark vertices for update
        oceanGeometry.attributes.position.needsUpdate = true;
        
        // Compute normals for proper lighting
        oceanGeometry.computeVertexNormals();
        
        // Update foam particles to follow wave surface
        if (this.objects.foam) {
            const foam = this.objects.foam;
            const foamPositions = foam.geometry.attributes.position.array;
            const foamCount = foamPositions.length / 3;
            const waveSize = this.objects.waveSize || 40;
            
            for (let i = 0; i < foamCount; i++) {
                const i3 = i * 3;
                const x = foamPositions[i3];
                const z = foamPositions[i3 + 2];
                
                // Calculate distance from center
                const distFromCenter = Math.sqrt(x * x + z * z);
                
                // Calculate wave height similar to ocean waves
                const waveHeight1 = Math.sin(this.time * speed * 0.2 + distFromCenter * 0.1) * 0.5;
                const waveHeight2 = Math.sin(this.time * speed * 0.3 + x * 0.2) * 0.3;
                const waveHeight3 = Math.cos(this.time * speed * 0.1 + z * 0.15) * 0.4;
                
                // Update y position to follow waves
                foamPositions[i3 + 1] = (waveHeight1 + waveHeight2 + waveHeight3) * waveHeight * 1.2;
                
                // Move foam across surface with "wind"
                foamPositions[i3] += speed * 0.2;
                foamPositions[i3 + 2] += speed * 0.1;
                
                // Reset foam if it leaves the surface
                if (Math.abs(foamPositions[i3]) > waveSize * 0.45 || 
                    Math.abs(foamPositions[i3 + 2]) > waveSize * 0.45) {
                    // Respawn at opposite edge
                    foamPositions[i3] = -foamPositions[i3] * 0.8;
                    foamPositions[i3 + 2] = -foamPositions[i3 + 2] * 0.8;
                }
            }
            
            // Update foam positions
            foam.geometry.attributes.position.needsUpdate = true;
        }
        
        // Slow rotation of whole scene
        if (this.objects.oceanGroup) {
            this.objects.oceanGroup.rotation.y += rotation;
        }
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
    
    /**
     * Create a CRT Oscilloscope scene with retro phosphor glow effect
     */
    createCRTOscilloscopeScene() {
        // Set up screen and phosphor glow colors - brighter phosphor for better glow
        const phosphorGreen = new THREE.Color(0x00ff66);
        const darkGreen = new THREE.Color(0x003311);
        const screenDark = new THREE.Color(0x000800);
        
        // Reset camera position and rotation for 2D-like viewing
        this.camera.position.set(0, 0, 20);
        this.camera.rotation.set(0, 0, 0);
        
        // Create full screen CRT display
        const frameGroup = new THREE.Group();
        this.scene.add(frameGroup);
        
        // Fill most of the screen with the CRT display
        const screenWidth = 18;
        const screenHeight = 14;
        
        // Create CRT screen background (dark rectangle)
        const screenGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
        const screenMaterial = new THREE.MeshBasicMaterial({
            color: screenDark,
            side: THREE.DoubleSide
        });
        const screenMesh = new THREE.Mesh(screenGeometry, screenMaterial);
        frameGroup.add(screenMesh);
        
        // Add screen grid lines - more visible like in the reference
        const gridMaterial = new THREE.LineBasicMaterial({ 
            color: new THREE.Color(0x00aa00), // Brighter green for grid
            transparent: true,
            opacity: 0.3
        });
        
        // Create separate groups for major and minor grid lines
        const horizontalGrid = new THREE.Group();
        const verticalGrid = new THREE.Group();
        const majorHorizontalGrid = new THREE.Group(); // For center line
        const majorVerticalGrid = new THREE.Group();   // For center line
        frameGroup.add(horizontalGrid);
        frameGroup.add(verticalGrid);
        frameGroup.add(majorHorizontalGrid);
        frameGroup.add(majorVerticalGrid);
        
        // Smaller grid spacing for more detailed grid like in the reference
        const gridSpacing = 0.5;
        
        // Create major center lines (brighter)
        const majorGridMaterial = new THREE.LineBasicMaterial({
            color: new THREE.Color(0x00cc00),
            transparent: true,
            opacity: 0.4,
            linewidth: 2
        });
        
        // Create horizontal grid lines
        for (let y = -screenHeight/2; y <= screenHeight/2; y += gridSpacing) {
            // Skip center line - will be drawn as major line
            if (Math.abs(y) < 0.01) continue;
            
            const gridGeo = new THREE.BufferGeometry();
            const points = [
                new THREE.Vector3(-screenWidth/2, y, 0.01),
                new THREE.Vector3(screenWidth/2, y, 0.01)
            ];
            gridGeo.setFromPoints(points);
            
            // Use different opacity based on position for variation
            const lineOpacity = Math.abs(y) % 2 < 0.1 ? 0.4 : 0.2; // Brighter on even units
            const lineMaterial = new THREE.LineBasicMaterial({
                color: gridMaterial.color,
                transparent: true,
                opacity: lineOpacity
            });
            
            const line = new THREE.Line(gridGeo, lineMaterial);
            horizontalGrid.add(line);
        }
        
        // Create vertical grid lines
        for (let x = -screenWidth/2; x <= screenWidth/2; x += gridSpacing) {
            // Skip center line - will be drawn as major line
            if (Math.abs(x) < 0.01) continue;
            
            const gridGeo = new THREE.BufferGeometry();
            const points = [
                new THREE.Vector3(x, -screenHeight/2, 0.01),
                new THREE.Vector3(x, screenHeight/2, 0.01)
            ];
            gridGeo.setFromPoints(points);
            
            // Use different opacity based on position for variation
            const lineOpacity = Math.abs(x) % 2 < 0.1 ? 0.4 : 0.2; // Brighter on even units
            const lineMaterial = new THREE.LineBasicMaterial({
                color: gridMaterial.color,
                transparent: true,
                opacity: lineOpacity
            });
            
            const line = new THREE.Line(gridGeo, lineMaterial);
            verticalGrid.add(line);
        }
        
        // Add major center lines (X=0 and Y=0 axis)
        // Horizontal center line
        const hMajorGeo = new THREE.BufferGeometry();
        hMajorGeo.setFromPoints([
            new THREE.Vector3(-screenWidth/2, 0, 0.02),
            new THREE.Vector3(screenWidth/2, 0, 0.02)
        ]);
        const hMajorLine = new THREE.Line(hMajorGeo, majorGridMaterial);
        majorHorizontalGrid.add(hMajorLine);
        
        // Vertical center line
        const vMajorGeo = new THREE.BufferGeometry();
        vMajorGeo.setFromPoints([
            new THREE.Vector3(0, -screenHeight/2, 0.02),
            new THREE.Vector3(0, screenHeight/2, 0.02)
        ]);
        const vMajorLine = new THREE.Line(vMajorGeo, majorGridMaterial);
        majorVerticalGrid.add(vMajorLine);
        
        // Create phosphor particle system for the oscilloscope trace
        const particleCount = 2000; // High count for smoother trace
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleSizes = new Float32Array(particleCount);
        const particleOpacities = new Float32Array(particleCount);
        const particleColors = new Float32Array(particleCount * 3);
        
        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            // Random positions initially
            particlePositions[i3] = (Math.random() - 0.5) * screenWidth * 0.8;
            particlePositions[i3 + 1] = (Math.random() - 0.5) * screenHeight * 0.8;
            particlePositions[i3 + 2] = 0.05; // Slightly in front of grid
            
            // Initialize with varying sizes for more organic look
            particleSizes[i] = 0.05 + Math.random() * 0.1;
            
            // Initialize with zero opacity
            particleOpacities[i] = 0;
            
            // Initialize with green color
            const color = new THREE.Color(phosphorGreen);
            particleColors[i3] = color.r;
            particleColors[i3 + 1] = color.g;
            particleColors[i3 + 2] = color.b;
        }
        
        // Create particle shader material for custom rendering
        const particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: this.createParticleTexture() }
            },
            vertexShader: `
                attribute float size;
                attribute float opacity;
                attribute vec3 color;
                varying float vOpacity;
                varying vec3 vColor;
                
                void main() {
                    vOpacity = opacity;
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying float vOpacity;
                varying vec3 vColor;
                
                void main() {
                    gl_FragColor = vec4(vColor, vOpacity) * texture2D(pointTexture, gl_PointCoord);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        });
        
        // Set geometry attributes
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
        particleGeometry.setAttribute('opacity', new THREE.BufferAttribute(particleOpacities, 1));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        
        // Create particle system
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        frameGroup.add(particles);
        
        // Create bloom post-processing for enhanced glow
        const bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,    // strength
            0.4,    // radius
            0.85    // threshold
        );
        
        // Add additional phosphor trails for afterglow
        const numTrails = 5;
        const trailParticles = [];
        
        for (let t = 0; t < numTrails; t++) {
            // Create a clone of the particle geometry
            const trailGeometry = new THREE.BufferGeometry();
            const trailPositions = new Float32Array(particleCount * 3);
            const trailSizes = new Float32Array(particleCount);
            const trailOpacities = new Float32Array(particleCount);
            const trailColors = new Float32Array(particleCount * 3);
            
            // Copy initial values
            for (let i = 0; i < particleCount * 3; i++) {
                trailPositions[i] = particlePositions[i];
            }
            
            for (let i = 0; i < particleCount; i++) {
                trailSizes[i] = particleSizes[i] * (1.0 + t * 0.4); // Larger for older trails
                trailOpacities[i] = 0; // Start invisible
                
                // Decay the color for older trails - more yellow/white for newest, darker green for oldest
                const trailFactor = t / numTrails;
                const i3 = i * 3;
                
                // Base color with trail fade effect (more yellow-white for newer, darker for older)
                const color = new THREE.Color(phosphorGreen).lerp(
                    new THREE.Color(0x003300), 
                    trailFactor * 0.7
                );
                
                trailColors[i3] = color.r;
                trailColors[i3 + 1] = color.g;
                trailColors[i3 + 2] = color.b;
            }
            
            // Set trail geometry attributes
            trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
            trailGeometry.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1));
            trailGeometry.setAttribute('opacity', new THREE.BufferAttribute(trailOpacities, 1));
            trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
            
            // Create trail particle material with reduced opacity
            const trailMaterial = particleMaterial.clone();
            
            // Create trail particle system
            const trail = new THREE.Points(trailGeometry, trailMaterial);
            frameGroup.add(trail);
            
            // Store for animation
            trailParticles.push({
                points: trail,
                decay: 0.85 - (t * 0.1),  // Different decay rates for different trails
                age: t                    // Age of trail for timing
            });
        }
        
        // Create a classic oscilloscope frame
        const frameWidth = screenWidth + 2;
        const frameHeight = screenHeight + 2;
        const frameDepth = 2;
        
        // More realistic bevel for the frame
        const frameGeo = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth, 4, 4, 2);
        const frameMaterial = new THREE.MeshPhongMaterial({
            color: 0x303030,
            specular: 0x222222,
            shininess: 20
        });
        
        const frameBorder = new THREE.Mesh(frameGeo, frameMaterial);
        frameBorder.position.z = -1; // Behind screen
        frameGroup.add(frameBorder);
        
        // Add subtle ambient lighting
        const ambientLight = new THREE.AmbientLight(0x222222);
        this.scene.add(ambientLight);
        
        // Add directional light from top for realism
        const dirLight = new THREE.DirectionalLight(0xcccccc, 0.5);
        dirLight.position.set(0, 10, 5);
        this.scene.add(dirLight);
        
        // Add a secondary fill light from the front
        const fillLight = new THREE.DirectionalLight(0x666666, 0.3);
        fillLight.position.set(0, 0, 10);
        this.scene.add(fillLight);
        
        // Add vignette effect around edges of the screen (darker corners)
        const vignetteGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
        const vignetteMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                offset: { value: 0.1 },
                darkness: { value: 1.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float offset;
                uniform float darkness;
                varying vec2 vUv;
                void main() {
                    vec2 uv = vUv;
                    uv = (uv - 0.5) * 2.0;
                    float vignetteAmount = 1.0 - dot(uv, uv);
                    vignetteAmount = smoothstep(0.0, offset, vignetteAmount);
                    gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - vignetteAmount) * darkness);
                }
            `,
            transparent: true,
            depthTest: false
        });
        
        const vignette = new THREE.Mesh(vignetteGeometry, vignetteMaterial);
        vignette.position.z = 0.03; // Just in front of the screen
        frameGroup.add(vignette);
        
        // Create subtle scanlines for CRT effect
        const scanlineGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
        const scanlineMaterial = new THREE.ShaderMaterial({
            uniforms: {
                resolution: { value: new THREE.Vector2(screenWidth * 100, screenHeight * 100) },
                time: { value: 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec2 resolution;
                uniform float time;
                varying vec2 vUv;
                
                void main() {
                    float scanline = sin(vUv.y * resolution.y * 1.0) * 0.5 + 0.5;
                    scanline = pow(scanline, 1.5); // Make lines sharper
                    scanline = 1.0 - (scanline * 0.3); // Make effect subtle
                    
                    // Add slow moving noise for authentic CRT look
                    float noise = fract(sin(dot(vUv + time * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
                    
                    // Combine effects
                    float effect = scanline * (0.95 + noise * 0.05);
                    
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - effect);
                }
            `,
            transparent: true,
            blending: THREE.MultiplyBlending,
            depthTest: false
        });
        
        const scanlines = new THREE.Mesh(scanlineGeometry, scanlineMaterial);
        scanlines.position.z = 0.04; // Just in front of vignette
        frameGroup.add(scanlines);
        
        // Create helper to get audio data for X/Y plotting
        const audioHelper = {
            bufferSize: 1024,
            audioDataL: new Float32Array(1024), // Left channel data
            audioDataR: new Float32Array(1024), // Right channel data
            freqDataL: new Float32Array(1024),  // Left channel frequency data
            freqDataR: new Float32Array(1024),  // Right channel frequency data
            lastUpdate: 0,
            updateInterval: 1000 / 60, // 60fps update rate
            
            // Get a sample at specific index with interpolation
            getSample: function(arr, idx) {
                if (!arr || arr.length === 0) return 0;
                
                // Interpolate between points for smooth transitions
                const i1 = Math.floor(idx) % arr.length;
                const i2 = (i1 + 1) % arr.length;
                const frac = idx - Math.floor(idx);
                
                return arr[i1] * (1 - frac) + arr[i2] * frac;
            }
        };
        
        // Store objects for animation
        this.objects.frameGroup = frameGroup;
        this.objects.particles = particles;
        this.objects.particlePositions = particlePositions;
        this.objects.particleSizes = particleSizes;
        this.objects.particleOpacities = particleOpacities;
        this.objects.particleColors = particleColors;
        this.objects.trailParticles = trailParticles;
        this.objects.screenMesh = screenMesh;
        this.objects.screenWidth = screenWidth;
        this.objects.screenHeight = screenHeight;
        this.objects.particleCount = particleCount;
        this.objects.scanlineMaterial = scanlineMaterial;
        this.objects.vignetteMaterial = vignetteMaterial;
        this.objects.bloomPass = bloomPass;
        this.objects.dirLight = dirLight;
        this.objects.fillLight = fillLight;
        this.objects.phosphorGreen = phosphorGreen;
        this.objects.darkGreen = darkGreen;
        this.objects.screenDark = screenDark;
        this.objects.audioHelper = audioHelper;
        
        // Store grid objects for animation
        this.objects.horizontalGrid = horizontalGrid;
        this.objects.verticalGrid = verticalGrid;
        this.objects.majorHorizontalGrid = majorHorizontalGrid;
        this.objects.majorVerticalGrid = majorVerticalGrid;
        
        // Set up particle behavior parameters
        this.objects.phosphorParams = {
            persistence: 0.97,         // How long the phosphor "remembers" the signal
            afterglowDuration: 2.0,    // Duration of afterglow in seconds
            intensity: 0.9,            // Base phosphor intensity
            flicker: 0.03,             // Random CRT flicker amount
            pointSize: 0.15,           // Base point size for particles
            trailDelay: 0.05,          // Delay between trail updates in seconds
            dotCount: 200,             // Number of points in the oscilloscope trace
            lastTrailUpdate: 0,        // Timestamp of last trail update
            sampleRate: 60,            // How many samples per second to show
            sampleSpeed: 0.5,          // How fast to move through the audio buffer
            bufferOffset: 0,           // Current offset in the audio buffer
            
            // Audio generation parameters (used when no mic input)
            audioGenParams: {
                leftFreq: 1.0,         // Base frequency for left channel
                rightFreq: 1.3,        // Base frequency for right channel
                modFreqL: 0.2,         // Modulation frequency for left
                modFreqR: 0.3,         // Modulation frequency for right
                modDepth: 0.7,         // Modulation depth
                noiseAmount: 0.1       // Amount of noise to add
            }
        };
        
        // Keep screen perfectly flat for 2D-like appearance
        frameGroup.rotation.x = 0;
        frameGroup.rotation.y = 0;
        frameGroup.rotation.z = 0;
        
        // Reset any scene rotation to ensure oscilloscope is flat on screen
        this.scene.rotation.x = 0;
        this.scene.rotation.y = 0;
        this.scene.rotation.z = 0;
        
        // Set default params to ensure visualization works
        this.params.rotation = 0;  // No rotation by default
        this.params.zoom = 0.5;    // Good default zoom level
        
        // Reset internal state variables
        this._lastRotationX = 0;
        this._lastRotationY = 0;
        this.rotationX = 0;
        this.rotationY = 0;
    }
    
    // Particle texture is already defined in the createParticleTexture method
    // and is being used for all visualizers
    
    /**
     * Update the CRT Oscilloscope scene
     * @param {number} delta - Time since last frame in seconds
     */
    updateCRTOscilloscopeScene(delta) {
        if (!this.objects.particles || !this.objects.particlePositions) return;
        
        const particles = this.objects.particles;
        const particlePositions = this.objects.particlePositions;
        const particleSizes = this.objects.particleSizes;
        const particleOpacities = this.objects.particleOpacities;
        const particleColors = this.objects.particleColors;
        const particleCount = this.objects.particleCount;
        const trailParticles = this.objects.trailParticles;
        const screenWidth = this.objects.screenWidth;
        const screenHeight = this.objects.screenHeight;
        const audioHelper = this.objects.audioHelper;
        const phosphorParams = this.objects.phosphorParams;
        
        // Get user control parameters
        const speed = this.mapParam(this.params.speed, 0.2, 2); // Controls how fast we move through audio data
        const hue = this.params.hue; // Tint the phosphor color
        const complexity = this.mapParam(this.params.complexity, 1, 8); // Controls figure complexity
        const intensity = this.mapParam(this.params.brightness, 0.5, 1.5); // Controls brightness
        const size = this.mapParam(this.params.size, 0.5, 2); // Controls overall scale
        const density = this.mapParam(this.params.density, 20, 200); // Controls number of active dots
        
        // Update phosphor parameters based on user input
        phosphorParams.intensity = intensity;
        phosphorParams.sampleSpeed = speed;
        phosphorParams.pointSize = 0.1 * size;
        phosphorParams.dotCount = Math.min(particleCount, Math.floor(density)); 
        
        // Update oscilloscope pattern complexity
        phosphorParams.audioGenParams.modFreqL = 0.1 + complexity * 0.15;
        phosphorParams.audioGenParams.modFreqR = 0.15 + complexity * 0.2;
        phosphorParams.audioGenParams.modDepth = 0.3 + complexity * 0.07;
        phosphorParams.audioGenParams.leftFreq = 0.5 + complexity * 0.2;
        phosphorParams.audioGenParams.rightFreq = 0.7 + complexity * 0.15;
        
        // Update scanlines and screen shaders
        if (this.objects.scanlineMaterial && this.objects.scanlineMaterial.uniforms) {
            this.objects.scanlineMaterial.uniforms.time.value = this.time;
        }
        
        // Update phosphor color based on hue while maintaining classic green look
        const baseGreen = this.hsvToThree(
            (0.33 + hue * 0.1) % 1, // Slight hue variation around green
            0.9, // Strong saturation
            intensity * 0.9 // User-controlled brightness
        );
        
        // Make screen background respond slightly to intensity and hue
        const screenColor = new THREE.Color(0x001100);
        screenColor.lerp(baseGreen, 0.03 * intensity);
        this.objects.screenMesh.material.color = screenColor;
        
        // Get audio data or generate synthetic data if none available
        let hasAudioData = false;
        
        // Try to get actual audio data from window.audioData (if available)
        if (window.audioData && 
            window.audioData.timeData && 
            window.audioData.timeData.length > 0) {
            
            hasAudioData = true;
            // Copy audio data from global object
            for (let i = 0; i < audioHelper.bufferSize && i < window.audioData.timeData.length; i++) {
                // Split stereo to left/right if available, otherwise use same data
                if (window.audioData.timeDataL && window.audioData.timeDataL.length > 0) {
                    audioHelper.audioDataL[i] = window.audioData.timeDataL[i];
                    audioHelper.audioDataR[i] = window.audioData.timeDataR[i] || window.audioData.timeDataL[i];
                } else {
                    // If no stereo data, use mono and create synthetic stereo
                    audioHelper.audioDataL[i] = window.audioData.timeData[i];
                    audioHelper.audioDataR[i] = window.audioData.timeData[(i + 10) % window.audioData.timeData.length];
                }
            }
            
            // Also get frequency data if available (for color modulation)
            if (window.audioData.frequencyData && window.audioData.frequencyData.length > 0) {
                for (let i = 0; i < audioHelper.bufferSize && i < window.audioData.frequencyData.length; i++) {
                    audioHelper.freqDataL[i] = window.audioData.frequencyData[i] / 255; // Normalize to 0-1
                }
            }
        } 
        
        // If no audio data, generate synthetic patterns for visualization
        if (!hasAudioData) {
            const gen = phosphorParams.audioGenParams;
            const t = this.time;
            
            // Generate a cosine wave pattern like in classic oscilloscopes
            // Based on the reference image showing clean cosine pattern
            for (let i = 0; i < audioHelper.bufferSize; i++) {
                const phase = (i / audioHelper.bufferSize) * Math.PI * 8; // Multiple cycles
                
                // Left channel: clean cosine wave (X axis)
                // Use time to slowly rotate around the circle
                audioHelper.audioDataL[i] = Math.cos(phase + t * 0.2) * 0.8;
                
                // Right channel: cosine wave with phase shift (Y axis)
                // This creates a classic Lissajous pattern like in the reference
                audioHelper.audioDataR[i] = Math.cos(phase * 1.001 + t * 0.1) * 0.8;
                
                // Add very subtle harmonics for some texture
                audioHelper.audioDataL[i] += Math.cos(phase * 2 + t * 0.05) * 0.05;
                audioHelper.audioDataR[i] += Math.cos(phase * 2 + t * 0.05) * 0.05;
                
                // Add extremely subtle noise for CRT realism (much less than before)
                const noise = (Math.random() * 2 - 1) * 0.01;
                audioHelper.audioDataL[i] += noise;
                audioHelper.audioDataR[i] += noise;
                
                // Generate frequency data for brightness modulation
                audioHelper.freqDataL[i] = 0.8 + 0.2 * Math.abs(audioHelper.audioDataL[i]);
            }
        }
        
        // Advance buffer offset based on speed
        phosphorParams.bufferOffset += phosphorParams.sampleSpeed * delta * 1000;
        phosphorParams.bufferOffset %= audioHelper.bufferSize;
        
        // Add random flicker effect (CRT noise)
        const flicker = (Math.random() - 0.5) * phosphorParams.flicker * intensity;
        
        // Create X/Y data from left and right audio channels 
        // This creates a classic audio oscilloscope pattern (Lissajous figures)
        for (let i = 0; i < phosphorParams.dotCount; i++) {
            const i3 = i * 3;
            // Get sample index with wrap-around
            const sampleIdx = (phosphorParams.bufferOffset + (i / phosphorParams.dotCount) * audioHelper.bufferSize) % audioHelper.bufferSize;
            
            // Get left and right channel values at this point (-1 to 1 range)
            const leftVal = audioHelper.getSample(audioHelper.audioDataL, sampleIdx);
            const rightVal = audioHelper.getSample(audioHelper.audioDataR, sampleIdx);
            
            // Scale to screen dimensions and apply size parameter
            const xPos = leftVal * (screenWidth * 0.4) * size;
            const yPos = rightVal * (screenHeight * 0.4) * size;
            
            // Update particle positions
            particlePositions[i3] = xPos;
            particlePositions[i3 + 1] = yPos;
            
            // Update particle size based on position (larger in center)
            // Adjust size based on position - classic oscilloscope look has consistent dot size
            const distFromCenter = Math.sqrt(xPos * xPos + yPos * yPos);
            const normalizedDist = Math.min(1, distFromCenter / (screenWidth * 0.5));
            // For classic green scope, keep dots more uniform in size for that authentic look
            const sizeFactor = 0.9; // Consistent size for all points
            
            // Apply size parameter 
            particleSizes[i] = phosphorParams.pointSize * sizeFactor;
            
            // For primary trace, make dots bright and clear like in the reference
            particleOpacities[i] = 1.0 + flicker;
            
            // Get color based on frequency data (if available)
            // Use the frequency data for a more dynamic color effect
            let freqVal = audioHelper.getSample(audioHelper.freqDataL, sampleIdx * 0.5);
            
            // For classic green oscilloscope look, keep color more consistent
            // Traditional phosphor green is around ~530nm wavelength (hue ~0.33)
            const dotHue = 0.33; // Pure green for authentic phosphor look
            const dotSat = 1.0;  // Fully saturated
            const dotBright = intensity * 0.9 + freqVal * 0.1; // Mostly consistent brightness
            
            // Create color for this dot - true phosphor green
            const color = this.hsvToThree(dotHue, dotSat, dotBright);
            
            // Update particle colors
            particleColors[i3] = color.r;
            particleColors[i3 + 1] = color.g;
            particleColors[i3 + 2] = color.b;
        }
        
        // Update the active traces
        particles.geometry.attributes.position.needsUpdate = true;
        particles.geometry.attributes.size.needsUpdate = true;
        particles.geometry.attributes.opacity.needsUpdate = true;
        particles.geometry.attributes.color.needsUpdate = true;
        
        // Update afterglow trails
        // Only update trails occasionally for performance and to simulate phosphor physics
        const now = this.time;
        if (now - phosphorParams.lastTrailUpdate > phosphorParams.trailDelay) {
            phosphorParams.lastTrailUpdate = now;
            
            // Update each trail layer
            trailParticles.forEach(trail => {
                const trailPoints = trail.points;
                const trailPositions = trailPoints.geometry.attributes.position.array;
                const trailOpacities = trailPoints.geometry.attributes.opacity.array;
                const trailColors = trailPoints.geometry.attributes.color.array;
                
                // Decay factor based on trail age
                const decay = trail.decay;
                
                // Copy positions from main trace, apply decay to opacities
                for (let i = 0; i < phosphorParams.dotCount; i++) {
                    const i3 = i * 3;
                    
                    // Copy positions
                    trailPositions[i3] = particlePositions[i3];
                    trailPositions[i3 + 1] = particlePositions[i3 + 1];
                    trailPositions[i3 + 2] = particlePositions[i3 + 2] - 0.01 * trail.age; // Slightly behind main trace
                    
                    // Decay opacity
                    trailOpacities[i] = Math.max(0, trailOpacities[i] * decay + particleOpacities[i] * (1 - decay) * 0.7);
                    
                    // Shift colors slightly towards darker green
                    const mainR = particleColors[i3];
                    const mainG = particleColors[i3 + 1];
                    const mainB = particleColors[i3 + 2];
                    
                    trailColors[i3] = mainR * 0.7;
                    trailColors[i3 + 1] = mainG;  // Keep green channel strong
                    trailColors[i3 + 2] = mainB * 0.7;
                }
                
                // Update trail geometries
                trailPoints.geometry.attributes.position.needsUpdate = true;
                trailPoints.geometry.attributes.opacity.needsUpdate = true;
                trailPoints.geometry.attributes.color.needsUpdate = true;
            });
        }
        
        // Add subtle CRT screen-wide phosphor glow based on intensity
        if (this.objects.screenMesh) {
            const glow = (0.001 + intensity * 0.005) + flicker * 0.002;
            const bloomStrength = intensity * 0.8 + flicker * 0.2;
            
            // If renderer has a bloom pass, adjust its strength
            if (this.objects.bloomPass) {
                this.objects.bloomPass.strength = bloomStrength;
            }
        }
    }
} // End of WebGLVisuals class