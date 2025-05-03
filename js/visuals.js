/**
 * Visual Engine for LiveArt
 * Manages canvas rendering and visual algorithms
 */
class VisualEngine {
    constructor(canvasId) {
        // Initialize canvas and context
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.fps = 0;
        this.fpsUpdateInterval = 500; // Update FPS display every 500ms
        this.lastFpsUpdate = 0;
        
        // Animation state
        this.isRunning = false;
        this.frameId = null;
        
        // Post-processing effects
        this.effectsEnabled = false;
        this.effectParams = {
            glitchIntensity: 0,
            chromaticAberration: 0,
            pixelate: 0,
            vignette: 0,
            bloom: 0,
            feedbackAmount: 0
        };
        
        // Create offscreen buffers for effects
        this.createEffectBuffers();
        
        // Visual parameters (default values)
        this.params = {
            // Core parameters
            hue: 0.5,            // Base color hue (0-1)
            saturation: 0.8,     // Color saturation (0-1)
            brightness: 0.9,     // Color brightness (0-1)
            density: 0.5,        // Number of elements (0-1)
            speed: 0.5,          // Animation speed (0-1)
            size: 0.5,           // Element size (0-1)
            complexity: 0.5,     // Pattern complexity (0-1)
            
            // Secondary parameters
            rotation: 0,         // Global rotation
            zoom: 1,             // Global zoom
            noiseScale: 0.01,    // For noise-based patterns
            noiseSpeed: 0.005,   // For noise-based patterns
            symmetry: 4,         // Symmetry divisions
            reactivity: 0.5,     // How reactive visuals are to changes
            smoothing: 0.5       // Parameter smoothing (0-1)
        };
        
        // Target values for smooth interpolation
        this.targetParams = {...this.params};
        
        // Current visual algorithm
        this.currentVisual = 'audioReactive';
        
        // Visual generator functions
        this.visualGenerators = {
            particles: this.renderParticles.bind(this),
            waves: this.renderWaves.bind(this),
            grid: this.renderGrid.bind(this),
            fractals: this.renderFractals.bind(this),
            audioReactive: this.renderAudioReactive.bind(this),
            fluidDynamics: this.renderFluidDynamics.bind(this),
            neonGrid: this.renderNeonGrid.bind(this),
            galaxies: this.renderGalaxies.bind(this),
            // New visualizations
            kaleidoscope: this.renderKaleidoscope.bind(this),
            lissajous: this.renderLissajous.bind(this),
            voronoi: this.renderVoronoi.bind(this),
            tentacles: this.renderTentacles.bind(this),
            circuitBoard: this.renderCircuitBoard.bind(this),
            pixelFlow: this.renderPixelFlow.bind(this),
            // Oscilloscope visualization
            oscilloscope: this.renderOscilloscope.bind(this),
            'webgl-crtOscilloscope': this.renderOscilloscope.bind(this)
        };
        
        // We'll initialize visualization specific state after all methods are defined
        this.initializeVisualizationState();
        
        // Initialize time and noise
        this.time = 0;
        
        // Resize handling
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }
    
