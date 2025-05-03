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
        };
        
        // Current visual algorithm
        this.currentVisual = 'particles';
        
        // Visual generator functions
        this.visualGenerators = {
            particles: this.renderParticles.bind(this),
            waves: this.renderWaves.bind(this),
            grid: this.renderGrid.bind(this),
            fractals: this.renderFractals.bind(this),
            audioReactive: this.renderAudioReactive.bind(this),
            fluidDynamics: this.renderFluidDynamics.bind(this),
            neonGrid: this.renderNeonGrid.bind(this),
            galaxies: this.renderGalaxies.bind(this)
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
        
        // Update global time (scaled by speed)
        this.time += delta * 0.001 * this.mapParam(this.params.speed, 0.2, 2);
        
        // Update FPS counter
        this.updateFPS(delta);
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render current visual
        if (this.visualGenerators[this.currentVisual]) {
            this.visualGenerators[this.currentVisual](delta);
        }
        
        // Request next frame
        this.frameId = requestAnimationFrame(this.animate.bind(this));
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
     */
    initAudio() {
        if (this.audioData.initialized) return;
        
        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            
            // Create analyzer
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            
            // Set up data array
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // Store in our audio data object
            this.audioData.analyser = analyser;
            this.audioData.dataArray = dataArray;
            
            // Try to connect to user microphone
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then(stream => {
                    // Connect the microphone to the analyzer
                    const source = audioContext.createMediaStreamSource(stream);
                    source.connect(analyser);
                    
                    console.log('Audio input initialized');
                    this.audioData.initialized = true;
                })
                .catch(err => {
                    console.warn('Error initializing audio input:', err);
                    // Create some fake audio data for testing
                    this.audioData.initialized = true;
                    
                    // Use noise for fake audio data
                    setInterval(() => {
                        for (let i = 0; i < bufferLength; i++) {
                            // Create frequency distribution roughly resembling music
                            // Lower frequencies have higher amplitude
                            const baseFactor = 1 - (i / bufferLength); 
                            const randomFactor = Math.random() * 0.4;
                            // Occasional beats
                            const beatFactor = (Math.sin(this.time * 2) > 0.7) ? 0.8 : 0.2;
                            
                            dataArray[i] = Math.floor((baseFactor * 0.6 + randomFactor + beatFactor * 0.4) * 255);
                        }
                    }, 50);
                });
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
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
            // Get frequency data
            this.audioData.analyser.getByteFrequencyData(this.audioData.dataArray);
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
            smoothedValues: Array(128).fill(0),
            peakLevel: 0.1,
            initialized: false
        };
        
        // Map of visual names to their index for program change
        this.visualIndexMap = {
            'particles': 0,
            'waves': 1,
            'grid': 2,
            'fractals': 3,
            'audioReactive': 4,
            'fluidDynamics': 5,
            'neonGrid': 6,
            'galaxies': 7,
            'webgl-cubeField': 8,
            'webgl-tunnelEffect': 9,
            'webgl-particleSystem': 10
        };
        
        // Reverse map for looking up by program change number
        this.programChangeMap = {};
        Object.keys(this.visualIndexMap).forEach(name => {
            const index = this.visualIndexMap[name];
            this.programChangeMap[index] = name;
        });
    }
}