    /**
     * Set canvas dimensions to match window
     */
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Store center points for convenience
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        
        // Store dimensions for convenience
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }
    
    /**
     * Start the animation loop
     */
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastFrameTime = performance.now();
            this.animate();
        }
    }
    
    /**
     * Stop the animation loop
     */
    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            if (this.frameId) {
                cancelAnimationFrame(this.frameId);
                this.frameId = null;
            }
        }
    }
    
    /**
     * Main animation loop
     * @param {number} timestamp - Current timestamp
     */
    animate(timestamp = 0) {
        if (!this.isRunning) return;
        
        // Calculate delta time and update time counter
        const delta = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;
        
        // Update parameters with smoothing
        this.updateParamsWithSmoothing(delta);
        
        // Update global time (scaled by speed)
        this.time += delta * 0.001 * this.mapParam(this.params.speed, 0.2, 2);
        
        // Update FPS counter
        this.updateFPS(delta);
        
        // Clear canvas - if using effects, clear mainBuffer instead
        if (this.effectsEnabled && this.mainBuffer) {
            // Clear the main buffer
            this.mainBufferCtx.clearRect(0, 0, this.mainBuffer.width, this.mainBuffer.height);
            
            // Render to the main buffer
            const originalCtx = this.ctx;
            this.ctx = this.mainBufferCtx; // Temporarily redirect rendering
            
            // Render current visual to buffer
            if (this.visualGenerators[this.currentVisual]) {
                this.visualGenerators[this.currentVisual](delta);
            }
            
            // Restore original context
            this.ctx = originalCtx;
            
            // Clear the actual canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Apply post-processing effects
            this.applyPostProcessing();
        } else {
            // Standard rendering without effects
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Render current visual directly to canvas
            if (this.visualGenerators[this.currentVisual]) {
                this.visualGenerators[this.currentVisual](delta);
            }
        }
        
        // Request next frame
        this.frameId = requestAnimationFrame(this.animate.bind(this));
    }
    
    /**
     * Set a parameter value
     * @param {string} paramName - Parameter name
     * @param {number} value - Parameter value (0-1)
     */
    setParam(paramName, value) {
        // Set target parameter for smoother transitions
        if (this.params.hasOwnProperty(paramName)) {
            // For the smoothing parameter itself, apply immediately with reactivity
            if (paramName === 'smoothing') {
                const reactivity = this.params.reactivity;
                this.params[paramName] = this.params[paramName] * (1 - reactivity) + value * reactivity;
                this.targetParams[paramName] = this.params[paramName];
                return;
            }
            
            // Apply reactivity to the target value
            const reactivity = this.params.reactivity;
            this.targetParams[paramName] = this.targetParams[paramName] * (1 - reactivity) + value * reactivity;
        }
        
        // Check if this is an effect parameter
        if (this.effectParams && this.effectParams.hasOwnProperty(paramName)) {
            // Apply reactivity for smooth transitions to target
            const reactivity = this.params.reactivity || 0.5;
            this.effectParams[paramName] = this.effectParams[paramName] * (1 - reactivity) + value * reactivity;
        }
        
        // Toggle effects globally - apply immediately without smoothing
        if (paramName === 'effectsEnabled') {
            const wasEnabled = this.effectsEnabled;
            this.effectsEnabled = value > 0.5;
            
            // If enabling effects, ensure buffers are properly sized
            if (!wasEnabled && this.effectsEnabled) {
                this.resizeEffectBuffers();
            }
        }
    }
    
    /**
     * Create offscreen buffers for post-processing effects
     */
    createEffectBuffers() {
        try {
            // Main buffer to render the scene into
            this.mainBuffer = document.createElement('canvas');
            this.mainBufferCtx = this.mainBuffer.getContext('2d');
            
            // Feedback buffer for trails and echoes
            this.feedbackBuffer = document.createElement('canvas');
            this.feedbackBufferCtx = this.feedbackBuffer.getContext('2d');
            
            // Bloom buffer for glow effects
            this.bloomBuffer = document.createElement('canvas');
            this.bloomBufferCtx = this.bloomBuffer.getContext('2d');
            
            // Update buffer sizes on canvas resize
            this.resizeEffectBuffers();
            
            // Register resize handler
            window.addEventListener('resize', () => this.resizeEffectBuffers());
        } catch (e) {
            console.warn('Could not create effect buffers:', e);
            this.effectsEnabled = false;
        }
    }
    
    /**
     * Resize effect buffers when canvas size changes
     */
    resizeEffectBuffers() {
        if (!this.canvas) return;
        
        // Get current canvas size
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        if (width === 0 || height === 0) {
            console.warn('Canvas has zero width or height, skipping buffer resize');
            return;
        }
        
        // Resize all buffers
        if (this.mainBuffer) {
            this.mainBuffer.width = width;
            this.mainBuffer.height = height;
        }
        
        if (this.feedbackBuffer) {
            this.feedbackBuffer.width = width;
            this.feedbackBuffer.height = height;
        }
        
        if (this.bloomBuffer) {
            this.bloomBuffer.width = width;
            this.bloomBuffer.height = height;
        }
        
        console.log(`Resized effect buffers to ${width}x${height}`);
    }
    
    /**
     * Apply post-processing effects to the rendered scene
     */
    applyPostProcessing() {
        if (!this.effectsEnabled) {
            return;
        }
        
        // Make sure effect buffers are correctly sized
        if (this.mainBuffer.width !== this.canvas.width || this.mainBuffer.height !== this.canvas.height) {
            this.resizeEffectBuffers();
        }
        
        // Cache params for easier access
        const { glitchIntensity, chromaticAberration, pixelate, vignette, bloom, feedbackAmount } = this.effectParams;
        
        // Use main buffer if any effects are active
        if (glitchIntensity > 0 || chromaticAberration > 0 || pixelate > 0 || 
            vignette > 0 || bloom > 0 || feedbackAmount > 0) {
            
            // Apply feedback effect (trails/echoes)
            if (feedbackAmount > 0 && this.feedbackBuffer) {
                // Draw previous frame with fading
                this.feedbackBufferCtx.globalAlpha = feedbackAmount;
                this.feedbackBufferCtx.drawImage(this.canvas, 0, 0);
                
                // Apply the feedback to the main buffer with a blend
                this.mainBufferCtx.globalAlpha = 0.3;
                this.mainBufferCtx.globalCompositeOperation = 'lighter';
                this.mainBufferCtx.drawImage(this.feedbackBuffer, 0, 0);
                this.mainBufferCtx.globalAlpha = 1.0;
                this.mainBufferCtx.globalCompositeOperation = 'source-over';
            }
            
            // Apply bloom effect
            if (bloom > 0 && this.bloomBuffer) {
                // Copy main buffer to bloom buffer
                this.bloomBufferCtx.clearRect(0, 0, this.bloomBuffer.width, this.bloomBuffer.height);
                this.bloomBufferCtx.drawImage(this.mainBuffer, 0, 0);
                
                // Apply blur to the bloom buffer
                const blurAmount = bloom * 20;
                this.bloomBufferCtx.filter = `blur(${blurAmount}px)`;
                this.bloomBufferCtx.globalAlpha = bloom;
                this.bloomBufferCtx.drawImage(this.mainBuffer, 0, 0);
                this.bloomBufferCtx.filter = 'none';
                this.bloomBufferCtx.globalAlpha = 1.0;
                
                // Apply bloom on top of the main buffer
                this.mainBufferCtx.globalCompositeOperation = 'lighter';
                this.mainBufferCtx.drawImage(this.bloomBuffer, 0, 0);
                this.mainBufferCtx.globalCompositeOperation = 'source-over';
            }
            
            // Apply chromatic aberration
            if (chromaticAberration > 0) {
                const offset = chromaticAberration * 10;
                
                // Create temporary canvas for each color channel
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.mainBuffer.width;
                tempCanvas.height = this.mainBuffer.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Red channel (shifted left)
                tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.globalCompositeOperation = 'source-over';
                tempCtx.drawImage(this.mainBuffer, 0, 0);
                tempCtx.globalCompositeOperation = 'multiply';
                tempCtx.fillStyle = '#ff0000';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                this.ctx.globalCompositeOperation = 'lighter';
                this.ctx.drawImage(tempCanvas, -offset, 0);
                
                // Blue channel (shifted right)
                tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.globalCompositeOperation = 'source-over';
                tempCtx.drawImage(this.mainBuffer, 0, 0);
                tempCtx.globalCompositeOperation = 'multiply';
                tempCtx.fillStyle = '#0000ff';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                this.ctx.drawImage(tempCanvas, offset, 0);
                
                // Green channel (centered)
                tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.globalCompositeOperation = 'source-over';
                tempCtx.drawImage(this.mainBuffer, 0, 0);
                tempCtx.globalCompositeOperation = 'multiply';
                tempCtx.fillStyle = '#00ff00';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                this.ctx.drawImage(tempCanvas, 0, 0);
                this.ctx.globalCompositeOperation = 'source-over';
                
                return; // Skip the final composite as we've done it already
            }
            
            // Apply pixelate effect
            if (pixelate > 0) {
                const pixelSize = Math.max(2, Math.floor(pixelate * 20));
                
                // Create a smaller version and scale back up for pixelation
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                tempCanvas.width = this.mainBuffer.width / pixelSize;
                tempCanvas.height = this.mainBuffer.height / pixelSize;
                
                tempCtx.drawImage(this.mainBuffer, 0, 0, tempCanvas.width, tempCanvas.height);
                
                this.ctx.imageSmoothingEnabled = false;
                this.ctx.drawImage(tempCanvas, 0, 0, this.canvas.width, this.canvas.height);
                this.ctx.imageSmoothingEnabled = true;
                
                return; // Skip the final composite as we've done it already
            }
            
            // Apply vignette effect
            if (vignette > 0) {
                const gradient = this.ctx.createRadialGradient(
                    this.canvas.width / 2, this.canvas.height / 2, 0,
                    this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2
                );
                
                gradient.addColorStop(0, 'rgba(0,0,0,0)');
                gradient.addColorStop(1 - vignette * 0.5, 'rgba(0,0,0,0)');
                gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
                
                this.ctx.fillStyle = gradient;
                this.ctx.globalCompositeOperation = 'multiply';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.globalCompositeOperation = 'source-over';
            }
            
            // Apply glitch effect
            if (glitchIntensity > 0) {
                // Only apply occasionally based on intensity
                if (Math.random() < glitchIntensity * 0.1) {
                    // Random glitch slices
                    const numSlices = Math.floor(glitchIntensity * 10) + 1;
                    const sliceHeight = this.canvas.height / numSlices;
                    
                    for (let i = 0; i < numSlices; i++) {
                        const y = i * sliceHeight;
                        const offsetX = (Math.random() - 0.5) * glitchIntensity * 100;
                        
                        this.ctx.drawImage(
                            this.mainBuffer,
                            0, y, this.canvas.width, sliceHeight,
                            offsetX, y, this.canvas.width, sliceHeight
                        );
                    }
                    
                    return; // Skip the final composite as we've done it already
                }
            }
            
            // Composite the main buffer to the canvas if we haven't already
            this.ctx.drawImage(this.mainBuffer, 0, 0);
        }
    }
    
    /**
     * Update FPS counter
     * @param {number} delta - Time since last frame in ms
     */
    updateFPS(delta) {
        // Calculate current FPS
        this.fps = 1000 / delta;
        
        // Update display occasionally to avoid rapid changes
        if (performance.now() - this.lastFpsUpdate > this.fpsUpdateInterval) {
            document.getElementById('fps').textContent = Math.round(this.fps);
            this.lastFpsUpdate = performance.now();
        }
    }
    
    /**
     * Set current visual algorithm
     * @param {string} visualName - Name of the visual to use
     */
    setVisual(visualName) {
        if (this.visualGenerators[visualName]) {
            this.currentVisual = visualName;
        }
    }
    
    /**
     * Update a parameter value
     * @param {string} paramName - Parameter name
     * @param {number} value - New parameter value (0-1)
     */
    setParam(paramName, value) {
        if (this.params.hasOwnProperty(paramName)) {
            // Apply reactivity - blend between current and new value
            const reactivity = this.params.reactivity;
            this.params[paramName] = this.params[paramName] * (1 - reactivity) + value * reactivity;
        }
    }
    
    /**
     * Map a parameter value from 0-1 to a specific range
     * @param {number} value - Parameter value (0-1)
     * @param {number} min - Minimum output value
     * @param {number} max - Maximum output value
     * @param {boolean} curved - Whether to apply easing curve
     * @returns {number} - Mapped value
     */
    mapParam(value, min, max, curved = false) {
        if (curved) {
            // Apply easing curve
            value = value < 0.5 
                ? 2 * value * value 
                : 1 - Math.pow(-2 * value + 2, 2) / 2;
        }
        return min + value * (max - min);
    }
    
    /**
     * Convert HSB (0-1) to RGB color string
     * @param {number} h - Hue (0-1)
     * @param {number} s - Saturation (0-1)
     * @param {number} b - Brightness (0-1)
     * @param {number} a - Alpha (0-1)
     * @returns {string} - CSS rgba color string
     */
    hsbaToRgba(h, s, b, a = 1) {
        h = h * 360;
        s = s * 100;
        b = b * 100;
        
        const f = (n, k = (n + h / 60) % 6) => b * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)) / 100) / 100 * 255;
        
        return `rgba(${Math.round(f(5))}, ${Math.round(f(3))}, ${Math.round(f(1))}, ${a})`;
    }
    
    /**
     * Perlin noise utility (1D, 2D, 3D)
     * Simple implementation for demo purposes
     */
    noise(x, y = 0, z = 0) {
        // Simple pseudo-noise function
        const dot = (x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
        return (Math.sin(dot) * 0.5 + 0.5);
    }
    
    /** 
     * Render particle-based visuals
     */
    renderParticles() {
        const numParticles = this.mapParam(this.params.density, 50, 500);
        const particleSize = this.mapParam(this.params.size, 2, 20);
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const speed = this.mapParam(this.params.speed, 0.2, 2);
        const noiseScale = this.mapParam(this.params.noiseScale, 0.001, 0.05);
        
        // Save context for transformations
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(this.time * 0.1 * this.mapParam(this.params.rotation, -0.5, 0.5));
        this.ctx.scale(this.params.zoom, this.params.zoom);
        
        // Draw each particle
        for (let i = 0; i < numParticles; i++) {
            // Calculate position using noise and time
            const angle = (i / numParticles) * Math.PI * 2 * this.params.symmetry;
            const radius = this.width * 0.3 * (0.5 + 0.5 * 
                this.noise(
                    Math.cos(angle) * noiseScale, 
                    Math.sin(angle) * noiseScale, 
                    this.time * speed
                )
            );
            
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            // Vary color slightly for each particle
            const particleHue = (hue + i / numParticles * 0.2 * this.params.complexity) % 1;
            const particleAlpha = 0.7 + 0.3 * this.noise(x * 0.01, y * 0.01, this.time);
            
            const color = this.hsbaToRgba(particleHue, saturation, brightness, particleAlpha);
            
            // Draw particle
            this.ctx.beginPath();
            this.ctx.fillStyle = color;
            this.ctx.arc(x, y, particleSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Restore context
        this.ctx.restore();
    }
    
    /**
     * Render wave-based visuals
     */
    renderWaves() {
        const amplitude = this.height * 0.2;
        const frequency = this.mapParam(this.params.complexity, 1, 20);
        const layers = Math.floor(this.mapParam(this.params.density, 3, 15));
        const waveWidth = this.mapParam(this.params.size, 2, 10);
        
        // Save context
        this.ctx.save();
        
        // Draw each wave layer
        for (let layer = 0; layer < layers; layer++) {
            const layerOffset = layer / layers;
            const waveHue = (this.params.hue + layerOffset * 0.2) % 1;
            const alpha = 0.3 + 0.7 * (1 - layerOffset);
            
            this.ctx.strokeStyle = this.hsbaToRgba(
                waveHue, 
                this.params.saturation, 
                this.params.brightness, 
                alpha
            );
            
            this.ctx.lineWidth = waveWidth * (1 - layerOffset * 0.5);
            this.ctx.beginPath();
            
            // Draw wave path
            for (let x = 0; x <= this.width; x += 5) {
                const progress = x / this.width;
                
                // Multiple frequencies and modulation
                const y = this.centerY + 
                    amplitude * Math.sin(
                        (progress * frequency + this.time * this.params.speed + layerOffset) * Math.PI * 2
                    ) +
                    amplitude * 0.5 * Math.sin(
                        (progress * frequency * 2 + this.time * this.params.speed * 1.5) * Math.PI * 2
                    ) * this.params.complexity;
                
                if (x === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            
            this.ctx.stroke();
        }
        
        // Restore context
        this.ctx.restore();
    }
    
    /**
     * Render grid-based visuals
     */
    renderGrid() {
        const gridSize = Math.floor(this.mapParam(this.params.density, 5, 30));
        const cellSize = Math.min(this.width, this.height) / gridSize;
        const complexity = this.mapParam(this.params.complexity, 1, 8);
        
        // Save context
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(this.time * 0.1 * this.mapParam(this.params.rotation, -0.5, 0.5));
        
        // Draw grid
        for (let y = -gridSize / 2; y < gridSize / 2; y++) {
            for (let x = -gridSize / 2; x < gridSize / 2; x++) {
                // Calculate cell position
                const posX = x * cellSize;
                const posY = y * cellSize;
                
                // Use noise to determine cell properties
                const noiseVal = this.noise(
                    Math.abs(x / gridSize) * complexity, 
                    Math.abs(y / gridSize) * complexity, 
                    this.time * this.params.speed
                );
                
                // Adjust cell size based on noise
                const dynamicSize = cellSize * this.mapParam(this.params.size, 0.2, 0.9) * noiseVal;
                
                // Calculate color
                const hue = (this.params.hue + noiseVal * 0.2) % 1;
                const alpha = 0.2 + 0.8 * noiseVal;
                
                // Draw cell
                this.ctx.fillStyle = this.hsbaToRgba(
                    hue, 
                    this.params.saturation, 
                    this.params.brightness, 
                    alpha
                );
                
                this.ctx.fillRect(
                    posX - dynamicSize / 2, 
                    posY - dynamicSize / 2, 
                    dynamicSize, 
                    dynamicSize
                );
            }
        }
        
        // Restore context
        this.ctx.restore();
    }
    
    /**
     * Render fractal-based visuals
     */
    renderFractals() {
        const maxDepth = Math.floor(this.mapParam(this.params.complexity, 1, 6));
        const size = Math.min(this.width, this.height) * 0.7;
        const rotation = this.time * this.params.speed * 0.5;
        
        // Save context
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        
        // Draw fractal recursively
        this.drawFractalBranch(
            0, 0, 
            size, 
            0, 
            maxDepth, 
            this.params.hue,
            this.params.saturation, 
            this.params.brightness
        );
        
        // Restore context
        this.ctx.restore();
    }
    
    /**
     * Helper method to draw fractal branches recursively
     */
    drawFractalBranch(x, y, size, angle, depth, hue, saturation, brightness) {
        if (depth <= 0) return;
        
        // Calculate endpoint based on angle
        const endX = x + Math.cos(angle) * size;
        const endY = y + Math.sin(angle) * size;
        
        // Draw this branch
        this.ctx.lineWidth = depth * 2 * this.mapParam(this.params.size, 0.5, 2);
        this.ctx.strokeStyle = this.hsbaToRgba(
            (hue + depth * 0.1) % 1, 
            saturation, 
            brightness, 
            0.7
        );
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // Calculate parameters for sub-branches
        const newSize = size * 0.67;
        const branches = Math.floor(this.mapParam(this.params.density, 2, 5));
        
        // Draw sub-branches
        for (let i = 0; i < branches; i++) {
            const branchAngle = angle + 
                (Math.PI * 2 / branches * i) + 
                this.time * this.params.speed * (0.1 + depth * 0.05);
            
            this.drawFractalBranch(
                endX, 
                endY, 
                newSize, 
                branchAngle, 
                depth - 1, 
                hue, 
                saturation, 
                brightness
            );
        }
    }
    
    /**
     * Initialize audio input for audio reactive visualizations
     * @param {number} bufferSize - FFT size for audio analysis (256, 512, 1024, 2048)
     * @param {string} deviceId - Optional audio device ID to use for input
     */
    initAudio(bufferSize = 512, deviceId = null) {
        if (this.audioData.initialized) return;
        
        // Store the settings for later reference
        this.audioData.bufferSize = bufferSize || 512;
        this.audioData.deviceId = deviceId;
        
        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            
            // Create analyzer with specified FFT size
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = this.audioData.bufferSize;
            
            // Set up data arrays for both frequency and time domain
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const timeDomainArray = new Uint8Array(analyser.fftSize);
            
            // Store in our audio data object
            this.audioData.analyser = analyser;
            this.audioData.dataArray = dataArray;
            this.audioData.timeDomainArray = timeDomainArray;
            this.audioData.audioContext = audioContext;
            
            // Set up constraints with device ID if specified
            const constraints = { 
                audio: deviceId ? { deviceId: { exact: deviceId } } : true,
                video: false 
            };
            
            // Try to connect to user microphone with specified device (if any)
            navigator.mediaDevices.getUserMedia(constraints)
                .then(stream => {
                    this.connectAudioStream(stream, audioContext, analyser);
                })
                .catch(err => {
                    console.warn(`Error initializing audio input ${deviceId ? 'with specified device' : ''}:`, err);
                    
                    // If a specific device was requested but failed, try again with default device
                    if (deviceId) {
                        console.log('Trying again with default audio device...');
                        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                            .then(stream => {
                                this.connectAudioStream(stream, audioContext, analyser);
                            })
                            .catch(fallbackErr => {
                                console.error('Error initializing audio with default device:', fallbackErr);
                                this.initializeSyntheticAudio();
                            });
                    } else {
                        this.initializeSyntheticAudio();
                    }
                });
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
            this.audioData.initialized = true; // Mark as initialized to prevent further attempts
            this.audioData.liveAudioConnected = false;
        }
        
        // Add a method to request audio context resume on user interaction
        document.addEventListener('click', () => {
            if (this.audioData.audioContext && this.audioData.audioContext.state !== 'running') {
                this.audioData.audioContext.resume();
                console.log('Audio context resumed on user interaction');
            }
        }, { once: true });
    }
    
    /**
     * Connect audio stream to analyzer
     */
    connectAudioStream(stream, audioContext, analyser) {
        // Connect the microphone to the analyzer
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        // Store the stream and source for later reference
        this.audioData.stream = stream;
        this.audioData.micSource = source;
        
        // Ensure audio context is running
        if (audioContext.state !== 'running') {
            audioContext.resume().then(() => {
                console.log('Audio context resumed');
            });
        }
        
        console.log('Live audio input connected successfully');
        this.audioData.initialized = true;
        this.audioData.liveAudioConnected = true;
        
        // Log info about the audio tracks
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
            console.log('Using audio device:', audioTracks[0].label);
        }
    }
    
    /**
     * Initialize synthetic audio data when no microphone is available
     */
    initializeSyntheticAudio() {
        // Mark as initialized but without live audio
        this.audioData.initialized = true;
        this.audioData.liveAudioConnected = false;
        
        // Generate synthetic data for testing
        this.startSyntheticAudioGeneration();
    }
    
    /**
     * Reinitialize audio with new settings
     * @param {number} bufferSize - FFT size for audio analysis
     * @param {string} deviceId - Optional audio device ID
     */
    reinitializeAudio(bufferSize = 512, deviceId = null) {
        console.log(`Reinitializing audio with buffer size ${bufferSize}, device ID: ${deviceId || 'default'}`);
        
        // Clean up existing audio resources
        this.cleanupAudio();
        
        // Reset initialization flag
        this.audioData.initialized = false;
        
        // Initialize with new settings
        this.initAudio(bufferSize, deviceId);
    }
    
    /**
     * Clean up audio resources
     */
    cleanupAudio() {
        // Stop any existing audio stream
        if (this.audioData.stream) {
            this.audioData.stream.getTracks().forEach(track => track.stop());
        }
        
        // Disconnect audio source if it exists
        if (this.audioData.micSource) {
            this.audioData.micSource.disconnect();
        }
        
        // Close audio context if it exists
        if (this.audioData.audioContext) {
            this.audioData.audioContext.close().catch(err => {
                console.warn('Error closing audio context:', err);
            });
        }
        
        console.log('Audio resources cleaned up');
    }
    
    /**
     * Generate synthetic audio data for testing when live audio is unavailable
     */
    startSyntheticAudioGeneration() {
        if (!this.audioData.analyser) return;
        
        const bufferLength = this.audioData.dataArray.length;
        const timeDomainLength = this.audioData.timeDomainArray ? this.audioData.timeDomainArray.length : 0;
        
        console.log('Starting synthetic audio data generation');
        
        // Generate both frequency and time domain data
        setInterval(() => {
            // Update frequency data
            for (let i = 0; i < bufferLength; i++) {
                // Create frequency distribution resembling music
                const baseFactor = 1 - (i / bufferLength); 
                const randomFactor = Math.random() * 0.4;
                const beatFactor = (Math.sin(this.time * 2) > 0.7) ? 0.8 : 0.2;
                
                this.audioData.dataArray[i] = Math.floor((baseFactor * 0.6 + randomFactor + beatFactor * 0.4) * 255);
            }
            
            // Generate waveform data for oscilloscope
            if (this.audioData.timeDomainArray && timeDomainLength > 0) {
                const time = this.time;
                
                // Generate a mix of sine waves to simulate an interesting waveform
                for (let i = 0; i < timeDomainLength; i++) {
                    const phase = (i / timeDomainLength) * Math.PI * 2;
                    
                    // Create a waveform with multiple harmonics
                    const value = 
                        Math.sin(phase * 1 + time) * 0.5 +
                        Math.sin(phase * 2 + time * 0.5) * 0.3 +
                        Math.sin(phase * 4 + time * 0.25) * 0.15;
                    
                    // Convert to 0-255 range (128 is center/silence)
                    this.audioData.timeDomainArray[i] = Math.floor((value * 0.7 + 1) * 128);
                }
            }
        }, 16); // 60fps update rate
    }
    
    /**
     * Update audio data and calculate values needed for visualization
     */
    updateAudioData() {
        if (!this.audioData.initialized) {
            this.initAudio();
            return false;
        }
        
        if (this.audioData.analyser) {
            // Get frequency data for general visualizations
            this.audioData.analyser.getByteFrequencyData(this.audioData.dataArray);
            
            // Get time domain data specifically for oscilloscope
            if (this.audioData.timeDomainArray) {
                this.audioData.analyser.getByteTimeDomainData(this.audioData.timeDomainArray);
            }
        }
        
        // Process the frequency data and smooth it
        const bufferLength = this.audioData.dataArray ? this.audioData.dataArray.length : 128;
        const smoothingFactor = 0.2; // How quickly values change (0-1)
        
        let totalAmplitude = 0;
        let maxValue = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            // Get current value (or generate fake data if we don't have real data)
            const value = this.audioData.dataArray ? 
                this.audioData.dataArray[i] / 255 : 
                // Fake data pattern if no audio
                (1 - (i / bufferLength)) * (0.5 + 0.5 * Math.sin(this.time * 3 + i * 0.2));
            
            // Smooth the values
            this.audioData.smoothedValues[i] = this.audioData.smoothedValues[i] * (1 - smoothingFactor) + 
                value * smoothingFactor;
            
            // Calculate stats
            totalAmplitude += this.audioData.smoothedValues[i];
            maxValue = Math.max(maxValue, this.audioData.smoothedValues[i]);
        }
        
        // Calculate average amplitude
        const averageAmplitude = totalAmplitude / bufferLength;
        
        // Smooth the peak level for better dynamics
        this.audioData.peakLevel = this.audioData.peakLevel * 0.95 + maxValue * 0.05;
        
        return true;
    }
    
    /**
     * Get audio frequency bin value (0-1 range)
     * @param {number} index - Frequency bin index (0-127)
     */
    getAudioBin(index) {
        if (!this.audioData.smoothedValues) return 0;
        
        // Clamp index to valid range
        const i = Math.min(Math.max(0, Math.floor(index)), this.audioData.smoothedValues.length - 1);
        return this.audioData.smoothedValues[i] || 0;
    }
    
    /**
     * Get audio frequency band average value (0-1 range)
     * @param {number} startBin - Start frequency bin
     * @param {number} endBin - End frequency bin
     */
    getAudioBand(startBin, endBin) {
        if (!this.audioData.smoothedValues) return 0;
        
        // Clamp to valid range
        const start = Math.min(Math.max(0, Math.floor(startBin)), this.audioData.smoothedValues.length - 1);
        const end = Math.min(Math.max(start, Math.floor(endBin)), this.audioData.smoothedValues.length - 1);
        
        let sum = 0;
        for (let i = start; i <= end; i++) {
            sum += this.audioData.smoothedValues[i] || 0;
        }
        
        return sum / (end - start + 1);
    }
    
    /**
     * Render audio reactive visualization
     */
    renderAudioReactive() {
        // Make sure audio is initialized
        this.updateAudioData();
        
        // Extract parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const complexity = this.mapParam(this.params.complexity, 4, 64); // Number of segments
        const speed = this.mapParam(this.params.speed, 0.2, 2);
        
        // Clear with subtle gradient background
        this.ctx.save();
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, this.height
        );
        gradient.addColorStop(0, this.hsbaToRgba(hue, saturation * 0.2, brightness * 0.2, 1));
        gradient.addColorStop(1, this.hsbaToRgba((hue + 0.5) % 1, saturation * 0.1, brightness * 0.1, 1));
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw the circular audio spectrum
        this.ctx.translate(this.centerX, this.centerY);
        
        // Get low, mid, high band values for visual effects
        const bassValue = this.getAudioBand(0, 8);
        const midValue = this.getAudioBand(8, 32);
        const highValue = this.getAudioBand(32, 64);
        
        // Dynamic radius based on bass
        const baseRadius = Math.min(this.width, this.height) * 0.3;
        const dynamicRadius = baseRadius * (1 + bassValue * 0.3);
        
        // Rotation affected by mid-frequencies
        const rotation = this.time * speed * 0.2 + midValue * 2;
        
        // Draw frequency bars in a circle
        const segments = Math.floor(complexity);
        const segmentAngle = (Math.PI * 2) / segments;
        
        for (let i = 0; i < segments; i++) {
            // Calculate segment angle
            const angle = i * segmentAngle + rotation;
            
            // Get audio value for this segment 
            // Map the segment index to the full audio range
            const freqIndex = Math.floor((i / segments) * (this.audioData.smoothedValues.length - 1));
            const audioValue = this.getAudioBin(freqIndex);
            
            // Bar height based on audio value
            const barHeight = audioValue * this.mapParam(this.params.size, 50, 200);
            const innerRadius = dynamicRadius;
            const outerRadius = innerRadius + barHeight;
            
            // Vary color based on frequency and parameters
            const segmentHue = (hue + (i / segments) * this.mapParam(this.params.complexity, 0.1, 0.5)) % 1;
            
            // Calculate points for bar corners
            const innerX = Math.cos(angle) * innerRadius;
            const innerY = Math.sin(angle) * innerRadius;
            const outerX = Math.cos(angle) * outerRadius;
            const outerY = Math.sin(angle) * outerRadius;
            const innerX2 = Math.cos(angle + segmentAngle * 0.8) * innerRadius;
            const innerY2 = Math.sin(angle + segmentAngle * 0.8) * innerRadius;
            const outerX2 = Math.cos(angle + segmentAngle * 0.8) * outerRadius;
            const outerY2 = Math.sin(angle + segmentAngle * 0.8) * outerRadius;
            
            // Draw the bar as a quadrilateral
            this.ctx.beginPath();
            this.ctx.moveTo(innerX, innerY);
            this.ctx.lineTo(outerX, outerY);
            this.ctx.lineTo(outerX2, outerY2);
            this.ctx.lineTo(innerX2, innerY2);
            this.ctx.closePath();
            
            // Fill with gradient
            const barGradient = this.ctx.createLinearGradient(innerX, innerY, outerX, outerY);
            barGradient.addColorStop(0, this.hsbaToRgba(segmentHue, saturation * 0.7, brightness * 0.5, 0.8));
            barGradient.addColorStop(1, this.hsbaToRgba(segmentHue, saturation, brightness, 0.9));
            this.ctx.fillStyle = barGradient;
            this.ctx.fill();
        }
        
        // Add center circle that pulses with bass
        const centerSize = baseRadius * 0.2 * (1 + bassValue * 2);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, centerSize, 0, Math.PI * 2);
        this.ctx.fillStyle = this.hsbaToRgba(hue, saturation, brightness, 0.7);
        this.ctx.fill();
        
        // Add glow effect for high frequencies
        if (highValue > 0.4) {
            const glowSize = baseRadius * 0.8 * highValue;
            const glowGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
            glowGradient.addColorStop(0, this.hsbaToRgba(hue, saturation * 0.5, brightness, 0.5));
            glowGradient.addColorStop(1, this.hsbaToRgba(hue, saturation * 0.5, brightness, 0));
            this.ctx.beginPath();
            this.ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
            this.ctx.fillStyle = glowGradient;
            this.ctx.fill();
        }
        
        // Add connecting lines between segments for complex effect
        if (this.params.complexity > 0.6) {
            this.ctx.strokeStyle = this.hsbaToRgba(hue, saturation * 0.7, brightness, 0.15);
            this.ctx.lineWidth = 1;
            
            for (let i = 0; i < segments; i += 2) {
                const angle1 = i * segmentAngle + rotation;
                const audioValue1 = this.getAudioBin(Math.floor((i / segments) * 127));
                const outerRadius1 = dynamicRadius + audioValue1 * this.mapParam(this.params.size, 50, 200);
                const x1 = Math.cos(angle1) * outerRadius1;
                const y1 = Math.sin(angle1) * outerRadius1;
                
                for (let j = 0; j < segments; j += 4) {
                    if (i !== j) {
                        const angle2 = j * segmentAngle + rotation;
                        const audioValue2 = this.getAudioBin(Math.floor((j / segments) * 127));
                        const outerRadius2 = dynamicRadius + audioValue2 * this.mapParam(this.params.size, 50, 200);
                        const x2 = Math.cos(angle2) * outerRadius2;
                        const y2 = Math.sin(angle2) * outerRadius2;
                        
                        this.ctx.beginPath();
                        this.ctx.moveTo(x1, y1);
                        this.ctx.lineTo(x2, y2);
                        this.ctx.stroke();
                    }
                }
            }
        }
        
        this.ctx.restore();
    }
    
    /**
     * Render fluid dynamics simulation
     */
    renderFluidDynamics() {
        // Initialize particles if needed
        if (this.fluidSimulation.particles.length === 0) {
            this.initFluidParticles();
        }
        
        // Extract parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const speed = this.mapParam(this.params.speed, 0.2, 2);
        const complexity = this.mapParam(this.params.complexity, 0.1, 2);
        const size = this.mapParam(this.params.size, 1, 5);
        
        // Create dark background with subtle gradient
        this.ctx.save();
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, this.hsbaToRgba((hue + 0.1) % 1, saturation * 0.2, brightness * 0.1, 1));
        gradient.addColorStop(1, this.hsbaToRgba((hue + 0.2) % 1, saturation * 0.2, brightness * 0.05, 1));
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Update and draw fluid simulation
        this.updateFluidSimulation(speed, complexity);
        this.drawFluidParticles(hue, saturation, brightness, size);
        
        this.ctx.restore();
    }
    
    /**
     * Initialize particles for fluid simulation
     */
    initFluidParticles() {
        const count = this.fluidSimulation.particleCount;
        this.fluidSimulation.particles = [];
        
        for (let i = 0; i < count; i++) {
            this.fluidSimulation.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: 0,
                vy: 0,
                age: Math.random() * 100,
                lifespan: 100 + Math.random() * 100
            });
        }
    }
    
    /**
     * Update fluid simulation
     */
    updateFluidSimulation(speed, complexity) {
        // Grid dimensions
        const gridSize = 50;
        const cellWidth = this.width / gridSize;
        const cellHeight = this.height / gridSize;
        
        // Reset velocity field occasionally to prevent stagnation
        if (Math.random() < 0.01) {
            this.fluidSimulation.velocityField = this.fluidSimulation.velocityField.map(() => ({ x: 0, y: 0 }));
        }
        
        // Update velocity field with noise
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const index = y * gridSize + x;
                
                // Use noise to create swirling motions
                const angle = this.noise(
                    x * 0.05 * complexity, 
                    y * 0.05 * complexity, 
                    this.time * 0.1 * speed
                ) * Math.PI * 4;
                
                // Calculate field forces
                const force = 0.5 * (1 + Math.sin(this.time * speed + (x + y) * 0.1));
                
                // Apply forces to velocity field with some damping
                this.fluidSimulation.velocityField[index] = {
                    x: this.fluidSimulation.velocityField[index].x * 0.9 + Math.cos(angle) * force * 0.1,
                    y: this.fluidSimulation.velocityField[index].y * 0.9 + Math.sin(angle) * force * 0.1
                };
            }
        }
        
        // Update particles based on velocity field
        this.fluidSimulation.particles.forEach((particle, i) => {
            // Find grid cell for this particle
            const cellX = Math.min(gridSize - 1, Math.floor(particle.x / cellWidth));
            const cellY = Math.min(gridSize - 1, Math.floor(particle.y / cellHeight));
            const cellIndex = cellY * gridSize + cellX;
            
            // Get velocity at this point
            const velocity = this.fluidSimulation.velocityField[cellIndex];
            
            // Apply velocity to particle
            particle.vx = particle.vx * 0.95 + velocity.x * 2 * speed;
            particle.vy = particle.vy * 0.95 + velocity.y * 2 * speed;
            
            // Move particle
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Age the particle
            particle.age += 0.5 * speed;
            
            // Respawn if too old or out of bounds
            if (particle.age > particle.lifespan || 
                particle.x < 0 || particle.x > this.width || 
                particle.y < 0 || particle.y > this.height) {
                
                // Respawn at a random edge
                const edge = Math.floor(Math.random() * 4);
                switch (edge) {
                    case 0: // Top
                        particle.x = Math.random() * this.width;
                        particle.y = 0;
                        break;
                    case 1: // Right
                        particle.x = this.width;
                        particle.y = Math.random() * this.height;
                        break;
                    case 2: // Bottom
                        particle.x = Math.random() * this.width;
                        particle.y = this.height;
                        break;
                    case 3: // Left
                        particle.x = 0;
                        particle.y = Math.random() * this.height;
                        break;
                }
                
                particle.vx = 0;
                particle.vy = 0;
                particle.age = 0;
                particle.lifespan = 100 + Math.random() * 100;
            }
        });
    }
    
    /**
     * Draw fluid particles
     */
    drawFluidParticles(hue, saturation, brightness, size) {
        // Draw connections first (behind particles)
        if (this.params.complexity > 0.4) {
            this.ctx.strokeStyle = this.hsbaToRgba(hue, saturation * 0.5, brightness * 0.6, 0.1);
            this.ctx.lineWidth = 0.5;
            
            const connectionDistance = 80 * this.params.density;
            
            for (let i = 0; i < this.fluidSimulation.particles.length; i++) {
                const p1 = this.fluidSimulation.particles[i];
                
                // Skip randomly to reduce number of connections
                if (Math.random() > 0.3) continue;
                
                for (let j = i + 1; j < this.fluidSimulation.particles.length; j++) {
                    const p2 = this.fluidSimulation.particles[j];
                    
                    // Calculate distance
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Draw connection if close enough
                    if (distance < connectionDistance) {
                        // Opacity based on distance
                        const opacity = 0.2 * (1 - distance / connectionDistance);
                        this.ctx.strokeStyle = this.hsbaToRgba(
                            (hue + distance * 0.001) % 1, 
                            saturation * 0.5, 
                            brightness * 0.5, 
                            opacity
                        );
                        
                        this.ctx.beginPath();
                        this.ctx.moveTo(p1.x, p1.y);
                        this.ctx.lineTo(p2.x, p2.y);
                        this.ctx.stroke();
                    }
                }
            }
        }
        
        // Draw particles
        this.fluidSimulation.particles.forEach(particle => {
            // Calculate particle opacity and size based on age
            const lifeProgress = particle.age / particle.lifespan;
            const opacity = lifeProgress < 0.2 ? 
                lifeProgress * 5 : 
                1 - (lifeProgress - 0.2) / 0.8;
            
            // Calculate particle color based on position and velocity
            const particleHue = (hue + 
                (particle.x / this.width) * 0.2 + 
                (particle.y / this.height) * 0.1 + 
                Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy) * 0.1
            ) % 1;
            
            // Draw glow effect
            const glowRadius = size * 2 * (1 - lifeProgress * 0.5);
            const gradient = this.ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, glowRadius
            );
            
            gradient.addColorStop(0, this.hsbaToRgba(particleHue, saturation, brightness, opacity * 0.8));
            gradient.addColorStop(1, this.hsbaToRgba(particleHue, saturation * 0.8, brightness * 0.5, 0));
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, glowRadius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw particle core
            this.ctx.fillStyle = this.hsbaToRgba(particleHue, saturation, brightness, opacity);
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, size * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    /**
     * Render neon grid visualization
     */
    renderNeonGrid() {
        // Parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const gridSize = Math.floor(this.mapParam(this.params.density, 5, 30)); // Number of cells
        const speed = this.mapParam(this.params.speed, 0.2, 2);
        const lineWidth = this.mapParam(this.params.size, 1, 5);
        const perspective = this.mapParam(this.params.complexity, 0.2, 0.8); // Perspective effect strength
        
        // Create background
        this.ctx.save();
        this.ctx.fillStyle = this.hsbaToRgba(0, 0, 0.05, 1); // Near black
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Center and apply perspective
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.scale(1, perspective); // Create perspective effect
        
        // Draw 3D grid with animation
        const maxDistance = Math.sqrt(this.width * this.width + this.height * this.height) * 0.7;
        const cellSize = maxDistance / gridSize;
        
        // Rotate based on time
        const rotation = this.time * 0.1 * speed;
        this.ctx.rotate(rotation * this.params.rotation);
        
        // Draw horizontal lines
        for (let y = -gridSize; y <= gridSize; y++) {
            // Calculate line attributes based on time
            const yPos = y * cellSize;
            const waveOffset = Math.sin(this.time * speed + y * 0.1) * cellSize * 0.2;
            
            // Calculate line color (vary based on position)
            const lineHue = (hue + y * 0.02) % 1;
            
            // Draw line with glow effect
            this.ctx.strokeStyle = this.hsbaToRgba(lineHue, saturation, brightness, 0.7);
            this.ctx.lineWidth = lineWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(-maxDistance, yPos + waveOffset);
            this.ctx.lineTo(maxDistance, yPos - waveOffset);
            this.ctx.stroke();
            
            // Add glow effect
            this.ctx.strokeStyle = this.hsbaToRgba(lineHue, saturation * 0.8, brightness, 0.3);
            this.ctx.lineWidth = lineWidth * 3;
            this.ctx.beginPath();
            this.ctx.moveTo(-maxDistance, yPos + waveOffset);
            this.ctx.lineTo(maxDistance, yPos - waveOffset);
            this.ctx.stroke();
        }
        
        // Draw vertical lines
        for (let x = -gridSize; x <= gridSize; x++) {
            // Calculate line attributes
            const xPos = x * cellSize;
            const waveOffset = Math.sin(this.time * speed + x * 0.1) * cellSize * 0.2;
            
            // Calculate line color (vary based on position)
            const lineHue = (hue + 0.5 + x * 0.02) % 1; // Complementary color
            
            // Draw line with glow effect
            this.ctx.strokeStyle = this.hsbaToRgba(lineHue, saturation, brightness, 0.7);
            this.ctx.lineWidth = lineWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(xPos + waveOffset, -maxDistance);
            this.ctx.lineTo(xPos - waveOffset, maxDistance);
            this.ctx.stroke();
            
            // Add glow effect
            this.ctx.strokeStyle = this.hsbaToRgba(lineHue, saturation * 0.8, brightness, 0.3);
            this.ctx.lineWidth = lineWidth * 3;
            this.ctx.beginPath();
            this.ctx.moveTo(xPos + waveOffset, -maxDistance);
            this.ctx.lineTo(xPos - waveOffset, maxDistance);
            this.ctx.stroke();
        }
        
        // Draw additional effects if complexity is high
        if (this.params.complexity > 0.5) {
            // Draw animated circles at line intersections
            for (let y = -gridSize; y <= gridSize; y += 2) {
                for (let x = -gridSize; x <= gridSize; x += 2) {
                    const xPos = x * cellSize;
                    const yPos = y * cellSize;
                    
                    // Vary size with time
                    const pulseFactor = 0.5 + 0.5 * Math.sin(this.time * speed * 2 + x * 0.1 + y * 0.1);
                    const circleSize = lineWidth * 2 * pulseFactor;
                    
                    // Vary color with position
                    const circleHue = (hue + (x + y) * 0.01) % 1;
                    
                    // Draw circle
                    this.ctx.fillStyle = this.hsbaToRgba(circleHue, saturation, brightness, 0.8);
                    this.ctx.beginPath();
                    this.ctx.arc(xPos, yPos, circleSize, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Add glow effect
                    const glowGradient = this.ctx.createRadialGradient(
                        xPos, yPos, 0,
                        xPos, yPos, circleSize * 3
                    );
                    glowGradient.addColorStop(0, this.hsbaToRgba(circleHue, saturation, brightness, 0.3));
                    glowGradient.addColorStop(1, this.hsbaToRgba(circleHue, saturation, brightness, 0));
                    
                    this.ctx.fillStyle = glowGradient;
                    this.ctx.beginPath();
                    this.ctx.arc(xPos, yPos, circleSize * 3, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
        
        this.ctx.restore();
    }
    
    /**
     * Render galaxies visualization
     */
    renderGalaxies() {
        // Parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const starCount = Math.floor(this.mapParam(this.params.density, 500, 5000));
        const galaxySize = this.mapParam(this.params.size, 0.5, 2);
        const galaxies = Math.floor(this.mapParam(this.params.complexity, 1, 5));
        const speed = this.mapParam(this.params.speed, 0.2, 2);
        
        // Create space background
        this.ctx.save();
        
        // Fill with gradient
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, Math.max(this.width, this.height)
        );
        gradient.addColorStop(0, this.hsbaToRgba(hue, saturation * 0.3, brightness * 0.2, 1));
        gradient.addColorStop(1, this.hsbaToRgba((hue + 0.5) % 1, saturation * 0.2, brightness * 0.05, 1));
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Generate deterministic stars as a background
        this.ctx.fillStyle = '#FFF';
        for (let i = 0; i < 200; i++) {
            const x = this.noise(i * 0.1, 0, 0) * this.width;
            const y = this.noise(0, i * 0.1, 0) * this.height;
            const size = this.noise(i * 0.1, i * 0.1, 0) * 2 + 0.5;
            
            // Twinkle effect
            const twinkle = 0.5 + 0.5 * Math.sin(this.time * 2 + i);
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size * twinkle, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw each galaxy
        for (let g = 0; g < galaxies; g++) {
            // Calculate galaxy center
            const galaxyAngle = (g / galaxies) * Math.PI * 2 + this.time * 0.05 * speed;
            const distance = this.width * 0.25 * (g % 2 === 0 ? 1 : 0.6);
            const galaxyX = this.centerX + Math.cos(galaxyAngle) * distance;
            const galaxyY = this.centerY + Math.sin(galaxyAngle) * distance;
            
            // Galaxy color varies by index
            const galaxyHue = (hue + g * (1 / galaxies)) % 1;
            
            // Draw galaxy stars
            const starsPerGalaxy = Math.floor(starCount / galaxies);
            const rotationSpeed = 0.05 * speed * (g % 2 === 0 ? 1 : -1);
            const galaxyRotation = this.time * rotationSpeed;
            const spiralFactor = 2 + g % 3;
            
            // Calculate galaxy radius based on size parameter
            const radius = Math.min(this.width, this.height) * 0.2 * galaxySize;
            
            // Draw each star in the galaxy
            for (let i = 0; i < starsPerGalaxy; i++) {
                // Deterministic star placement based on index
                const angle = (i / starsPerGalaxy) * Math.PI * spiralFactor * 2 + galaxyRotation;
                const radiusFactor = Math.pow(i / starsPerGalaxy, 0.5); // Distribution favors center
                const starDistance = radius * radiusFactor;
                
                // Calculate star position with spiral movement
                const spiralOffset = angle * 0.1;
                const x = galaxyX + Math.cos(angle + spiralOffset) * starDistance;
                const y = galaxyY + Math.sin(angle + spiralOffset) * starDistance;
                
                // Skip stars that are off screen
                if (x < 0 || x > this.width || y < 0 || y > this.height) continue;
                
                // Star color varies by distance from center
                const starHue = (galaxyHue + radiusFactor * 0.2) % 1;
                const starBrightness = brightness * (0.7 + 0.3 * (1 - radiusFactor));
                
                // Star size varies but gets smaller toward the edges
                const starSize = this.mapParam(this.params.size, 1, 3) * (1 - radiusFactor * 0.7);
                
                // Draw star with glow effect
                if (starDistance > radius * 0.05) { // Skip innermost stars
                    // Draw glow
                    const glowRadius = starSize * 3;
                    const glowGradient = this.ctx.createRadialGradient(
                        x, y, 0,
                        x, y, glowRadius
                    );
                    glowGradient.addColorStop(0, this.hsbaToRgba(starHue, saturation * 0.9, starBrightness, 0.3));
                    glowGradient.addColorStop(1, this.hsbaToRgba(starHue, saturation * 0.7, starBrightness * 0.5, 0));
                    
                    this.ctx.fillStyle = glowGradient;
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Draw star core
                    this.ctx.fillStyle = this.hsbaToRgba(starHue, saturation * 0.5, starBrightness, 0.9);
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, starSize, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            
            // Draw galaxy center (black hole effect)
            const centerGradient = this.ctx.createRadialGradient(
                galaxyX, galaxyY, 0,
                galaxyX, galaxyY, radius * 0.2
            );
            centerGradient.addColorStop(0, this.hsbaToRgba(galaxyHue, saturation, brightness, 0.7));
            centerGradient.addColorStop(0.3, this.hsbaToRgba(galaxyHue, saturation * 0.7, brightness * 0.5, 0.4));
            centerGradient.addColorStop(1, this.hsbaToRgba(galaxyHue, saturation * 0.5, brightness * 0.2, 0));
            
            this.ctx.fillStyle = centerGradient;
            this.ctx.beginPath();
            this.ctx.arc(galaxyX, galaxyY, radius * 0.2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Add lens flare effect if complexity is high
        if (this.params.complexity > 0.7) {
            // Create a lens flare at the center
            const flareGradient = this.ctx.createRadialGradient(
                this.centerX, this.centerY, 0,
                this.centerX, this.centerY, this.width * 0.4
            );
            flareGradient.addColorStop(0, this.hsbaToRgba(hue, saturation * 0.5, brightness, 0.2));
            flareGradient.addColorStop(0.1, this.hsbaToRgba(hue, saturation * 0.3, brightness, 0.1));
            flareGradient.addColorStop(1, this.hsbaToRgba(hue, saturation * 0.2, brightness, 0));
            
            this.ctx.fillStyle = flareGradient;
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, this.width * 0.4, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add some lens flare artifacts
            for (let i = 0; i < 5; i++) {
                const distance = this.width * 0.1 * (i + 1) / 5;
                const angle = this.time * 0.1;
                const x = this.centerX + Math.cos(angle) * distance;
                const y = this.centerY + Math.sin(angle) * distance;
                const size = this.width * 0.03 * (1 - i / 5);
                
                const artifactGradient = this.ctx.createRadialGradient(
                    x, y, 0,
                    x, y, size
                );
                artifactGradient.addColorStop(0, this.hsbaToRgba((hue + 0.5) % 1, saturation * 0.5, brightness, 0.2));
                artifactGradient.addColorStop(1, this.hsbaToRgba((hue + 0.5) % 1, saturation * 0.3, brightness, 0));
                
                this.ctx.fillStyle = artifactGradient;
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        this.ctx.restore();
    }
    
    /**
     * Initialize state for various visualization algorithms
     * This is called after all methods are defined to avoid binding issues
     */
    initializeVisualizationState() {
        // Initialize fluid simulation state
        this.fluidSimulation = {
            particles: [],
            particleCount: 300,
            velocityField: new Array(50 * 50).fill().map(() => ({ x: 0, y: 0 })),
            densityField: new Array(50 * 50).fill(0)
        };
        
        // Initialize audio data
        this.audioData = {
            analyser: null,
            dataArray: null,
            timeDomainArray: null,
            audioContext: null,
            stream: null,
            micSource: null,
            smoothedValues: Array(128).fill(0),
            peakLevel: 0.1,
            bufferSize: 512, // Default buffer size
            deviceId: null,  // Default to system default audio input
            initialized: false,
            liveAudioConnected: false
        };
        
        // Oscilloscope persistence buffers for phosphor effect
        this.oscilloscopeBuffers = {
            initialized: false,
            persistenceCanvas: null,
            persistenceCtx: null,
            persistence: 0.85, // Phosphor persistence factor (0-1)
            traceHue: 0.33, // Green phosphor
            lastFrameTime: 0,
            traceHistory: [], // Store previous trace points for ghosting
            historyLength: 3 // Number of previous frames to keep
        };
        
        // Map of visual names to their index for program change
        this.visualIndexMap = {
            'audioReactive': 0,
            'fluidDynamics': 1,
            'galaxies': 2,
            'tentacles': 3,
            'webgl-cubeField': 4,
            'webgl-tunnelEffect': 5,
            'webgl-particleSystem': 6,
            'webgl-trailParticles': 7,
            'webgl-nebulaVortex': 8,
            'webgl-crystalFractals': 9,
            'webgl-oceanWaves': 10,
            'webgl-crtOscilloscope': 11
        };
        
        // Reverse map for looking up by program change number
        this.programChangeMap = {};
        Object.keys(this.visualIndexMap).forEach(name => {
            const index = this.visualIndexMap[name];
            this.programChangeMap[index] = name;
        });
    }
    
    /**
     * Render kaleidoscope visualization
     * Highly responsive to MIDI controls
     */
    renderKaleidoscope() {
        // Parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const segments = Math.floor(this.mapParam(this.params.symmetry, 3, 16)); // Number of mirror segments
        const shapeCount = Math.floor(this.mapParam(this.params.density, 5, 30));
        const size = this.mapParam(this.params.size, 0.1, 0.5);
        const speed = this.mapParam(this.params.speed, 0.2, 2);
        const complexity = this.mapParam(this.params.complexity, 1, 8);
        
        // Calculate the size of the kaleidoscope
        const radius = Math.min(this.width, this.height) * 0.5;
        
        // Save context for transformations
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(this.time * 0.1 * this.mapParam(this.params.rotation, -0.5, 0.5));
        
        // Create clipping mask for circular kaleidoscope
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.clip();
        
        // Draw mirrored segments
        for (let segment = 0; segment < segments; segment++) {
            // Calculate the angle for this segment
            const segmentAngle = (segment / segments) * Math.PI * 2;
            
            this.ctx.save();
            this.ctx.rotate(segmentAngle);
            
            // Draw shapes within this segment
            for (let i = 0; i < shapeCount; i++) {
                // Calculate position using noise and time
                const noiseScale = this.mapParam(this.params.noiseScale, 0.001, 0.01);
                const t = this.time * speed + i * 0.1;
                
                const distance = radius * size * (1 + this.noise(i, t, 0));
                const angle = this.noise(i + 10, t, 1) * Math.PI / segments;
                
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                
                // Vary shape based on noise and complexity
                const shapeType = Math.floor(this.noise(i * 0.1, t * 0.1, 2) * complexity) % 4;
                
                // Vary color for each shape
                const shapeHue = (hue + this.noise(i * 0.05, t * 0.1, 3) * 0.3) % 1;
                const alpha = 0.6 + 0.4 * this.noise(i * 0.2, t * 0.2, 4);
                
                // Set fill style with transparency for layering effect
                this.ctx.fillStyle = this.hsbaToRgba(shapeHue, saturation, brightness, alpha);
                
                // Draw different shape types
                const shapeSize = radius * 0.03 * (0.5 + this.noise(i, t * 0.5, 5));
                
                switch (shapeType) {
                    case 0: // Circle
                        this.ctx.beginPath();
                        this.ctx.arc(x, y, shapeSize, 0, Math.PI * 2);
                        this.ctx.fill();
                        break;
                        
                    case 1: // Square
                        this.ctx.fillRect(x - shapeSize, y - shapeSize, shapeSize * 2, shapeSize * 2);
                        break;
                        
                    case 2: // Triangle
                        this.ctx.beginPath();
                        this.ctx.moveTo(x, y - shapeSize);
                        this.ctx.lineTo(x + shapeSize, y + shapeSize);
                        this.ctx.lineTo(x - shapeSize, y + shapeSize);
                        this.ctx.closePath();
                        this.ctx.fill();
                        break;
                        
                    case 3: // Diamond
                        this.ctx.beginPath();
                        this.ctx.moveTo(x, y - shapeSize);
                        this.ctx.lineTo(x + shapeSize, y);
                        this.ctx.lineTo(x, y + shapeSize);
                        this.ctx.lineTo(x - shapeSize, y);
                        this.ctx.closePath();
                        this.ctx.fill();
                        break;
                }
            }
            
            this.ctx.restore();
        }
        
        // Draw center point with glow
        const centerGlow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.2);
        centerGlow.addColorStop(0, this.hsbaToRgba(hue, saturation, brightness, 0.7));
        centerGlow.addColorStop(1, this.hsbaToRgba(hue, saturation, brightness, 0));
        
        this.ctx.fillStyle = centerGlow;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    /**
     * Render Lissajous curves visualization
     * Very responsive to MIDI controls
     */
    renderLissajous() {
        // Parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const curves = Math.floor(this.mapParam(this.params.density, 3, 15));
        const lineWidth = this.mapParam(this.params.size, 1, 10);
        const zoom = this.mapParam(this.params.zoom, 0.5, 1.5);
        const speed = this.mapParam(this.params.speed, 0.2, 2);
        
        // Calculate the size of the visualization
        const size = Math.min(this.width, this.height) * 0.4 * zoom;
        
        // Save the canvas state
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        
        // Draw each curve
        for (let i = 0; i < curves; i++) {
            // Calculate curve parameters
            const t = this.time * speed * 0.2;
            const progress = i / curves;
            
            // Dynamic frequency ratio creates interesting patterns
            const freqX = 1 + Math.floor(this.mapParam(this.params.complexity, 1, 8) * progress);
            const freqY = 1 + Math.floor(this.mapParam(this.params.complexity, 1, 8) * (1 - progress));
            const phase = t + progress * Math.PI * 2;
            
            // Calculate curve color
            const curveHue = (hue + progress * 0.5) % 1;
            
            // Draw the curve
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.hsbaToRgba(curveHue, saturation, brightness, 0.7);
            this.ctx.lineWidth = lineWidth * (1 - 0.5 * progress);
            
            // Use parametric equations to plot Lissajous curve
            const points = 500;
            for (let j = 0; j <= points; j++) {
                const angle = (j / points) * Math.PI * 2;
                
                const x = Math.sin(angle * freqX + phase) * size;
                const y = Math.sin(angle * freqY) * size;
                
                if (j === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            
            this.ctx.stroke();
            
            // Add glow effect
            this.ctx.strokeStyle = this.hsbaToRgba(curveHue, saturation * 0.8, brightness, 0.3);
            this.ctx.lineWidth = lineWidth * 3 * (1 - 0.5 * progress);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    /**
     * Render Voronoi cell visualization
     */
    renderVoronoi() {
        // Parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const cellCount = Math.floor(this.mapParam(this.params.density, 10, 100));
        const cellSize = this.mapParam(this.params.size, 0.5, 2);
        const speed = this.mapParam(this.params.speed, 0.1, 1);
        
        // Clear background
        this.ctx.save();
        this.ctx.fillStyle = this.hsbaToRgba((hue + 0.5) % 1, saturation * 0.2, brightness * 0.1, 1);
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Generate Voronoi cell points
        const points = [];
        for (let i = 0; i < cellCount; i++) {
            // Use noise to create smooth movement
            const angle = this.noise(i * 0.1, this.time * speed * 0.1, 0) * Math.PI * 2;
            const radius = this.noise(i * 0.1, this.time * speed * 0.1, 1) * this.width * 0.4;
            
            // Calculate position with orbital movement
            const x = this.centerX + Math.cos(angle + this.time * speed * 0.2) * radius;
            const y = this.centerY + Math.sin(angle + this.time * speed * 0.2) * radius;
            
            points.push({ x, y });
        }
        
        // Render Voronoi cells
        for (let y = 0; y < this.height; y += 10) {
            for (let x = 0; x < this.width; x += 10) {
                // Find closest point
                let closestDist = Infinity;
                let closestIndex = 0;
                let secondClosestDist = Infinity;
                
                for (let i = 0; i < points.length; i++) {
                    const dist = Math.hypot(points[i].x - x, points[i].y - y);
                    
                    if (dist < closestDist) {
                        secondClosestDist = closestDist;
                        closestDist = dist;
                        closestIndex = i;
                    } else if (dist < secondClosestDist) {
                        secondClosestDist = dist;
                    }
                }
                
                // Calculate color based on distance and point index
                const cellHue = (hue + closestIndex * 0.02) % 1;
                const distRatio = closestDist / secondClosestDist;
                const alpha = 0.5 + 0.5 * (1 - distRatio);
                
                // Draw cell
                this.ctx.fillStyle = this.hsbaToRgba(cellHue, saturation, brightness, alpha);
                this.ctx.fillRect(x, y, 10, 10);
                
                // Draw cell borders if complexity is high
                if (this.params.complexity > 0.7 && distRatio > 0.9) {
                    this.ctx.fillStyle = this.hsbaToRgba(cellHue, saturation * 0.5, brightness * 1.5, 0.8);
                    this.ctx.fillRect(x, y, 10, 10);
                }
            }
        }
        
        this.ctx.restore();
    }
    
    /**
     * Render flowing tentacle/ribbon effect
     */
    renderTentacles() {
        // Parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const tentacleCount = Math.floor(this.mapParam(this.params.density, 3, 20));
        const thickness = this.mapParam(this.params.size, 1, 20);
        const speed = this.mapParam(this.params.speed, 0.1, 1);
        const waviness = this.mapParam(this.params.complexity, 1, 10);
        
        // Clear with gradient background
        this.ctx.save();
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, this.width
        );
        gradient.addColorStop(0, this.hsbaToRgba(hue, saturation * 0.2, brightness * 0.2, 1));
        gradient.addColorStop(1, this.hsbaToRgba((hue + 0.1) % 1, saturation * 0.1, brightness * 0.1, 1));
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw each tentacle
        for (let i = 0; i < tentacleCount; i++) {
            const tentacleHue = (hue + i / tentacleCount) % 1;
            const startAngle = (i / tentacleCount) * Math.PI * 2 + this.time * speed * 0.2;
            const length = Math.min(this.width, this.height) * 0.9;
            
            // Generate the tentacle path
            this.ctx.beginPath();
            
            // Start at center
            this.ctx.moveTo(this.centerX, this.centerY);
            
            // Create control points for the curve
            const points = 100;
            for (let j = 0; j <= points; j++) {
                const t = j / points;
                const dist = t * length;
                
                // Base angle changes with distance from center
                const angle = startAngle + t * Math.PI * this.params.rotation * 2;
                
                // Add waviness with noise
                const waveX = Math.sin(t * Math.PI * waviness + this.time * speed) * dist * 0.2;
                const waveY = Math.cos(t * Math.PI * waviness + this.time * speed) * dist * 0.2;
                
                // Calculate position
                const x = this.centerX + Math.cos(angle) * dist + waveX;
                const y = this.centerY + Math.sin(angle) * dist + waveY;
                
                if (j === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            
            // Style based on parameters
            this.ctx.strokeStyle = this.hsbaToRgba(tentacleHue, saturation, brightness, 0.7);
            this.ctx.lineWidth = thickness * (1 - i / tentacleCount / 2); // Thinner as index increases
            this.ctx.stroke();
            
            // Add glow
            this.ctx.shadowColor = this.hsbaToRgba(tentacleHue, saturation, brightness, 0.5);
            this.ctx.shadowBlur = thickness * 2;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        this.ctx.restore();
    }
    
    /**
     * Render circuit board pattern
     */
    renderCircuitBoard() {
        // Parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const nodeCount = Math.floor(this.mapParam(this.params.density, 10, 100));
        const nodeSize = this.mapParam(this.params.size, 2, 15);
        const lineWidth = this.mapParam(this.params.size, 1, 5);
        const complexity = this.mapParam(this.params.complexity, 0.1, 1);
        
        // Background
        this.ctx.save();
        this.ctx.fillStyle = this.hsbaToRgba(hue, saturation * 0.1, brightness * 0.1, 1);
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Generate nodes with noise-based placement
        const nodes = [];
        for (let i = 0; i < nodeCount; i++) {
            const x = this.noise(i * 0.1, 0, this.time * 0.01) * this.width;
            const y = this.noise(0, i * 0.1, this.time * 0.01) * this.height;
            
            // Each node connects to several others
            const connections = [];
            
            nodes.push({ x, y, connections });
        }
        
        // Generate connections between nodes
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const maxConnections = Math.floor(complexity * 5) + 1;
            
            // Find closest nodes to connect to
            const potentialConnections = [];
            
            for (let j = 0; j < nodes.length; j++) {
                if (i === j) continue;
                
                const otherNode = nodes[j];
                const dist = Math.hypot(node.x - otherNode.x, node.y - otherNode.y);
                
                // Only connect to nearby nodes
                if (dist < this.width * 0.2) {
                    potentialConnections.push({ index: j, distance: dist });
                }
            }
            
            // Sort by distance and take closest
            potentialConnections.sort((a, b) => a.distance - b.distance);
            
            // Connect to closest few nodes
            const connectionCount = Math.min(maxConnections, potentialConnections.length);
            
            for (let c = 0; c < connectionCount; c++) {
                const targetIndex = potentialConnections[c].index;
                
                // Avoid duplicate connections
                if (!node.connections.includes(targetIndex)) {
                    node.connections.push(targetIndex);
                }
            }
        }
        
        // Draw connections first (background layer)
        this.ctx.lineWidth = lineWidth;
        
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            
            for (const targetIndex of node.connections) {
                const targetNode = nodes[targetIndex];
                
                // Calculate line color based on position and nodes
                const connectionHue = (hue + (i + targetIndex) * 0.01) % 1;
                
                // Draw line with glow
                this.ctx.strokeStyle = this.hsbaToRgba(connectionHue, saturation * 0.8, brightness * 0.8, 0.8);
                this.ctx.beginPath();
                this.ctx.moveTo(node.x, node.y);
                
                // Add bends to the lines if complexity is high
                if (complexity > 0.6 && Math.random() < 0.5) {
                    // Calculate midpoint
                    const midX = (node.x + targetNode.x) / 2;
                    const midY = (node.y + targetNode.y) / 2;
                    
                    // Add perpendicular offset
                    const dx = targetNode.x - node.x;
                    const dy = targetNode.y - node.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // Perpendicular direction
                    const bendX = -dy / dist * dist * 0.2;
                    const bendY = dx / dist * dist * 0.2;
                    
                    // Add bend point
                    this.ctx.lineTo(midX + bendX, midY + bendY);
                }
                
                this.ctx.lineTo(targetNode.x, targetNode.y);
                this.ctx.stroke();
            }
        }
        
        // Draw nodes on top
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const nodeHue = (hue + i * 0.01) % 1;
            
            // Draw node with glow
            const hasManyConnections = node.connections.length > 3;
            const importantNode = hasManyConnections || Math.random() < 0.2;
            
            // Draw glow for node
            const glowSize = importantNode ? nodeSize * 2 : nodeSize * 1.5;
            const gradient = this.ctx.createRadialGradient(
                node.x, node.y, 0,
                node.x, node.y, glowSize
            );
            gradient.addColorStop(0, this.hsbaToRgba(nodeHue, saturation, brightness, 0.8));
            gradient.addColorStop(1, this.hsbaToRgba(nodeHue, saturation, brightness, 0));
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw node center
            const actualSize = importantNode ? nodeSize : nodeSize * 0.7;
            this.ctx.fillStyle = this.hsbaToRgba(nodeHue, saturation, brightness, 1);
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, actualSize, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw special pattern for important nodes
            if (importantNode) {
                this.ctx.strokeStyle = this.hsbaToRgba(0, 0, 1, 0.5);
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, actualSize * 0.7, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
        
        this.ctx.restore();
    }
    
    /**
     * Render pixel flow field visualization
     */
    renderPixelFlow() {
        // Parameters
        const hue = this.params.hue;
        const saturation = this.params.saturation;
        const brightness = this.params.brightness;
        const particleCount = Math.floor(this.mapParam(this.params.density, 500, 5000));
        const particleSize = this.mapParam(this.params.size, 1, 5);
        const speed = this.mapParam(this.params.speed, 0.1, 2);
        const complexity = this.mapParam(this.params.complexity, 1, 10);
        const rotation = this.params.rotation * Math.PI * 2; // Rotation affects flow direction
        
        // Initialize particles if needed
        if (!this.flowParticles || this.flowParticles.length !== particleCount) {
            this.flowParticles = [];
            for (let i = 0; i < particleCount; i++) {
                this.flowParticles.push({
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    age: Math.random() * 100
                });
            }
        }
        
        // Create a dark background
        this.ctx.save();
        this.ctx.fillStyle = this.hsbaToRgba(hue, saturation * 0.2, brightness * 0.05, 0.1);
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Update and draw particles
        for (let i = 0; i < this.flowParticles.length; i++) {
            const p = this.flowParticles[i];
            
            // Calculate flow field direction at this point
            const noiseScale = 0.005 * complexity;
            const noiseT = this.time * 0.2 * speed;
            
            // Use noise to create smooth flow field
            const angle = this.noise(p.x * noiseScale, p.y * noiseScale, noiseT) * Math.PI * 2 + rotation;
            
            // Update position
            const moveSpeed = speed * 2;
            p.x += Math.cos(angle) * moveSpeed;
            p.y += Math.sin(angle) * moveSpeed;
            
            // Update age
            p.age += 0.5 * speed;
            
            // Reset if out of bounds or too old
            if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height || p.age > 100) {
                p.x = Math.random() * this.width;
                p.y = Math.random() * this.height;
                p.age = 0;
            }
            
            // Calculate color based on position and flow field
            const particleHue = (hue + this.noise(p.x * 0.01, p.y * 0.01, 0) * 0.2) % 1;
            const alpha = 0.8 - p.age / 100 * 0.6;
            
            // Draw particle as a small circle with motion blur
            this.ctx.fillStyle = this.hsbaToRgba(particleHue, saturation, brightness, alpha);
            
            // Create motion blur effect by drawing a small line in direction of movement
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p.x - Math.cos(angle) * particleSize * 2, p.y - Math.sin(angle) * particleSize * 2);
            this.ctx.lineWidth = particleSize;
            this.ctx.strokeStyle = this.hsbaToRgba(particleHue, saturation, brightness, alpha * 0.5);
            this.ctx.stroke();
            
            // Draw particle head
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, particleSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    /**
     * Render a classic green CRT oscilloscope visualization
     * This provides a 2D canvas-based alternative to the WebGL implementation
     */
    renderOscilloscope() {
        // Audio is initialized globally on app startup
        this.updateAudioData();
        
        // Get parameters
        const hue = 0.33; // Fixed green for authentic oscilloscope look
        const saturation = this.mapParam(this.params.saturation, 0.7, 1.0);
        const brightness = this.mapParam(this.params.brightness, 0.6, 1.0);
        const complexity = this.mapParam(this.params.complexity, 1, 8);
        const speed = this.mapParam(this.params.speed, 0.2, 2.0);
        const size = this.mapParam(this.params.size, 0.5, 2.0);
        
        // Initialize oscilloscope buffers if needed
        this.initOscilloscopeBuffers();
        
        // Get time values for animation
        const time = this.time * speed;
        
        // Calculate fade based on time since last frame for consistent fade regardless of framerate
        const now = performance.now();
        const deltaTime = Math.min(100, now - this.oscilloscopeBuffers.lastFrameTime) / 1000;
        this.oscilloscopeBuffers.lastFrameTime = now;
        
        // Adjust persistence dynamically based on the speed parameter
        // Slower speed = longer phosphor persistence
        const phosphorPersistence = 0.80 + ((1.0 - speed) * 0.15);
        this.oscilloscopeBuffers.persistence = phosphorPersistence;
        
        // Apply phosphor fade to the persistence buffer
        this.fadePhosphorBuffer(deltaTime);
        
        // Create X-Y data for oscilloscope
        // This will be different waveforms on X and Y axis to create Lissajous patterns
        let xData = [];
        let yData = [];
        
        // Default point count for visualization
        let pointCount = 256;
        
        // Always use audio data when available
        let useSyntheticData = false;
        
        if (this.audioData.initialized && this.audioData.timeDomainArray) {
            // Use the time domain data directly
            const timeData = this.audioData.timeDomainArray;
            const timeDataLength = timeData.length;
            
            // Calculate audio signal level
            let maxSignal = 0;
            let hasAnySignal = false;
            
            for (let i = 0; i < timeData.length; i += 8) { // Sample every 8th point for performance
                const deviation = Math.abs(timeData[i] - 128);
                maxSignal = Math.max(maxSignal, deviation);
                if (deviation > 0) {
                    hasAnySignal = true;
                }
            }
            
            // Use synthetic data only when absolutely no signal is present
            useSyntheticData = !hasAnySignal;
            
            if (!useSyntheticData) {
                // We have audio input, use real-time waveform for X/Y
                pointCount = Math.min(512, timeDataLength / 2);
                
                // Split the buffer in half for X and Y data
                // This creates a Lissajous pattern from a single audio source
                const halfLength = Math.floor(timeDataLength / 2);
                
                // Find maximum deviation for auto-scaling
                let maxDeviation = 0;
                
                // Sample the data to find the maximum amplitude
                for (let i = 0; i < timeDataLength; i++) {
                    maxDeviation = Math.max(maxDeviation, Math.abs(timeData[i] - 128));
                }
                
                // Calculate scaling factor - ensure we fill the oscilloscope display
                // If max deviation is too small, limit the scaling to avoid amplifying noise
                const scaleFactor = maxDeviation < 3 ? 1.0 : (127 / Math.max(1, maxDeviation));
                
                // Always scale to at least fill 80% of display, but allow for headroom
                const targetScale = Math.max(scaleFactor, 0.8);
                
                for (let i = 0; i < pointCount; i++) {
                    // Map our point index to audio data indices
                    const xIndex = Math.floor(i * halfLength / pointCount);
                    const yIndex = halfLength + Math.floor(i * halfLength / pointCount);
                    
                    // Convert data from 0-255 range to -1.0 to 1.0 range with scaling
                    // 128 is the center/silence value
                    const xRaw = timeData[xIndex] - 128;
                    const yRaw = timeData[yIndex % timeDataLength] - 128;
                    
                    // Apply scaling to fill the display
                    xData[i] = (xRaw * targetScale) / 128.0;
                    yData[i] = (yRaw * targetScale) / 128.0;
                }
                
                // Apply phase rotation for more interesting patterns
                // This simulates a phase difference between channels
                // which is crucial for getting good Lissajous figures
                const phaseOffset = (complexity * 0.1) + (Math.sin(time * 0.1) * 0.05);
                
                // Apply the phase shift to create circular/elliptical patterns
                for (let i = 0; i < pointCount; i++) {
                    const x = xData[i];
                    const y = yData[i];
                    
                    // Rotate the point by the phase offset
                    const cosPhase = Math.cos(phaseOffset);
                    const sinPhase = Math.sin(phaseOffset);
                    
                    // Apply rotation matrix
                    xData[i] = x * cosPhase - y * sinPhase;
                    yData[i] = x * sinPhase + y * cosPhase;
                }
            }
        }
        
        // Use synthetic patterns if needed
        if (useSyntheticData) {
            // Create X and Y data as sine/cosine waves with phase differences
            // This produces classic Lissajous patterns
            
            // Calculate amplitude modulation for breathing effect
            // This makes the synthetic pattern expand and contract naturally
            const baseAmplitude = 0.8 + Math.sin(time * 0.1) * 0.15;
            
            for (let i = 0; i < pointCount; i++) {
                const phase = (i / pointCount) * Math.PI * 8;
                
                // Base frequency ratio determined by complexity parameter
                const frequencyRatio = 1 + (complexity - 1) * 0.125;
                
                // Additional dynamic frequency modulation based on time
                const dynamicRatio = frequencyRatio + Math.sin(time * 0.05) * 0.02;
                
                // X axis: sine wave with one frequency
                xData[i] = Math.sin(phase + time * 0.2) * baseAmplitude;
                
                // Y axis: sine wave with different frequency for Lissajous pattern
                yData[i] = Math.sin(phase * dynamicRatio + time * 0.25) * baseAmplitude;
                
                // Add complexity with harmonics
                // More harmonics = more complex pattern
                const harmonicStrength = complexity * 0.03;
                xData[i] += Math.sin(phase * 3 + time * 0.1) * harmonicStrength * baseAmplitude;
                yData[i] += Math.sin(phase * 5 + time * 0.15) * harmonicStrength * baseAmplitude;
                
                // Add very subtle random noise for authentic look
                xData[i] += (Math.random() - 0.5) * 0.01;
                yData[i] += (Math.random() - 0.5) * 0.01;
            }
        }
        
        // Store current trace data for history
        if (xData.length > 0 && yData.length > 0) {
            // Store a copy of the current data
            this.oscilloscopeBuffers.traceHistory.unshift({
                xData: [...xData],
                yData: [...yData],
                time: now
            });
            
            // Limit history length
            if (this.oscilloscopeBuffers.traceHistory.length > this.oscilloscopeBuffers.historyLength) {
                this.oscilloscopeBuffers.traceHistory.pop();
            }
        }
        
        // Clear main canvas with dark background
        this.ctx.fillStyle = 'rgba(0, 6, 0, 1)'; // Very dark green
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw grid on main canvas
        this.drawOscilloscopeGrid(hue, saturation, brightness);
        
        // Draw previous frames from persistence buffer to main canvas
        this.ctx.drawImage(this.oscilloscopeBuffers.persistenceCanvas, 0, 0);
        
        // Draw the current oscilloscope trace to both main canvas and persistence buffer
        this.drawOscilloscopeTrace(xData, yData, hue, saturation, brightness, size);
        
        // Add CRT effects (scan lines, vignette, etc.)
        this.applyCRTEffects(hue, saturation, brightness);
    }
    
    /**
     * Initialize oscilloscope buffers for phosphor persistence effect
     */
    initOscilloscopeBuffers() {
        // Only initialize once
        if (this.oscilloscopeBuffers.initialized) {
            // Check if canvas dimensions have changed
            if (this.oscilloscopeBuffers.persistenceCanvas.width !== this.width ||
                this.oscilloscopeBuffers.persistenceCanvas.height !== this.height) {
                // Canvas size changed, reinitialize
                this.oscilloscopeBuffers.initialized = false;
            } else {
                return; // Already initialized with correct dimensions
            }
        }
        
        // Create persistence canvas for phosphor trail effect
        const persistenceCanvas = document.createElement('canvas');
        persistenceCanvas.width = this.width;
        persistenceCanvas.height = this.height;
        const persistenceCtx = persistenceCanvas.getContext('2d');
        
        // Clear the persistence canvas
        persistenceCtx.fillStyle = 'rgba(0, 0, 0, 1)';
        persistenceCtx.fillRect(0, 0, this.width, this.height);
        
        // Store in our buffers object
        this.oscilloscopeBuffers.persistenceCanvas = persistenceCanvas;
        this.oscilloscopeBuffers.persistenceCtx = persistenceCtx;
        this.oscilloscopeBuffers.lastFrameTime = performance.now();
        this.oscilloscopeBuffers.initialized = true;
        
        // Reset trace history
        this.oscilloscopeBuffers.traceHistory = [];
    }
    
    /**
     * Apply phosphor fade to the persistence buffer
     */
    fadePhosphorBuffer(deltaTime) {
        if (!this.oscilloscopeBuffers.initialized) return;
        
        const ctx = this.oscilloscopeBuffers.persistenceCtx;
        
        // Calculate fade amount based on deltaTime and persistence factor
        // This makes the fade consistent regardless of framerate
        const fadeSpeed = 1.0 - this.oscilloscopeBuffers.persistence;
        const fadeAmount = 1.0 - Math.pow(this.oscilloscopeBuffers.persistence, deltaTime * 30);
        
        // Apply fade by drawing a semi-transparent black rectangle
        ctx.fillStyle = `rgba(0, 0, 0, ${fadeAmount})`;
        ctx.fillRect(0, 0, this.width, this.height);
    }
    
    /**
     * Draw the oscilloscope grid
     */
    drawOscilloscopeGrid(hue, saturation, brightness) {
        const ctx = this.ctx;
        ctx.save();
        
        // Grid settings
        const gridColor = this.hsbaToRgba(hue, saturation * 0.7, brightness * 0.3, 0.3);
        const majorGridColor = this.hsbaToRgba(hue, saturation * 0.8, brightness * 0.4, 0.4);
        
        // Draw minor grid lines
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        
        const gridSpacing = Math.floor(this.width / 20); // 20x20 grid
        
        // Vertical lines
        ctx.beginPath();
        for (let x = gridSpacing; x < this.width; x += gridSpacing) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
        }
        ctx.stroke();
        
        // Horizontal lines
        ctx.beginPath();
        for (let y = gridSpacing; y < this.height; y += gridSpacing) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
        }
        ctx.stroke();
        
        // Draw major grid lines (center cross)
        ctx.strokeStyle = majorGridColor;
        ctx.lineWidth = 2;
        
        // Vertical center line
        ctx.beginPath();
        ctx.moveTo(this.width / 2, 0);
        ctx.lineTo(this.width / 2, this.height);
        ctx.stroke();
        
        // Horizontal center line
        ctx.beginPath();
        ctx.moveTo(0, this.height / 2);
        ctx.lineTo(this.width, this.height / 2);
        ctx.stroke();
        
        ctx.restore();
    }
    
    /**
     * Draw the oscilloscope trace with glowing phosphor effect
     */
    drawOscilloscopeTrace(xData, yData, hue, saturation, brightness, size) {
        if (!xData || !yData || xData.length === 0) return;
        
        const ctx = this.ctx;
        const persistenceCtx = this.oscilloscopeBuffers.persistenceCtx;
        const pointCount = Math.min(xData.length, yData.length);
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const scale = Math.min(this.width, this.height) * 0.4 * size;
        
        // Draw trace with multiple passes for glow effect on main canvas
        
        // Function to draw the trace at different glow levels
        const drawTrace = (targetCtx, outerGlow) => {
            // Save context state
            targetCtx.save();
            
            // Set blend mode for additive blending (creates brighter overlaps for authentic CRT look)
            targetCtx.globalCompositeOperation = 'lighter';
            
            if (outerGlow) {
                // 1. Draw widest, dimmest outer glow
                targetCtx.strokeStyle = this.hsbaToRgba(hue, saturation * 0.7, brightness * 0.3, 0.2);
                targetCtx.lineWidth = 10;
                targetCtx.lineCap = 'round';
                targetCtx.lineJoin = 'round';
                targetCtx.beginPath();
                
                for (let i = 0; i < pointCount; i++) {
                    const x = centerX + xData[i] * scale;
                    const y = centerY + yData[i] * scale;
                    
                    if (i === 0) {
                        targetCtx.moveTo(x, y);
                    } else {
                        targetCtx.lineTo(x, y);
                    }
                }
                
                targetCtx.stroke();
                
                // 2. Draw medium glow
                targetCtx.strokeStyle = this.hsbaToRgba(hue, saturation * 0.8, brightness * 0.6, 0.4);
                targetCtx.lineWidth = 5;
                targetCtx.beginPath();
                
                for (let i = 0; i < pointCount; i++) {
                    const x = centerX + xData[i] * scale;
                    const y = centerY + yData[i] * scale;
                    
                    if (i === 0) {
                        targetCtx.moveTo(x, y);
                    } else {
                        targetCtx.lineTo(x, y);
                    }
                }
                
                targetCtx.stroke();
            }
            
            // 3. Draw main bright trace
            targetCtx.strokeStyle = this.hsbaToRgba(hue, saturation, brightness, 0.9);
            targetCtx.lineWidth = 2;
            targetCtx.beginPath();
            
            for (let i = 0; i < pointCount; i++) {
                const x = centerX + xData[i] * scale;
                const y = centerY + yData[i] * scale;
                
                if (i === 0) {
                    targetCtx.moveTo(x, y);
                } else {
                    targetCtx.lineTo(x, y);
                }
            }
            
            targetCtx.stroke();
            
            // 4. Draw brightest center points - creating dots for better phosphor effect
            targetCtx.fillStyle = this.hsbaToRgba(hue, saturation * 0.5, brightness, 1.0);
            
            for (let i = 0; i < pointCount; i += 4) { // Draw fewer dots for performance
                const x = centerX + xData[i] * scale;
                const y = centerY + yData[i] * scale;
                
                targetCtx.beginPath();
                targetCtx.arc(x, y, 1, 0, Math.PI * 2);
                targetCtx.fill();
            }
            
            targetCtx.restore();
        };
        
        // Draw to main canvas with full glow effect
        drawTrace(ctx, true);
        
        // Draw to persistence buffer with less glow for more authentic phosphor decay
        drawTrace(persistenceCtx, false);
        
        // Draw ghosting trails from previous frames (if any)
        if (this.oscilloscopeBuffers.traceHistory.length > 0) {
            // Draw historical traces with decreasing opacity
            persistenceCtx.save();
            persistenceCtx.globalCompositeOperation = 'lighter';
            
            for (let h = 0; h < this.oscilloscopeBuffers.traceHistory.length; h++) {
                const historyItem = this.oscilloscopeBuffers.traceHistory[h];
                const age = (performance.now() - historyItem.time) / 1000; // Age in seconds
                const opacity = Math.max(0, 0.3 - (age * 0.3)); // Fade out with age
                
                if (opacity <= 0) continue;
                
                // Use a thinner line for ghost traces
                persistenceCtx.strokeStyle = this.hsbaToRgba(hue, saturation * 0.7, brightness * 0.4, opacity);
                persistenceCtx.lineWidth = 1;
                persistenceCtx.beginPath();
                
                const historyXData = historyItem.xData;
                const historyYData = historyItem.yData;
                const historyPointCount = Math.min(historyXData.length, historyYData.length);
                
                for (let i = 0; i < historyPointCount; i += 2) { // Sample fewer points for performance
                    const x = centerX + historyXData[i] * scale;
                    const y = centerY + historyYData[i] * scale;
                    
                    if (i === 0) {
                        persistenceCtx.moveTo(x, y);
                    } else {
                        persistenceCtx.lineTo(x, y);
                    }
                }
                
                persistenceCtx.stroke();
            }
            
            persistenceCtx.restore();
        }
    }
    
    /**
     * Apply CRT-like effects to the oscilloscope
     */
    applyCRTEffects(hue, saturation, brightness) {
        const ctx = this.ctx;
        ctx.save();
        
        // Add CRT bloom glow effect (bright areas bleed into surrounding areas)
        // This is separate from the trace glow and creates a more authentic CRT phosphor look
        ctx.filter = 'blur(1.5px)';
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.3;
        ctx.drawImage(this.canvas, 0, 0);
        ctx.globalAlpha = 0.15;
        ctx.filter = 'blur(3px)';
        ctx.drawImage(this.canvas, 0, 0);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
        ctx.globalCompositeOperation = 'source-over';
        
        // Draw scan lines with subtle greenish tint for authentic phosphor look
        const scanLineColor = this.hsbaToRgba(hue, saturation * 0.2, 0, 0.15);
        ctx.fillStyle = scanLineColor;
        const scanLineHeight = Math.max(1, Math.floor(this.height / 350)); // Scale scan lines with canvas size
        
        for (let y = scanLineHeight; y < this.height; y += scanLineHeight * 2) {
            ctx.fillRect(0, y, this.width, scanLineHeight);
        }
        
        // Draw vignette effect - stronger for more authentic CRT look
        const gradient = ctx.createRadialGradient(
            this.width / 2, this.height / 2, 0,
            this.width / 2, this.height / 2, this.width * 0.75 // Smaller radius for more pronounced vignette
        );
        
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.05)');
        gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)'); // Stronger darkening at edges
        
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'multiply'; // Better blend mode for vignette
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.globalCompositeOperation = 'source-over';
        
        // Add subtle CRT flicker
        const flickerAmount = 0.04;
        const time = performance.now() / 1000;
        // Combine random flicker with subtle sine wave oscillation for more natural effect
        const flicker = (Math.random() * flickerAmount * 0.5) + 
                        (Math.sin(time * 7.3) * 0.01) + 
                        (Math.sin(time * 13.7) * 0.005);
        
        // Green tint for the flicker with the same hue as the phosphor
        ctx.fillStyle = this.hsbaToRgba(hue, saturation * 0.3, brightness * 0.5, Math.abs(flicker));
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Add subtle screen curvature effect (CRT bulge)
        // This is done by adding a subtle shadow at the corners
        const cornerGradient = ctx.createRadialGradient(
            this.width / 2, this.height / 2, 0,
            this.width / 2, this.height / 2, this.width * 0.7
        );
        
        cornerGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        cornerGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        cornerGradient.addColorStop(0.85, 'rgba(0, 0, 0, 0.03)');
        cornerGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
        
        ctx.fillStyle = cornerGradient;
        ctx.globalCompositeOperation = 'multiply';
        
        // Apply to create subtle bulge effect
        ctx.fillRect(0, 0, this.width, this.height);
        
        ctx.restore();
    }
}
