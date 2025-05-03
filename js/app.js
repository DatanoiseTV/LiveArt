/**
 * LiveArt - Web-based VJ Tool
 * Main application that connects MIDI to visuals
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize main components
    const visualEngine = new VisualEngine('visualizer');
    const webglEngine = new WebGLVisuals('visualizer');
    
    // Track active visualization type
    let isWebGL = false;
    
    // Live mode flag
    let isLiveMode = false;
    
    // Default values (used if no stored settings are found)
    const DEFAULT_PARAMS = {
        hue: 0.65,          // Cool blue default
        saturation: 0.85,   // Vivid colors
        brightness: 0.95,   // Bright visuals
        density: 0.7,       // More elements
        complexity: 0.65,   // Moderately complex
        reactivity: 0.7,    // Responsive to changes
        zoom: 1.1,          // Slightly zoomed in
        noiseScale: 0.02,   // Good noise scale
        speed: 0.2,         // Animation speed (reduced from 0.5)
        size: 0.5,          // Element size
        rotation: 0.1,      // Rotation speed (reduced from 0.2)
        symmetry: 6         // Symmetry factor
    };
    
    // User preset storage
    let userPresets = {};
    
    // Try to load last used settings from localStorage
    function loadLastSettings() {
        try {
            // Load main settings
            const lastSettings = localStorage.getItem('liveArtLastSettings');
            if (lastSettings) {
                const settings = JSON.parse(lastSettings);
                
                // Apply visual type
                const visualType = settings.visualType || 'particles';
                const presetSelector = document.getElementById('visual-preset');
                if (presetSelector) {
                    presetSelector.value = visualType;
                }
                
                // Apply parameters to the active engine
                if (settings.params) {
                    Object.keys(settings.params).forEach(key => {
                        visualEngine.setParam(key, settings.params[key]);
                        webglEngine.setParam(key, settings.params[key]);
                    });
                }
                
                // Apply 3D WebGL transformation settings if available
                if (settings.webgl3DSettings) {
                    if (settings.webgl3DSettings.rotationX !== undefined) {
                        webglEngine.rotationX = settings.webgl3DSettings.rotationX;
                        webglEngine._lastRotationX = settings.webgl3DSettings.rotationX;
                    }
                    if (settings.webgl3DSettings.rotationY !== undefined) {
                        webglEngine.rotationY = settings.webgl3DSettings.rotationY;
                        webglEngine._lastRotationY = settings.webgl3DSettings.rotationY;
                    }
                    if (settings.webgl3DSettings.translationZ !== undefined) {
                        webglEngine.translationZ = settings.webgl3DSettings.translationZ;
                        webglEngine._lastTranslationZ = settings.webgl3DSettings.translationZ;
                    }
                }
                
                // Apply 3D effect settings if available
                if (settings.effects3D && webglEngine.effectParams) {
                    // Copy all effect parameters
                    Object.keys(settings.effects3D).forEach(key => {
                        if (webglEngine.effectParams.hasOwnProperty(key)) {
                            webglEngine.effectParams[key] = settings.effects3D[key];
                        }
                    });
                }
                
                // Apply 2D effect settings if available
                if (settings.effects2D && visualEngine.effectParams) {
                    // Copy all effect parameters
                    Object.keys(settings.effects2D).forEach(key => {
                        if (visualEngine.effectParams.hasOwnProperty(key)) {
                            visualEngine.effectParams[key] = settings.effects2D[key];
                        }
                    });
                    
                    // Enable effects if any were active
                    const hasActiveEffects = Object.values(settings.effects2D).some(value => value > 0);
                    if (hasActiveEffects) {
                        visualEngine.effectsEnabled = true;
                    }
                }
                
                console.log('Loaded last settings from localStorage');
                
                // Check if we need to start in Live Mode
                const liveModeState = localStorage.getItem('liveArtLiveMode');
                if (liveModeState === 'true') {
                    isLiveMode = true;
                    // Set live mode visuals without indicator (we'll do that after a slight delay)
                    setTimeout(() => toggleLiveMode(), 500);
                }
                
                return true;
            }
        } catch (e) {
            console.warn('Failed to load settings from localStorage:', e);
        }
        return false;
    }
    
    // Save current settings to localStorage
    function saveCurrentSettings() {
        try {
            // Get current visual type
            const presetSelector = document.getElementById('visual-preset');
            const visualType = presetSelector ? presetSelector.value : 'particles';
            
            // Get current parameters from the active engine
            const params = isWebGL ? {...webglEngine.params} : {...visualEngine.params};
            
            // For WebGL, also save the 3D transformation settings and effects
            let webgl3DSettings = null;
            let effects2D = null;
            let effects3D = null;
            
            // Save 3D transformation settings if using WebGL
            if (isWebGL) {
                webgl3DSettings = {
                    rotationX: webglEngine.rotationX,
                    rotationY: webglEngine.rotationY,
                    translationZ: webglEngine.translationZ
                };
                
                // Save 3D effect parameters if they exist
                if (webglEngine.effectParams) {
                    effects3D = {...webglEngine.effectParams};
                }
            }
            
            // Save 2D effect parameters if they exist
            if (visualEngine.effectParams) {
                effects2D = {...visualEngine.effectParams};
            }
            
            // Create settings object
            const settings = {
                visualType: visualType,
                params: params,
                isWebGL: isWebGL,
                webgl3DSettings: webgl3DSettings,
                effects2D: effects2D,
                effects3D: effects3D
            };
            
            // Save to localStorage
            localStorage.setItem('liveArtLastSettings', JSON.stringify(settings));
            console.log('Saved current settings to localStorage');
        } catch (e) {
            console.warn('Failed to save settings to localStorage:', e);
        }
    }
    
    // Load user presets from localStorage
    function loadUserPresets() {
        try {
            const storedPresets = localStorage.getItem('liveArtUserPresets');
            if (storedPresets) {
                userPresets = JSON.parse(storedPresets);
                updatePresetsDropdown();
                console.log('Loaded user presets from localStorage');
            }
        } catch (e) {
            console.warn('Failed to load user presets:', e);
            userPresets = {};
        }
    }
    
    // Save user presets to localStorage
    function saveUserPresets() {
        try {
            localStorage.setItem('liveArtUserPresets', JSON.stringify(userPresets));
            console.log('Saved user presets to localStorage');
        } catch (e) {
            console.warn('Failed to save user presets:', e);
        }
    }
    
    // Update the presets dropdown
    function updatePresetsDropdown() {
        const presetsDropdown = document.getElementById('user-presets');
        if (!presetsDropdown) return;
        
        // Clear existing options except the first one
        while (presetsDropdown.options.length > 1) {
            presetsDropdown.remove(1);
        }
        
        // Add preset options
        Object.keys(userPresets).forEach(presetName => {
            const option = document.createElement('option');
            option.value = presetName;
            option.textContent = presetName;
            presetsDropdown.appendChild(option);
        });
    }
    
    // Try to load previous settings, otherwise apply defaults
    if (!loadLastSettings()) {
        // Apply default values if no stored settings
        Object.keys(DEFAULT_PARAMS).forEach(key => {
            visualEngine.setParam(key, DEFAULT_PARAMS[key]);
            webglEngine.setParam(key, DEFAULT_PARAMS[key]);
        });
        
        // Initialize WebGL engine (but don't start it yet)
        webglEngine.init();
        
        // Start the 2D visuals by default
        visualEngine.start();
    } else {
        // Initialize WebGL engine
        webglEngine.init();
        
        // Start either 2D or 3D based on last settings
        const presetSelector = document.getElementById('visual-preset');
        if (presetSelector) {
            const selectedValue = presetSelector.value;
            const isWebGLVisual = selectedValue.startsWith('webgl-');
            
            if (isWebGLVisual) {
                // Extract the actual WebGL scene name
                const webglSceneName = selectedValue.replace('webgl-', '');
                visualEngine.stop();
                webglEngine.loadScene(webglSceneName);
                webglEngine.start();
                isWebGL = true;
            } else {
                // Start 2D visuals
                visualEngine.setVisual(selectedValue);
                visualEngine.start();
            }
        } else {
            // Fall back to 2D if anything goes wrong
            visualEngine.start();
        }
    }
    
    // Load any saved user presets
    loadUserPresets();
    
    // Set up preset navigation buttons
    const nextPresetButton = document.getElementById('next-preset');
    const prevPresetButton = document.getElementById('prev-preset');
    
    if (nextPresetButton) {
        nextPresetButton.addEventListener('click', () => {
            nextPreset();
            // Save settings after changing preset
            setTimeout(saveCurrentSettings, 500);
        });
    }
    
    if (prevPresetButton) {
        prevPresetButton.addEventListener('click', () => {
            prevPreset();
            // Save settings after changing preset
            setTimeout(saveCurrentSettings, 500);
        });
    }
    
    // UI Controls visibility toggle
    const container = document.querySelector('.container');
    const controls = document.querySelector('.controls');
    const showControlsButton = document.querySelector('.show-controls-button');
    // Get help panel reference (already defined later in the code)
    const helpPanelElement = document.getElementById('help-panel');
    
    // Toggle standard controls visibility
    function toggleControls() {
        if (controls.classList.contains('hidden')) {
            controls.classList.remove('hidden');
        } else {
            controls.classList.add('hidden');
        }
    }
    
    // Toggle live mode (hides all UI elements for projection)
    function toggleLiveMode() {
        isLiveMode = !isLiveMode;
        
        if (isLiveMode) {
            // Hide all UI elements
            controls.classList.add('hidden');
            showControlsButton.classList.add('hidden');
            helpPanelElement.classList.remove('active');
            container.classList.add('live-mode');
            
            // Save live mode state
            localStorage.setItem('liveArtLiveMode', 'true');
            
            // Show temporary indicator
            const liveIndicator = document.createElement('div');
            liveIndicator.className = 'live-mode-indicator';
            liveIndicator.innerHTML = 'LIVE MODE';
            document.body.appendChild(liveIndicator);
            
            // Remove the indicator after 2 seconds
            setTimeout(() => {
                if (liveIndicator.parentNode) {
                    liveIndicator.parentNode.removeChild(liveIndicator);
                }
            }, 2000);
            
            console.log('Live mode activated for projection');
        } else {
            // Show UI elements again
            showControlsButton.classList.remove('hidden');
            container.classList.remove('live-mode');
            resetControlsTimeout();
            
            // Save live mode state
            localStorage.setItem('liveArtLiveMode', 'false');
            
            console.log('Live mode deactivated');
        }
    }
    
    // Hide controls after 10 seconds of inactivity
    let controlsTimeout;
    function resetControlsTimeout() {
        if (isLiveMode) return; // Don't show controls in live mode
        
        clearTimeout(controlsTimeout);
        controls.classList.remove('hidden');
        controlsTimeout = setTimeout(() => {
            controls.classList.add('hidden');
        }, 10000);
    }
    
    // Function to reset parameters to defaults
    function resetToDefaults() {
        if (!confirm('This will reset all visual parameters to defaults. Presets and MIDI mappings will be preserved. Continue?')) {
            return;
        }
        
        // Only remove the parameters settings - preserve presets and MIDI mappings
        localStorage.removeItem('liveArtLastSettings');
        localStorage.removeItem('liveArtLiveMode');
        
        // Reset parameter values directly
        // Apply default values to both engines
        Object.keys(DEFAULT_PARAMS).forEach(key => {
            visualEngine.setParam(key, DEFAULT_PARAMS[key]);
            webglEngine.setParam(key, DEFAULT_PARAMS[key]);
        });
        
        // Reset 3D transformation values
        webglEngine.rotationX = 0;
        webglEngine.rotationY = 0;
        webglEngine.translationZ = 0;
        
        // Reset trail particles parameters
        webglEngine.trailParams = {
            particleX: 0.5,
            particleY: 0.5,
            particleSize: 0.5,
            particleBrightness: 0.8,
            trailLength: 0.7,
            particleCount: 100
        };
        
        // Reset effect parameters
        webglEngine.effectParams = {
            glitchIntensity: 0,
            bloomStrength: 0,
            bloomThreshold: 0.5,
            bloomRadius: 0,
            rgbShiftAmount: 0,
            vignetteAmount: 0
        };
        
        visualEngine.effectParams = {
            glitchIntensity: 0,
            chromaticAberration: 0,
            pixelate: 0,
            vignette: 0,
            bloom: 0,
            feedbackAmount: 0
        };
        
        // Disable effects
        visualEngine.effectsEnabled = false;
        webglEngine.effectsEnabled = false;
        
        // Reset visual type to particles (2D)
        const presetSelector = document.getElementById('visual-preset');
        if (presetSelector) {
            presetSelector.value = 'particles';
            const event = new Event('change');
            presetSelector.dispatchEvent(event);
        }
        
        // Show success notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = 'Parameters reset to defaults';
        document.body.appendChild(notification);
        
        // Save the reset settings
        setTimeout(saveCurrentSettings, 500);
    }
    
    // Setup reset defaults button
    const resetDefaultsButton = document.getElementById('reset-defaults');
    if (resetDefaultsButton) {
        resetDefaultsButton.addEventListener('click', resetToDefaults);
    }
    
    // Setup control visibility events
    showControlsButton.addEventListener('click', toggleControls);
    controls.addEventListener('mousemove', resetControlsTimeout);
    controls.addEventListener('click', () => clearTimeout(controlsTimeout));
    resetControlsTimeout();
    
    // Set up preset save/load functionality
    const savePresetButton = document.getElementById('save-preset');
    const loadPresetButton = document.getElementById('load-preset');
    const presetsDropdown = document.getElementById('user-presets');
    
    // Save current settings as a preset
    savePresetButton.addEventListener('click', () => {
        // Prompt user for preset name
        const presetName = prompt('Enter a name for this preset:', '');
        if (!presetName || presetName.trim() === '') return;
        
        // Get current visual type and parameters
        const presetSelector = document.getElementById('visual-preset');
        const visualType = presetSelector ? presetSelector.value : 'particles';
        const params = isWebGL ? {...webglEngine.params} : {...visualEngine.params};
        
        // Create preset object with MIDI mappings
        userPresets[presetName] = {
            visualType: visualType,
            params: params,
            isWebGL: isWebGL,
            midiMappings: {...MIDI_MAPPINGS} // Include a copy of the current MIDI mappings
        };
        
        // Save to localStorage
        saveUserPresets();
        
        // Update the dropdown
        updatePresetsDropdown();
        
        // Select the new preset in the dropdown
        presetsDropdown.value = presetName;
        
        console.log(`Saved preset: ${presetName}`);
    });
    
    // Load selected preset
    loadPresetButton.addEventListener('click', () => {
        const presetName = presetsDropdown.value;
        if (!presetName || !userPresets[presetName]) return;
        
        const preset = userPresets[presetName];
        
        // Apply visual type
        const presetSelector = document.getElementById('visual-preset');
        if (presetSelector && preset.visualType) {
            presetSelector.value = preset.visualType;
            
            // Trigger change event to set the visualization
            const event = new Event('change');
            presetSelector.dispatchEvent(event);
        }
        
        // Apply parameters
        if (preset.params) {
            Object.keys(preset.params).forEach(key => {
                visualEngine.setParam(key, preset.params[key]);
                webglEngine.setParam(key, preset.params[key]);
            });
        }
        
        // Apply MIDI mappings if they exist in the preset
        if (preset.midiMappings) {
            MIDI_MAPPINGS = {...preset.midiMappings};
            saveMidiMappings(); // Save the updated mappings to localStorage
            
            // Update the mapping table if it's visible
            if (helpPanelElement.classList.contains('active')) {
                updateMappingTable();
            }
            
            console.log(`Loaded MIDI mappings from preset: ${presetName}`);
        }
        
        console.log(`Loaded preset: ${presetName}`);
    });
    
    // Handle visual preset selection with nice transitions
    const presetSelector = document.getElementById('visual-preset');
    presetSelector.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        const isWebGLVisual = selectedValue.startsWith('webgl-');
        
        // Extract the actual WebGL scene name if needed
        const webglSceneName = isWebGLVisual ? selectedValue.replace('webgl-', '') : null;
        
        // Save current parameter values from the active engine
        const oldParams = isWebGL ? {...webglEngine.params} : {...visualEngine.params};
        
        // Save settings to localStorage
        setTimeout(saveCurrentSettings, 500);
        
        // Switch between 2D and 3D if needed
        if (isWebGLVisual && !isWebGL) {
            // Switching from 2D to 3D
            visualEngine.stop();
            webglEngine.loadScene(webglSceneName);
            webglEngine.start();
            isWebGL = true;
            
            // Debug message
            console.log('Switched to WebGL:', webglSceneName, 'WebGL running:', webglEngine.isActive);
        }
        else if (!isWebGLVisual && isWebGL) {
            // Switching from 3D to 2D
            webglEngine.stop();
            visualEngine.setVisual(selectedValue);
            visualEngine.start();
            isWebGL = false;
        }
        else if (isWebGLVisual) {
            // Switching between 3D scenes
            console.log('Switching 3D scene to:', webglSceneName);
            
            // First stop the current WebGL rendering
            webglEngine.stop();
            
            // Load the new scene
            webglEngine.loadScene(webglSceneName);
            
            // Restart WebGL engine with new scene
            webglEngine.start();
            
            // Debug message
            console.log('Switched 3D scene, WebGL running:', webglEngine.isActive);
        }
        else {
            // Switching between 2D visuals
            visualEngine.setVisual(selectedValue);
        }
        
        // Smoothly transition to appropriate default values for this preset
        const transitionDuration = 1000; // ms
        const startTime = performance.now();
        
        function updateTransition() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / transitionDuration, 1);
            
            // Apply easing
            const easedProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Get preset defaults
            const targetParams = getPresetDefaults(selectedValue);
            
            // Interpolate between old and new parameter values
            for (const param in targetParams) {
                if (oldParams[param] !== undefined) {
                    const value = oldParams[param] + (targetParams[param] - oldParams[param]) * easedProgress;
                    
                    // Apply to the active engine
                    if (isWebGL) {
                        webglEngine.setParam(param, value);
                    } else {
                        visualEngine.setParam(param, value);
                    }
                }
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateTransition);
            }
        }
        
        // Start transition
        requestAnimationFrame(updateTransition);
    });
    
    // Define ideal parameter presets for each visual type
    function getPresetDefaults(presetName) {
        const presets = {
            // 2D Visuals
            particles: {
                hue: 0.65,          // Blue
                saturation: 0.85,
                brightness: 0.95,
                density: 0.7,
                speed: 0.01,        // Ultra slow for complete control
                size: 0.5,
                complexity: 0.6,
                symmetry: 6,
                reactivity: 0.7,
                rotation: 0.05      // Very slow rotation
            },
            waves: {
                hue: 0.3,           // Green
                saturation: 0.7,
                brightness: 0.9,
                density: 0.6,
                speed: 0.05,       // Ultra slow for complete control
                size: 0.4,
                complexity: 0.75,
                noiseScale: 0.03,
                reactivity: 0.8
            },
            grid: {
                hue: 0.05,          // Orange
                saturation: 0.8,
                brightness: 0.9,
                density: 0.5,
                speed: 0.03,       // Ultra slow for complete control
                size: 0.6,
                complexity: 0.5,
                noiseScale: 0.01,   // Reduced noise scale
                reactivity: 0.5
            },
            fractals: {
                hue: 0.8,           // Purple
                saturation: 0.9,
                brightness: 0.85,
                density: 0.4,
                speed: 0.2,         // Original speed
                size: 0.7,
                complexity: 0.8,
                rotation: 0.4,      // Original rotation
                reactivity: 0.6
            },
            audioReactive: {
                hue: 0.55,          // Cyan
                saturation: 0.85,
                brightness: 0.9,
                density: 0.7,
                speed: 0.4,         // Original speed
                size: 0.6,
                complexity: 0.7,
                reactivity: 0.9
            },
            fluidDynamics: {
                hue: 0.7,           // Blue-purple
                saturation: 0.75,
                brightness: 0.85,
                density: 0.6,
                speed: 0.35,        // Original speed
                size: 0.4,
                complexity: 0.65,
                reactivity: 0.8
            },
            neonGrid: {
                hue: 0.9,           // Pink
                saturation: 0.9,
                brightness: 0.95,
                density: 0.5,
                speed: 0.3,         // Original speed
                size: 0.5,
                complexity: 0.7,
                rotation: 0.3,      // Original rotation
                reactivity: 0.7
            },
            galaxies: {
                hue: 0.7,           // Purple
                saturation: 0.8,
                brightness: 0.85,
                density: 0.8,
                speed: 0.25,        // Original speed
                size: 0.6,
                complexity: 0.6,
                reactivity: 0.65
            },
            // New visuals
            kaleidoscope: {
                hue: 0.85,          // Purple-pink
                saturation: 0.9,
                brightness: 0.9,
                density: 0.6,
                speed: 0.02,       // Ultra slow for complete control
                size: 0.7,
                complexity: 0.8,
                symmetry: 8,        // High symmetry for kaleidoscope
                rotation: 0.02,     // Very slow rotation
                reactivity: 0.8
            },
            lissajous: {
                hue: 0.5,           // Cyan-blue
                saturation: 0.8,
                brightness: 0.9,
                density: 0.7,
                speed: 0.4,         // Original speed
                size: 0.5,
                complexity: 0.7,    // Controls frequency ratio
                rotation: 0.2,      // Original rotation
                reactivity: 0.75
            },
            voronoi: {
                hue: 0.1,           // Orange-yellow
                saturation: 0.7,
                brightness: 0.9,
                density: 0.5,       // Cell density
                speed: 0.01,       // Ultra slow for complete control
                size: 0.6,          // Cell size
                complexity: 0.6,
                noiseScale: 0.01,   // Reduced noise scale
                reactivity: 0.7
            },
            tentacles: {
                hue: 0.75,          // Purple
                saturation: 0.8,
                brightness: 0.85,
                density: 0.7,       // Number of tentacles
                speed: 0.3,         // Original speed
                size: 0.5,          // Tentacle thickness
                complexity: 0.8,    // Tentacle waviness
                rotation: 0.1,      // Original rotation
                reactivity: 0.85    // How reactive to parameter changes
            },
            circuitBoard: {
                hue: 0.35,          // Green
                saturation: 0.9,
                brightness: 0.8,
                density: 0.7,       // Circuit density
                speed: 0.005,       // Ultra slow for complete control
                size: 0.5,
                complexity: 0.75,   // Connection complexity
                rotation: 0.005,    // Minimal rotation
                reactivity: 0.6
            },
            pixelFlow: {
                hue: 0.6,           // Blue
                saturation: 0.8,
                brightness: 0.95,
                density: 0.6,       // Particle density
                speed: 0.03,        // Ultra slow for complete control
                size: 0.4,          // Particle size
                complexity: 0.7,    // Flow complexity
                noiseScale: 0.01,   // Reduced noise scale
                reactivity: 0.9
            },
            
            // 3D WebGL Visuals
            'webgl-cubeField': {
                hue: 0.6,           // Blue
                saturation: 0.8,
                brightness: 0.9,
                density: 0.6,
                speed: 0.4,         // Original speed
                size: 0.5,
                complexity: 0.7,
                rotation: 0.2,      // Original rotation
                zoom: 0.6,
                reactivity: 0.7
            },
            'webgl-tunnelEffect': {
                hue: 0.85,          // Pink
                saturation: 0.9,
                brightness: 0.95,
                density: 0.7,
                speed: 0.5,         // Original speed
                size: 0.6,
                complexity: 0.8,
                rotation: 0.3,      // Original rotation
                zoom: 0.4,
                reactivity: 0.8
            },
            'webgl-particleSystem': {
                hue: 0.15,          // Yellow-orange
                saturation: 0.9,
                brightness: 0.9,
                density: 0.8,
                speed: 0.35,        // Original speed
                size: 0.4,
                complexity: 0.65,
                rotation: 0.1,      // Original rotation
                zoom: 0.5,
                reactivity: 0.7
            },
            'webgl-trailParticles': {
                hue: 0.7,           // Purple-blue
                saturation: 0.9,
                brightness: 0.95,
                density: 0.6,       // Controls number of particles
                speed: 0.3,         // Animation speed
                size: 0.5,          // Base size parameter
                complexity: 0.6,    // Visual complexity
                rotation: 0.05,     // Slow rotation
                zoom: 0.8,          // Camera zoom
                reactivity: 0.8     // High reactivity
            }
        };
        
        return presets[presetName] || presets.particles;
    }
    
    // Define MIDI CC mappings with better descriptions
    // Store these in an object that we can persist to localStorage
    let MIDI_MAPPINGS = {
        // Core parameters
        1: { param: 'hue', name: 'Color Hue' },
        2: { param: 'saturation', name: 'Color Saturation' },
        3: { param: 'brightness', name: 'Brightness' },
        4: { param: 'density', name: 'Density' },
        5: { param: 'speed', name: 'Animation Speed' },
        6: { param: 'size', name: 'Element Size' },
        7: { param: 'complexity', name: 'Complexity' },
        
        // Secondary parameters
        8: { param: 'rotation', name: 'Rotation' },
        9: { param: 'zoom', name: 'Zoom', min: 0.5, max: 2.0 },
        10: { param: 'noiseScale', name: 'Pattern Scale', min: 0.001, max: 0.05 },
        11: { param: 'noiseSpeed', name: 'Pattern Speed', min: 0.001, max: 0.01 },
        12: { param: 'symmetry', name: 'Symmetry', min: 1, max: 16, integer: true },
        13: { param: 'reactivity', name: 'Reactivity' },
        
        // Special controls
        14: { param: 'special', name: 'Randomize', action: 'randomize' },
        15: { param: 'special', name: 'Next Preset', action: 'nextPreset' },
        
        // Visual-specific parameters (using special actions for backward compatibility)
        16: { param: 'special', name: 'Kaleidoscope Symmetry', action: 'kaleidoscopeSymmetry', min: 3, max: 16, integer: true },
        17: { param: 'special', name: 'Lissajous Freq Ratio', action: 'lissajousFreqRatio', min: 1, max: 8, integer: true },
        18: { param: 'special', name: 'Voronoi Cell Size', action: 'voronoiCellSize', min: 0.1, max: 1.0 },
        19: { param: 'special', name: 'Tentacle Count', action: 'tentacleCount', min: 3, max: 20, integer: true },
        20: { param: 'special', name: 'Circuit Complexity', action: 'circuitComplexity', min: 0.1, max: 1.0 },
        21: { param: 'special', name: 'Flow Direction', action: 'flowDirection', min: 0, max: 1.0 },
        
        // 3D WebGL specific controls - changed to direct params for proper display
        22: { param: 'rotationX', name: '3D Rotate X', min: -Math.PI, max: Math.PI },
        23: { param: 'rotationY', name: '3D Rotate Y', min: -Math.PI, max: Math.PI },
        24: { param: 'translationZ', name: '3D Translate Z', min: -10, max: 10 },
        
        // Trail particles controls
        35: { param: 'particleX', name: 'Particle X Position' },
        36: { param: 'particleY', name: 'Particle Y Position' },
        37: { param: 'particleSize', name: 'Particle Size' },
        38: { param: 'particleBrightness', name: 'Particle Brightness' },
        39: { param: 'trailLength', name: 'Trail Length' },
        
        // 3D Post-processing effects
        25: { param: 'glitchIntensity', name: 'Glitch Effect' },
        26: { param: 'bloomStrength', name: 'Bloom Effect' },
        27: { param: 'rgbShiftAmount', name: 'RGB Shift Effect' },
        28: { param: 'vignetteAmount', name: 'Vignette Effect' },
        
        // 2D Post-processing effects
        29: { param: 'glitchIntensity', name: '2D Glitch' },
        30: { param: 'chromaticAberration', name: 'RGB Split' },
        31: { param: 'pixelate', name: 'Pixelate' },
        32: { param: 'vignette', name: 'Vignette' },
        33: { param: 'bloom', name: 'Bloom/Glow' },
        34: { param: 'feedbackAmount', name: 'Feedback/Echo' }
    };
    
    // Helper function to check if a specific visual is currently active
    function isCurrentVisual(visualName) {
        return visualEngine.currentVisual === visualName;
    }
    
    // Define all available parameters (used for MIDI learn)
    const AVAILABLE_PARAMETERS = [
        { param: 'hue', name: 'Color Hue' },
        { param: 'saturation', name: 'Color Saturation' },
        { param: 'brightness', name: 'Brightness' },
        { param: 'density', name: 'Density' },
        { param: 'speed', name: 'Animation Speed' },
        { param: 'size', name: 'Element Size' },
        { param: 'complexity', name: 'Complexity' },
        { param: 'rotation', name: 'Rotation' },
        { param: 'zoom', name: 'Zoom', min: 0.5, max: 2.0 },
        { param: 'noiseScale', name: 'Pattern Scale', min: 0.001, max: 0.05 },
        { param: 'noiseSpeed', name: 'Pattern Speed', min: 0.001, max: 0.01 },
        { param: 'symmetry', name: 'Symmetry', min: 1, max: 16, integer: true },
        { param: 'reactivity', name: 'Reactivity' },
        { param: 'special', name: 'Randomize', action: 'randomize' },
        { param: 'special', name: 'Next Preset', action: 'nextPreset' },
        { param: 'special', name: 'Kaleidoscope Symmetry', action: 'kaleidoscopeSymmetry', min: 3, max: 16, integer: true },
        { param: 'special', name: 'Lissajous Freq Ratio', action: 'lissajousFreqRatio', min: 1, max: 8, integer: true },
        { param: 'special', name: 'Voronoi Cell Size', action: 'voronoiCellSize', min: 0.1, max: 1.0 },
        { param: 'special', name: 'Tentacle Count', action: 'tentacleCount', min: 3, max: 20, integer: true },
        { param: 'special', name: 'Circuit Complexity', action: 'circuitComplexity', min: 0.1, max: 1.0 },
        { param: 'special', name: 'Flow Direction', action: 'flowDirection', min: 0, max: 1.0 },
        { param: 'rotationX', name: '3D Rotate X', min: -Math.PI, max: Math.PI },
        { param: 'rotationY', name: '3D Rotate Y', min: -Math.PI, max: Math.PI },
        { param: 'translationZ', name: '3D Translate Z', min: -10, max: 10 },
        
        // Trail particle parameters
        { param: 'particleX', name: 'Particle X Position' },
        { param: 'particleY', name: 'Particle Y Position' },
        { param: 'particleSize', name: 'Particle Size' },
        { param: 'particleBrightness', name: 'Particle Brightness' },
        { param: 'trailLength', name: 'Trail Length' },
        
        // WebGL/3D Post-processing effects
        { param: 'glitchIntensity', name: 'Glitch Effect' },
        { param: 'bloomStrength', name: 'Bloom Effect' },
        { param: 'bloomRadius', name: 'Bloom Radius', min: 0, max: 1 },
        { param: 'bloomThreshold', name: 'Bloom Threshold', min: 0, max: 1 },
        { param: 'rgbShiftAmount', name: 'RGB Shift Effect' },
        { param: 'vignetteAmount', name: 'Vignette Effect' },
        
        // 2D Post-processing effects
        { param: 'chromaticAberration', name: 'Chromatic Aberration' },
        { param: 'pixelate', name: 'Pixelate Effect' },
        { param: 'vignette', name: 'Vignette Effect' },
        { param: 'bloom', name: 'Bloom Effect' },
        { param: 'feedbackAmount', name: 'Feedback/Echo Effect' },
        { param: 'effectsEnabled', name: 'Toggle Effects' }
    ];
    
    // Try to load saved mappings from localStorage
    try {
        const savedMappings = localStorage.getItem('liveArtMidiMappings');
        if (savedMappings) {
            const parsedMappings = JSON.parse(savedMappings);
            // Merge the saved mappings with our default mappings to ensure we have all needed properties
            MIDI_MAPPINGS = parsedMappings;
            console.log('Loaded custom MIDI mappings from localStorage');
        }
    } catch (e) {
        console.warn('Failed to load MIDI mappings from localStorage:', e);
    }
    
    // Helper function to save mappings to localStorage
    function saveMidiMappings() {
        try {
            localStorage.setItem('liveArtMidiMappings', JSON.stringify(MIDI_MAPPINGS));
            console.log('Saved MIDI mappings to localStorage');
        } catch (e) {
            console.warn('Failed to save MIDI mappings to localStorage:', e);
        }
    }
    
    // Connect MIDI controller to visuals with improved mapping
    if (typeof midiController !== 'undefined') {
        midiController.onAnyControlChange((ccNumber, value) => {
        // Reset controls timeout on MIDI activity
        resetControlsTimeout();
        
        const mapping = MIDI_MAPPINGS[ccNumber];
        if (!mapping) return;
        
        console.log(`CC ${ccNumber} (${mapping.name}): ${value.toFixed(2)}`);
        
        // Handle special action mappings
        if (mapping.param === 'special') {
            switch (mapping.action) {
                case 'randomize':
                    // Only trigger on high values (like button press)
                    if (value > 0.7) {
                        randomizeParameters();
                        // Save settings after randomizing
                        setTimeout(saveCurrentSettings, 500);
                    }
                    return;
                    
                case 'nextPreset':
                    // Only trigger on high values (like button press)
                    if (value > 0.7) {
                        nextPreset();
                        // Save settings after changing preset
                        setTimeout(saveCurrentSettings, 500);
                    }
                    return;
                    
                // Legacy special controls - handle visualization-specific params
                case 'kaleidoscopeSymmetry':
                    // Map to symmetry parameter when in kaleidoscope mode
                    if (isCurrentVisual('kaleidoscope')) {
                        const mappedValue = mapping.min + value * (mapping.max - mapping.min);
                        const intValue = Math.round(mappedValue);
                        visualEngine.setParam('symmetry', intValue);
                    }
                    return;
                    
                case 'lissajousFreqRatio':
                    // Map to complexity parameter when in lissajous mode
                    if (isCurrentVisual('lissajous')) {
                        const mappedValue = mapping.min + value * (mapping.max - mapping.min);
                        const intValue = Math.round(mappedValue);
                        visualEngine.setParam('complexity', intValue/8); // Scale to 0-1 range
                    }
                    return;
                    
                case 'voronoiCellSize':
                    // Map to size parameter when in voronoi mode
                    if (isCurrentVisual('voronoi')) {
                        const mappedValue = mapping.min + value * (mapping.max - mapping.min);
                        visualEngine.setParam('size', mappedValue);
                    }
                    return;
                    
                case 'tentacleCount':
                    // Map to density parameter when in tentacles mode
                    if (isCurrentVisual('tentacles')) {
                        const mappedValue = mapping.min + value * (mapping.max - mapping.min);
                        const intValue = Math.round(mappedValue);
                        visualEngine.setParam('density', intValue/20); // Scale to 0-1 range
                    }
                    return;
                    
                case 'circuitComplexity':
                    // Map to complexity parameter when in circuit board mode
                    if (isCurrentVisual('circuitBoard')) {
                        const mappedValue = mapping.min + value * (mapping.max - mapping.min);
                        visualEngine.setParam('complexity', mappedValue);
                    }
                    return;
                    
                case 'flowDirection':
                    // Map to rotation parameter when in pixelFlow mode
                    if (isCurrentVisual('pixelFlow')) {
                        visualEngine.setParam('rotation', value);
                    }
                    return;
                    
                // Note: 3D WebGL Controls (rotationX, rotationY, translationZ) are now handled
                // as regular parameters below, not as special actions
            }
        }
        
        // Handle visualization-specific parameters (new style)
        if (mapping.visualType) {
            // Only apply if the current visualization matches
            if (isCurrentVisual(mapping.visualType)) {
                let mappedValue = value;
                
                // Map to custom range if specified
                if (mapping.min !== undefined && mapping.max !== undefined) {
                    mappedValue = mapping.min + value * (mapping.max - mapping.min);
                    
                    // Convert to integer if specified
                    if (mapping.integer) {
                        mappedValue = Math.round(mappedValue);
                    }
                }
                
                // Apply the parameter to the active engine
                visualEngine.setParam(mapping.param, mappedValue);
                
                // Throttled save to avoid too many localStorage writes
                if (!window.visualTypeSaveTimeout) {
                    window.visualTypeSaveTimeout = setTimeout(() => {
                        saveCurrentSettings();
                        window.visualTypeSaveTimeout = null;
                    }, 1000);
                }
                
                return;
            } else {
                // Skip if this parameter is for a different visualization
                return;
            }
        }
        
        // Handle regular parameter mappings
        let mappedValue = value;
        
        // Map to custom range if specified
        if (mapping.min !== undefined && mapping.max !== undefined) {
            mappedValue = mapping.min + value * (mapping.max - mapping.min);
            
            // Convert to integer if specified
            if (mapping.integer) {
                mappedValue = Math.round(mappedValue);
            }
        }
        
        // Apply the parameter to the active engine
        if (isWebGL) {
            webglEngine.setParam(mapping.param, mappedValue);
        } else {
            visualEngine.setParam(mapping.param, mappedValue);
        }
        
        // Throttled save to avoid too many localStorage writes
        // We only save on MIDI messages once per second to avoid excessive writes
        if (!this.saveTimeout) {
            this.saveTimeout = setTimeout(() => {
                saveCurrentSettings();
                this.saveTimeout = null;
            }, 1000);
        }
    });
    
    // Connect MIDI program changes to switch visual algorithms
    if (typeof midiController !== 'undefined') {
        midiController.onProgramChange((programNumber) => {
        // Reset controls timeout on MIDI activity
        resetControlsTimeout();
        
        // Check if this program number maps to a valid visual
        const visualName = visualEngine.programChangeMap[programNumber];
        if (visualName) {
            console.log(`Switching to visual: ${visualName} (Program ${programNumber})`);
            
            // Update the visual select dropdown
            const presetSelector = document.getElementById('visual-preset');
            if (presetSelector) {
                presetSelector.value = visualName;
                
                // Trigger the change event to apply transitions
                presetSelector.dispatchEvent(new Event('change'));
                
                // Save settings after changing preset
                setTimeout(saveCurrentSettings, 500);
            } else {
                // If dropdown not found, just set the visual directly
                visualEngine.setVisual(visualName);
                
                // Save settings after changing visual
                setTimeout(saveCurrentSettings, 500);
            }
        } else {
            console.log(`Ignoring unknown program change: ${programNumber}`);
        }
    });
    }
    
    // Function to cycle to next preset
    function nextPreset() {
        const presetSelect = document.getElementById('visual-preset');
        const options = presetSelect.options;
        let currentIndex = presetSelect.selectedIndex;
        let nextIndex = (currentIndex + 1) % options.length;
        
        presetSelect.selectedIndex = nextIndex;
        presetSelect.dispatchEvent(new Event('change'));
    }
    
    // Function to go to previous preset
    function prevPreset() {
        const presetSelect = document.getElementById('visual-preset');
        const options = presetSelect.options;
        let currentIndex = presetSelect.selectedIndex;
        let prevIndex = (currentIndex - 1 + options.length) % options.length;
        
        presetSelect.selectedIndex = prevIndex;
        presetSelect.dispatchEvent(new Event('change'));
    }
    
    // Function to randomize parameters with constraints
    function randomizeParameters() {
        // Subtle randomization that keeps things looking good
        const params = {
            hue: Math.random(),
            saturation: 0.7 + Math.random() * 0.3,  // Keep saturation 0.7-1.0
            brightness: 0.8 + Math.random() * 0.2,  // Keep brightness 0.8-1.0
            density: 0.4 + Math.random() * 0.6,     // Keep density 0.4-1.0
            speed: isWebGL ? (0.1 + Math.random() * 0.4) : (0.3 + Math.random() * 0.7), // Slower for WebGL
            size: 0.3 + Math.random() * 0.7,        // Size 0.3-1.0
            complexity: 0.4 + Math.random() * 0.6,  // Complexity 0.4-1.0
            rotation: Math.random() * 0.5,          // Reduced rotation for better visuals
            zoom: 0.7 + Math.random() * 1.0,        // Zoom 0.7-1.7
            noiseScale: 0.005 + Math.random() * 0.03, // Reasonable noise scale
            symmetry: Math.floor(2 + Math.random() * 7) // Symmetry 2-8
        };
        
        // Ensure both engines get the parameters
        for (const param in params) {
            // Apply to active engine first
            if (isWebGL) {
                webglEngine.setParam(param, params[param]);
            } else {
                visualEngine.setParam(param, params[param]);
            }
            
            // Also update the inactive engine to ensure parameters are in sync
            if (isWebGL) {
                visualEngine.setParam(param, params[param]);
            } else {
                webglEngine.setParam(param, params[param]);
            }
        }
        
        // Force a re-render for WebGL
        if (isWebGL) {
            // If needed, reload the scene to apply changes
            const scene = webglEngine.getCurrentScene();
            webglEngine.loadScene(scene);
            
            // Make sure WebGL canvas is visible
            setTimeout(() => {
                webglEngine.renderer.render(webglEngine.scene, webglEngine.camera);
                console.log('Forced WebGL re-render after parameter changes');
            }, 50);
        }
        
        // Save settings to localStorage
        setTimeout(saveCurrentSettings, 500);
        
        console.log('Parameters randomized!');
    }
    
    // Keyboard controls with enhanced functionality
    window.addEventListener('keydown', (e) => {
        // Skip keyboard shortcuts if the event occurred in a text input, textarea, or select element
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
            
        // Reset UI timeout on key activity (unless in live mode)
        if (!isLiveMode) {
            resetControlsTimeout();
        }
        
        // Throttled save for keyboard parameter changes
        const throttledSave = () => {
            if (!window.keyboardSaveTimeout) {
                window.keyboardSaveTimeout = setTimeout(() => {
                    saveCurrentSettings();
                    window.keyboardSaveTimeout = null;
                }, 1000);
            }
        };
        
        // 3D Controls with X,Y,Z keys + Shift/Alt
        if (isWebGL && (e.key === 'x' || e.key === 'y' || e.key === 'z')) {
            const smallDelta = 0.1; // Small movement for fine control
            const largeDelta = 0.5;  // Larger movement for quick adjustments
            const delta = e.shiftKey ? largeDelta : smallDelta;
            
            if (e.key === 'x') {
                // X key controls rotation X
                webglEngine.rotationX += e.altKey ? -delta : delta;
                console.log(`3D Rotate X: ${webglEngine.rotationX.toFixed(2)}`);
            } else if (e.key === 'y') {
                // Y key controls rotation Y
                webglEngine.rotationY += e.altKey ? -delta : delta;
                console.log(`3D Rotate Y: ${webglEngine.rotationY.toFixed(2)}`);
            } else if (e.key === 'z') {
                // Z key controls translation Z
                webglEngine.translationZ += e.altKey ? -delta : delta;
                console.log(`3D Translate Z: ${webglEngine.translationZ.toFixed(2)}`);
            }
            
            // Save settings after 3D adjustments
            throttledSave();
            return;
        }
        
        // Reset 3D transformations with R key
        if (isWebGL && e.key.toLowerCase() === 'r') {
            webglEngine.rotationX = 0;
            webglEngine.rotationY = 0;
            webglEngine.translationZ = 0;
            console.log('Reset 3D transformations');
            throttledSave();
            return;
        }
        
        // Number keys 1-9 simulate MIDI CC messages 1-9
        if (e.key >= '1' && e.key <= '9') {
            const ccNumber = parseInt(e.key);
            
            // Handle differently based on key modifiers
            if (e.shiftKey) {
                // Shift+number decreases the parameter
                const mapping = MIDI_MAPPINGS[ccNumber];
                if (mapping && mapping.param !== 'special') {
                    const currentValue = isWebGL ? 
                        (webglEngine.params[mapping.param] || 0) :
                        (visualEngine.params[mapping.param] || 0);
                    const newValue = Math.max(0, currentValue - 0.1);
                    
                    // Apply to active engine
                    if (isWebGL) {
                        webglEngine.setParam(mapping.param, newValue);
                    } else {
                        visualEngine.setParam(mapping.param, newValue);
                    }
                    
                    console.log(`Keyboard: ${mapping.name} = ${newValue.toFixed(2)} (decreased)`);
                    
                    // Save settings after change
                    throttledSave();
                }
            } else {
                // Just number increases the parameter
                const mapping = MIDI_MAPPINGS[ccNumber];
                if (mapping && mapping.param !== 'special') {
                    const currentValue = isWebGL ? 
                        (webglEngine.params[mapping.param] || 0) :
                        (visualEngine.params[mapping.param] || 0);
                    const newValue = Math.min(1, currentValue + 0.1);
                    
                    // Apply to active engine
                    if (isWebGL) {
                        webglEngine.setParam(mapping.param, newValue);
                    } else {
                        visualEngine.setParam(mapping.param, newValue);
                    }
                    
                    console.log(`Keyboard: ${mapping.name} = ${newValue.toFixed(2)} (increased)`);
                    
                    // Save settings after change
                    throttledSave();
                }
            }
        }
        
        // Spacebar to randomize parameters
        if (e.key === ' ') {
            randomizeParameters();
        }
        
        // Arrow keys to change preset
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextPreset();
            // Save settings after changing preset
            setTimeout(saveCurrentSettings, 500);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            const presetSelect = document.getElementById('visual-preset');
            const options = presetSelect.options;
            let currentIndex = presetSelect.selectedIndex;
            let prevIndex = (currentIndex - 1 + options.length) % options.length;
            
            presetSelect.selectedIndex = prevIndex;
            presetSelect.dispatchEvent(new Event('change'));
            // Save settings after changing preset
            setTimeout(saveCurrentSettings, 500);
        }
        
        // F key for fullscreen
        if (e.key.toLowerCase() === 'f') {
            toggleFullscreen();
        }
        
        // H key to hide/show controls (if not in live mode)
        if (e.key.toLowerCase() === 'h' && !isLiveMode) {
            toggleControls();
        }
        
        // L key to toggle live mode (perfect for projection)
        if (e.key.toLowerCase() === 'l') {
            toggleLiveMode();
        }
        
        // G key to toggle grid visibility in 3D scenes
        if (e.key.toLowerCase() === 'g' && isWebGL) {
            webglEngine.toggleGrid();
        }
        
        // E key to toggle effects
        if (e.key.toLowerCase() === 'e') {
            // Toggle effects in the active engine
            if (isWebGL) {
                webglEngine.effectsEnabled = !webglEngine.effectsEnabled;
                console.log(`3D Effects: ${webglEngine.effectsEnabled ? 'Enabled' : 'Disabled'}`);
            } else {
                visualEngine.effectsEnabled = !visualEngine.effectsEnabled;
                console.log(`2D Effects: ${visualEngine.effectsEnabled ? 'Enabled' : 'Disabled'}`);
            }
            
            // Save settings after toggling effects
            setTimeout(saveCurrentSettings, 500);
        }
    });
    
    // Fullscreen toggle function
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Fullscreen error: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
    
    // Double-click for fullscreen
    document.addEventListener('dblclick', toggleFullscreen);
    
    // Enhanced touch support with multi-touch gestures
    const canvas = document.getElementById('visualizer');
    let lastTouchDistance = 0;
    
    // Prevent default touch actions
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        
        // Two-finger touch for zoom
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
        }
    });
    
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        
        // Show controls on touch
        resetControlsTimeout();
        
        if (e.touches.length === 1) {
            // Single touch controls hue and brightness
            const touch = e.touches[0];
            const hueValue = touch.clientX / window.innerWidth;
            const brightnessValue = 1 - (touch.clientY / window.innerHeight);
            
            visualEngine.setParam('hue', hueValue);
            visualEngine.setParam('brightness', brightnessValue);
        } else if (e.touches.length === 2) {
            // Two finger pinch controls zoom
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (lastTouchDistance > 0) {
                const zoomDelta = (distance - lastTouchDistance) * 0.01;
                const currentZoom = visualEngine.params.zoom || 1;
                const newZoom = Math.max(0.5, Math.min(2.5, currentZoom + zoomDelta));
                
                visualEngine.setParam('zoom', newZoom);
            }
            
            lastTouchDistance = distance;
            
            // Calculate center of pinch for rotation
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const rotationValue = (centerX / window.innerWidth) - 0.5;
            visualEngine.setParam('rotation', rotationValue);
        }
    });
    
    // Performance optimizations
    function optimizeForPerformance() {
        // Set appropriate pixel ratio based on device capabilities
        let pixelRatio = 1;
        
        // Check if high DPI device
        if (window.devicePixelRatio > 1) {
            // On mobile or slower devices, use lower resolution
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                pixelRatio = 1; // Force standard resolution on mobile
            } else {
                pixelRatio = Math.min(window.devicePixelRatio, 2); // Cap at 2x on desktop
            }
        }
        
        // Set canvas dimensions
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        canvas.width = window.innerWidth * pixelRatio;
        canvas.height = window.innerHeight * pixelRatio;
        
        // Adjust rendering context for DPI if needed
        if (pixelRatio !== 1) {
            const ctx = canvas.getContext('2d');
            ctx.scale(pixelRatio, pixelRatio);
        }
        
        // Additional performance optimizations
        canvas.style.imageRendering = 'optimizeSpeed';
    }
    
    // Run performance optimizations and handle resize
    optimizeForPerformance();
    window.addEventListener('resize', optimizeForPerformance);
    
    // Setup Help Panel and MIDI CC learning
    // Using the already declared helpPanelElement from above
    const helpButton = document.getElementById('help-button');
    const closeHelpButton = document.getElementById('close-help');
    const mappingTable = document.getElementById('midi-mapping-table').querySelector('tbody');
    const learnStatus = document.getElementById('learn-status');
    const cancelLearnButton = document.getElementById('cancel-learn');
    
    // Add elements for exporting/importing mappings
    const exportButton = document.createElement('button');
    exportButton.id = 'export-midi-map';
    exportButton.className = 'secondary-button';
    exportButton.textContent = 'Export CC Map';
    
    const importButton = document.createElement('button');
    importButton.id = 'import-midi-map';
    importButton.className = 'secondary-button';
    importButton.textContent = 'Import CC Map';
    
    // File input element for importing (hidden)
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'cc-map-file';
    fileInput.style.display = 'none';
    fileInput.accept = '.json';
    
    // Add these elements to the help panel
    const helpActions = document.createElement('div');
    helpActions.className = 'help-actions';
    helpActions.appendChild(exportButton);
    helpActions.appendChild(importButton);
    helpActions.appendChild(fileInput);
    
    // Insert after learn status
    if (learnStatus.parentNode) {
        learnStatus.parentNode.insertBefore(helpActions, learnStatus.nextSibling);
    }
    
    // State for MIDI learning
    let isLearning = false;
    let learningParameter = null;
    let learningButton = null;
    
    // Toggle help panel visibility
    function toggleHelpPanel() {
        helpPanelElement.classList.toggle('active');
        if (helpPanelElement.classList.contains('active')) {
            updateMappingTable();
            
            // Create or update the CC Map Presets section
            let ccMapSection = document.getElementById('cc-map-presets-section');
            if (!ccMapSection) {
                // Create the section if it doesn't exist
                ccMapSection = document.createElement('div');
                ccMapSection.id = 'cc-map-presets-section';
                ccMapSection.className = 'cc-map-presets-section';
                ccMapSection.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
                ccMapSection.style.paddingTop = '15px';
                ccMapSection.style.marginTop = '20px';
                ccMapSection.style.marginBottom = '20px';
                
                // Create title
                const title = document.createElement('h3');
                title.textContent = 'MIDI CC Map Presets';
                title.style.fontSize = '1rem';
                title.style.marginBottom = '10px';
                title.style.color = '#ccc';
                ccMapSection.appendChild(title);
                
                // Create description
                const description = document.createElement('p');
                description.textContent = 'Save the current MIDI CC mappings as a named preset or load existing presets.';
                description.style.fontSize = '0.9em';
                description.style.marginBottom = '10px';
                description.style.color = '#aaa';
                ccMapSection.appendChild(description);
                
                // Create controls container
                const controls = document.createElement('div');
                controls.className = 'cc-map-preset-controls';
                controls.style.display = 'flex';
                controls.style.alignItems = 'center';
                controls.style.gap = '10px';
                controls.style.marginBottom = '15px';
                controls.style.flexWrap = 'wrap';
                
                // Add name input
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.id = 'cc-map-preset-name';
                nameInput.placeholder = 'Preset Name';
                nameInput.style.padding = '5px 10px';
                nameInput.style.borderRadius = '4px';
                nameInput.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                nameInput.style.backgroundColor = '#333';
                nameInput.style.color = '#fff';
                controls.appendChild(nameInput);
                
                // Add save button
                const saveButton = document.createElement('button');
                saveButton.textContent = 'Save CC Map';
                saveButton.className = 'secondary-button';
                saveButton.style.backgroundColor = '#4CAF50';
                saveButton.id = 'save-cc-map-preset';
                controls.appendChild(saveButton);
                
                // Add select for existing presets
                const presetSelect = document.createElement('select');
                presetSelect.id = 'cc-map-preset-select';
                presetSelect.style.minWidth = '150px';
                controls.appendChild(presetSelect);
                
                // Add load button
                const loadButton = document.createElement('button');
                loadButton.textContent = 'Load';
                loadButton.className = 'secondary-button';
                loadButton.id = 'load-cc-map-preset';
                controls.appendChild(loadButton);
                
                // Add delete button
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.className = 'secondary-button';
                deleteButton.style.backgroundColor = '#F44336';
                deleteButton.id = 'delete-cc-map-preset';
                controls.appendChild(deleteButton);
                
                ccMapSection.appendChild(controls);
                
                // Add to panel
                const helpPanelContent = document.querySelector('.help-panel-content');
                const keyboardShortcuts = document.querySelector('.keyboard-shortcuts');
                if (helpPanelContent && keyboardShortcuts) {
                    helpPanelContent.insertBefore(ccMapSection, keyboardShortcuts);
                }
            }
            
            // Update the CC Map presets dropdown
            updateCCMapPresetsDropdown();
        }
    }
    
    // Setup event listeners for help panel
    helpButton.addEventListener('click', toggleHelpPanel);
    closeHelpButton.addEventListener('click', toggleHelpPanel);
    
    // Also open help panel with M key
    window.addEventListener('keydown', (e) => {
        // Skip keyboard shortcuts if the event occurred in a text input, textarea, or select element
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        if (e.key.toLowerCase() === 'm') {
            toggleHelpPanel();
        }
    });
    
    // Function to update the mapping table
    function updateMappingTable() {
        // Clear existing rows
        mappingTable.innerHTML = '';
        
        // Add rows for each parameter
        AVAILABLE_PARAMETERS.forEach(paramConfig => {
            // For visualization-specific parameters, only show if the current visualization matches
            if (paramConfig.visualType && !isCurrentVisual(paramConfig.visualType)) {
                return; // Skip this parameter if it's for a different visualization
            }
            
            // Look for mappings where param and type matches
            const mappingEntries = Object.entries(MIDI_MAPPINGS).filter(([_, config]) => {
                // Check basic param match
                if (config.param !== paramConfig.param) return false;
                
                // For special actions, make sure they match
                if (config.param === 'special' && config.action !== paramConfig.action) return false;
                
                // For visualization-specific params, check the visualType too
                if (paramConfig.visualType && config.visualType !== paramConfig.visualType) return false;
                
                return true;
            });
            
            let ccNumber = '';
            if (mappingEntries.length > 0) {
                ccNumber = mappingEntries[0][0];
            }
            
            // Get current value (if applicable)
            let currentValue = '';
            let valuePercent = 0;
            
            // Check standard parameters
            if (paramConfig.param !== 'special' && visualEngine.params[paramConfig.param] !== undefined) {
                currentValue = visualEngine.params[paramConfig.param].toFixed(2);
                valuePercent = (visualEngine.params[paramConfig.param] * 100).toFixed(0);
                if (valuePercent > 100) valuePercent = 100;
                if (valuePercent < 0) valuePercent = 0;
            }
            // Check effect parameters in visualEngine
            else if (paramConfig.param !== 'special' && visualEngine.effectParams && 
                     visualEngine.effectParams[paramConfig.param] !== undefined) {
                currentValue = visualEngine.effectParams[paramConfig.param].toFixed(2);
                valuePercent = (visualEngine.effectParams[paramConfig.param] * 100).toFixed(0);
                if (valuePercent > 100) valuePercent = 100;
                if (valuePercent < 0) valuePercent = 0;
            }
            // Check effect parameters in webglEngine (for 3D effects)
            else if (paramConfig.param !== 'special' && webglEngine.effectParams && 
                     webglEngine.effectParams[paramConfig.param] !== undefined) {
                currentValue = webglEngine.effectParams[paramConfig.param].toFixed(2);
                valuePercent = (webglEngine.effectParams[paramConfig.param] * 100).toFixed(0);
                if (valuePercent > 100) valuePercent = 100;
                if (valuePercent < 0) valuePercent = 0;
            }
            
            // Create row
            const row = document.createElement('tr');
            
            // Parameter name
            const nameCell = document.createElement('td');
            nameCell.textContent = paramConfig.name;
            row.appendChild(nameCell);
            
            // CC Number
            const ccCell = document.createElement('td');
            ccCell.textContent = ccNumber || '-';
            row.appendChild(ccCell);
            
            // Value with progress bar
            const valueCell = document.createElement('td');
            
            // Special handling for 3D controls and visualization-specific parameters
            if (paramConfig.param === 'special' && paramConfig.action && paramConfig.action.startsWith('rotate3D')) {
                valueCell.textContent = 'Rotation Control';
            } else if (paramConfig.param === 'special' && paramConfig.action && paramConfig.action === 'translate3DZ') {
                valueCell.textContent = 'Position Control';
            } else if (paramConfig.param === 'special' && paramConfig.action && 
                      ['kaleidoscopeSymmetry', 'lissajousFreqRatio', 'voronoiCellSize', 
                       'tentacleCount', 'circuitComplexity', 'flowDirection'].includes(paramConfig.action)) {
                valueCell.textContent = 'Visual Parameter';
            } else if (paramConfig.param !== 'special') {
                const valueBar = document.createElement('div');
                valueBar.className = 'parameter-value';
                
                // Add data attribute to store parameter info for dragging
                valueBar.dataset.param = paramConfig.param;
                if (paramConfig.action) valueBar.dataset.action = paramConfig.action;
                if (paramConfig.min !== undefined) valueBar.dataset.min = paramConfig.min;
                if (paramConfig.max !== undefined) valueBar.dataset.max = paramConfig.max;
                if (paramConfig.integer !== undefined) valueBar.dataset.integer = paramConfig.integer;
                
                const bar = document.createElement('div');
                bar.className = 'value-bar';
                
                // Make bar draggable
                bar.style.cursor = 'pointer';
                
                const fill = document.createElement('div');
                fill.className = 'value-fill';
                fill.style.width = `${valuePercent}%`;
                bar.appendChild(fill);
                
                const valueText = document.createElement('div');
                valueText.className = 'value-text';
                valueText.textContent = currentValue;
                
                valueBar.appendChild(bar);
                valueBar.appendChild(valueText);
                valueCell.appendChild(valueBar);
                
                // Add event listeners for mouse interaction
                addDragHandlers(bar, valueBar, paramConfig);
            } else {
                valueCell.textContent = 'Action';
            }
            row.appendChild(valueCell);
            
            // Learn button
            const actionCell = document.createElement('td');
            const learnButton = document.createElement('button');
            learnButton.className = 'learn-button';
            learnButton.textContent = 'Learn';
            learnButton.dataset.param = paramConfig.param;
            if (paramConfig.action) {
                learnButton.dataset.action = paramConfig.action;
            }
            
            // Add properties from the paramConfig to the button's dataset
            if (paramConfig.min !== undefined) learnButton.dataset.min = paramConfig.min;
            if (paramConfig.max !== undefined) learnButton.dataset.max = paramConfig.max;
            if (paramConfig.integer !== undefined) learnButton.dataset.integer = paramConfig.integer;
            
            learnButton.addEventListener('click', startLearnMode);
            actionCell.appendChild(learnButton);
            row.appendChild(actionCell);
            
            // Add row to table
            mappingTable.appendChild(row);
        });
    }
    
    // Start MIDI learn mode for a parameter
    function startLearnMode(e) {
        // Cancel any existing learn mode
        cancelLearnMode();
        
        // Set learning state
        isLearning = true;
        learningButton = e.target;
        learningParameter = {
            param: e.target.dataset.param,
            action: e.target.dataset.action || undefined,
            name: e.target.closest('tr').querySelector('td').textContent,
            min: e.target.dataset.min ? parseFloat(e.target.dataset.min) : undefined,
            max: e.target.dataset.max ? parseFloat(e.target.dataset.max) : undefined,
            integer: e.target.dataset.integer === "true"
        };
        
        // Update UI
        learningButton.classList.add('learning');
        learningButton.textContent = 'Waiting...';
        learnStatus.textContent = `Move a MIDI controller to map to "${learningParameter.name}"`;
        cancelLearnButton.classList.remove('hidden');
        
        // Listen for next MIDI CC message
        midiController.once = function(callback) {
            const originalCallback = midiController.anyControlChangeCallback;
            
            // Set a one-time callback
            midiController.anyControlChangeCallback = (ccNumber, value) => {
                // Call original callback first
                if (originalCallback) {
                    originalCallback(ccNumber, value);
                }
                
                // Then our one-time handler
                callback(ccNumber, value);
                
                // Restore the original callback
                midiController.anyControlChangeCallback = originalCallback;
            };
        };
        
        // Listen for the next CC message
        midiController.once((ccNumber, value) => {
            if (!isLearning) return; // Just in case it was canceled
            
            // Create or update the mapping
            mapCCToParameter(ccNumber, learningParameter);
            
            // Exit learn mode
            cancelLearnMode();
            
            // Update the mapping table
            updateMappingTable();
        });
    }
    
    // Cancel MIDI learn mode
    function cancelLearnMode() {
        if (isLearning && learningButton) {
            learningButton.classList.remove('learning');
            learningButton.textContent = 'Learn';
        }
        
        isLearning = false;
        learningParameter = null;
        learningButton = null;
        learnStatus.textContent = 'Click "Learn" and move a controller to map it';
        cancelLearnButton.classList.add('hidden');
    }
    
    // Map a CC number to a parameter
    function mapCCToParameter(ccNumber, paramConfig) {
        // First, check if this CC is already mapped and remove it
        for (const cc in MIDI_MAPPINGS) {
            if (cc === ccNumber.toString()) {
                console.log(`Removing existing mapping for CC ${cc}`);
                delete MIDI_MAPPINGS[cc];
            }
        }
        
        // Add the new mapping
        MIDI_MAPPINGS[ccNumber] = {
            param: paramConfig.param,
            name: paramConfig.name
        };
        
        // Add additional properties
        if (paramConfig.action) MIDI_MAPPINGS[ccNumber].action = paramConfig.action;
        if (paramConfig.min !== undefined) MIDI_MAPPINGS[ccNumber].min = paramConfig.min;
        if (paramConfig.max !== undefined) MIDI_MAPPINGS[ccNumber].max = paramConfig.max;
        if (paramConfig.integer) MIDI_MAPPINGS[ccNumber].integer = paramConfig.integer;
        
        console.log(`Mapped CC ${ccNumber} to ${paramConfig.name}`);
        
        // Save mappings to localStorage
        saveMidiMappings();
    }
    
    // Setup the cancel button
    cancelLearnButton.addEventListener('click', cancelLearnMode);
    
    // Object to store CC Map presets
    let ccMapPresets = {};
    
    // Helper function to load CC Map presets from localStorage
    function loadCCMapPresets() {
        try {
            const storedPresets = localStorage.getItem('liveArtCCMapPresets');
            if (storedPresets) {
                ccMapPresets = JSON.parse(storedPresets);
                updateCCMapPresetsDropdown();
                console.log('Loaded CC Map presets from localStorage');
            }
        } catch (e) {
            console.warn('Failed to load CC Map presets:', e);
            ccMapPresets = {};
        }
    }
    
    // Helper function to save CC Map presets to localStorage
    function saveCCMapPresets() {
        try {
            localStorage.setItem('liveArtCCMapPresets', JSON.stringify(ccMapPresets));
            console.log('Saved CC Map presets to localStorage');
        } catch (e) {
            console.warn('Failed to save CC Map presets:', e);
        }
    }
    
    // Update the CC Map presets dropdown
    function updateCCMapPresetsDropdown() {
        const presetSelect = document.getElementById('cc-map-preset-select');
        if (!presetSelect) return;
        
        // Clear existing options
        presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';
        
        // Add preset options
        Object.keys(ccMapPresets).forEach(presetName => {
            const option = document.createElement('option');
            option.value = presetName;
            option.textContent = presetName;
            presetSelect.appendChild(option);
        });
    }
    
    // Load CC Map presets on startup
    loadCCMapPresets();
    
    // Setup event listeners for CC Map preset management
    document.addEventListener('click', function(e) {
        // Save CC Map preset
        if (e.target && e.target.id === 'save-cc-map-preset') {
            const nameInput = document.getElementById('cc-map-preset-name');
            if (!nameInput || !nameInput.value.trim()) {
                alert('Please enter a name for the CC Map preset');
                return;
            }
            
            const presetName = nameInput.value.trim();
            
            // Save the current mappings as a preset
            ccMapPresets[presetName] = {...MIDI_MAPPINGS};
            saveCCMapPresets();
            
            // Update the dropdown
            updateCCMapPresetsDropdown();
            
            // Reset the input
            nameInput.value = '';
            
            console.log(`Saved CC Map preset: ${presetName}`);
        }
        
        // Load CC Map preset
        if (e.target && e.target.id === 'load-cc-map-preset') {
            const presetSelect = document.getElementById('cc-map-preset-select');
            if (!presetSelect || !presetSelect.value) {
                alert('Please select a CC Map preset to load');
                return;
            }
            
            const presetName = presetSelect.value;
            if (!ccMapPresets[presetName]) return;
            
            // Apply the selected preset
            MIDI_MAPPINGS = {...ccMapPresets[presetName]};
            saveMidiMappings();
            
            // Update the mapping table
            updateMappingTable();
            
            console.log(`Loaded CC Map preset: ${presetName}`);
        }
        
        // Delete CC Map preset
        if (e.target && e.target.id === 'delete-cc-map-preset') {
            const presetSelect = document.getElementById('cc-map-preset-select');
            if (!presetSelect || !presetSelect.value) {
                alert('Please select a CC Map preset to delete');
                return;
            }
            
            const presetName = presetSelect.value;
            
            if (confirm(`Are you sure you want to delete the "${presetName}" CC Map preset?`)) {
                // Remove the preset
                delete ccMapPresets[presetName];
                saveCCMapPresets();
                
                // Update the dropdown
                updateCCMapPresetsDropdown();
                
                console.log(`Deleted CC Map preset: ${presetName}`);
            }
        }
    });
    }
    
    // Export MIDI mappings to a file
    // Only add the event listener if the button exists and is in the DOM
    document.addEventListener('DOMContentLoaded', () => {
        const exportButtonEl = document.getElementById('export-midi-map');
        if (exportButtonEl) {
            exportButtonEl.addEventListener('click', () => {
        try {
            // Create a JSON blob with the MIDI mappings
            const mappingsJson = JSON.stringify(MIDI_MAPPINGS, null, 2);
            const blob = new Blob([mappingsJson], { type: 'application/json' });
            
            // Create a download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'liveart-midi-mappings.json';
            
            // Trigger the download
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log('Exported MIDI mappings to file');
        } catch (e) {
            console.error('Failed to export MIDI mappings:', e);
            alert('Error exporting MIDI mappings: ' + e.message);
        }
            });
        }
    });
    
    // Import MIDI mappings from a file
    document.addEventListener('DOMContentLoaded', () => {
        const importButtonEl = document.getElementById('import-midi-map');
        if (importButtonEl) {
            importButtonEl.addEventListener('click', () => {
                // Trigger the file input
                const fileInputEl = document.getElementById('cc-map-file');
                if (fileInputEl) {
                    fileInputEl.click();
                }
            });
        }
        
        // Handle file selection
        const fileInputEl = document.getElementById('cc-map-file');
        if (fileInputEl) {
            fileInputEl.addEventListener('change', (e) => {
        if (!e.target.files || !e.target.files[0]) return;
        
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                // Parse the file contents
                const mappings = JSON.parse(event.target.result);
                
                // Validate the mappings (basic check)
                if (typeof mappings !== 'object' || mappings === null) {
                    throw new Error('Invalid MIDI mappings format');
                }
                
                // Ask for confirmation
                if (confirm('This will replace your current MIDI mappings. Continue?')) {
                    // Apply the mappings
                    MIDI_MAPPINGS = mappings;
                    saveMidiMappings();
                    
                    // Update the mapping table
                    updateMappingTable();
                    
                    console.log('Imported MIDI mappings from file');
                }
            } catch (e) {
                console.error('Failed to import MIDI mappings:', e);
                alert('Error importing MIDI mappings: ' + e.message);
            }
            
            // Reset the file input so the same file can be selected again
            fileInputEl.value = '';
        };
        
        reader.readAsText(file);
        });
        }
    });
    
    // Update mapping table with live values
    function updateMappingValues() {
        if (!helpPanelElement.classList.contains('active')) return;
        
        // Get mapping table reference
        const mappingTable = document.getElementById('midi-mapping-table')?.querySelector('tbody');
        if (!mappingTable) return;
        
        // Find value bars and update them
        const rows = mappingTable.querySelectorAll('tr');
        rows.forEach(row => {
            const paramName = row.querySelector('td').textContent;
            const param = AVAILABLE_PARAMETERS.find(p => p.name === paramName)?.param;
            
            if (!param || param === 'special') return;
            
            const valueCell = row.querySelector('.parameter-value');
            if (!valueCell) return;
            
            const fill = valueCell.querySelector('.value-fill');
            const text = valueCell.querySelector('.value-text');
            if (!fill || !text) return;
            
            let value;
            let found = false;
            
            // Check standard parameters
            if (visualEngine.params[param] !== undefined) {
                value = visualEngine.params[param];
                found = true;
            }
            // Check visualEngine effect parameters
            else if (visualEngine.effectParams && visualEngine.effectParams[param] !== undefined) {
                value = visualEngine.effectParams[param];
                found = true;
            }
            // Check webglEngine effect parameters
            else if (webglEngine.effectParams && webglEngine.effectParams[param] !== undefined) {
                value = webglEngine.effectParams[param];
                found = true;
            }
            // Check 3D transform parameters directly on webglEngine
            else if (['rotationX', 'rotationY', 'translationZ'].includes(param) && 
                     webglEngine[param] !== undefined) {
                value = webglEngine[param];
                found = true;
            }
            
            if (found) {
                let valuePercent = (value * 100).toFixed(0);
                if (valuePercent > 100) valuePercent = 100;
                if (valuePercent < 0) valuePercent = 0;
                
                fill.style.width = `${valuePercent}%`;
                text.textContent = value.toFixed(2);
            }
        });
    }
    
    /**
     * Add drag handlers to parameter bars
     * @param {HTMLElement} barElement - The value bar element
     * @param {HTMLElement} valueBarContainer - The container with parameter data
     * @param {Object} paramConfig - Parameter configuration
     */
    function addDragHandlers(barElement, valueBarContainer, paramConfig) {
        let isDragging = false;
        
        // Update the parameter value based on click/drag position
        function updateValueFromEvent(e) {
            // Calculate position within the bar (0-1)
            const rect = barElement.getBoundingClientRect();
            let percent = (e.clientX - rect.left) / rect.width;
            
            // Clamp to 0-1 range
            percent = Math.max(0, Math.min(1, percent));
            
            // Apply parameter mapping based on min/max if available
            let mappedValue = percent;
            if (valueBarContainer.dataset.min !== undefined && valueBarContainer.dataset.max !== undefined) {
                const min = parseFloat(valueBarContainer.dataset.min);
                const max = parseFloat(valueBarContainer.dataset.max);
                mappedValue = min + percent * (max - min);
            }
            
            // Convert to integer if specified
            if (valueBarContainer.dataset.integer === "true") {
                mappedValue = Math.round(mappedValue);
            }
            
            // Get parameter name and type
            const param = valueBarContainer.dataset.param;
            const isSpecial = param === 'special';
            const action = valueBarContainer.dataset.action;
            
            // Apply the value to the appropriate engine
            if (isSpecial) {
                // Handle special parameter actions
                // This would handle things like visualization-specific parameters
                switch (action) {
                    case 'kaleidoscopeSymmetry':
                        if (isCurrentVisual('kaleidoscope')) {
                            visualEngine.setParam('symmetry', Math.round(mappedValue));
                        }
                        break;
                    case 'lissajousFreqRatio':
                        if (isCurrentVisual('lissajous')) {
                            visualEngine.setParam('complexity', mappedValue/8);
                        }
                        break;
                    case 'voronoiCellSize':
                        if (isCurrentVisual('voronoi')) {
                            visualEngine.setParam('size', mappedValue);
                        }
                        break;
                    case 'tentacleCount':
                        if (isCurrentVisual('tentacles')) {
                            visualEngine.setParam('density', mappedValue/20);
                        }
                        break;
                    case 'circuitComplexity':
                        if (isCurrentVisual('circuitBoard')) {
                            visualEngine.setParam('complexity', mappedValue);
                        }
                        break;
                    case 'flowDirection':
                        if (isCurrentVisual('pixelFlow')) {
                            visualEngine.setParam('rotation', percent); // Use original percentage
                        }
                        break;
                }
            } else {
                // Handle regular parameters
                if (isWebGL) {
                    webglEngine.setParam(param, mappedValue);
                } else {
                    visualEngine.setParam(param, mappedValue);
                }
            }
            
            // Update the visual appearance of the bar
            const fill = barElement.querySelector('.value-fill');
            const text = valueBarContainer.querySelector('.value-text');
            
            if (fill && text) {
                fill.style.width = `${percent * 100}%`;
                text.textContent = mappedValue.toFixed(2);
            }
            
            // Save settings (throttled)
            if (!window.paramDragSaveTimeout) {
                window.paramDragSaveTimeout = setTimeout(() => {
                    saveCurrentSettings();
                    window.paramDragSaveTimeout = null;
                }, 500);
            }
        }
        
        // Mouse down event - start dragging
        barElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            document.body.style.userSelect = 'none'; // Prevent text selection during drag
            updateValueFromEvent(e);
            e.preventDefault();
            
            // Create unique ID for this drag instance
            const dragId = Math.random().toString(36).substring(2, 9);
            barElement._dragId = dragId;
            
            // Define handlers for this specific drag session
            const mouseMoveHandler = (e) => {
                if (isDragging && barElement._dragId === dragId) {
                    updateValueFromEvent(e);
                    e.preventDefault();
                }
            };
            
            const mouseUpHandler = () => {
                if (isDragging && barElement._dragId === dragId) {
                    isDragging = false;
                    document.body.style.userSelect = ''; // Restore text selection
                    
                    // Force a save when dragging is complete
                    saveCurrentSettings();
                    
                    // Clean up event listeners
                    document.removeEventListener('mousemove', mouseMoveHandler);
                    document.removeEventListener('mouseup', mouseUpHandler);
                }
            };
            
            // Add temporary event listeners
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
        
        // Click event for immediate updates (without drag)
        barElement.addEventListener('click', (e) => {
            updateValueFromEvent(e);
            e.stopPropagation();
        });
        
        // Touch events for mobile support
        barElement.addEventListener('touchstart', (e) => {
            isDragging = true;
            document.body.style.userSelect = 'none';
            const touch = e.touches[0];
            
            // Create a synthetic mouse event with clientX/clientY properties
            updateValueFromEvent({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            e.preventDefault();
            
            // Create unique ID for this touch drag instance
            const touchDragId = Math.random().toString(36).substring(2, 9);
            barElement._touchDragId = touchDragId;
            
            // Define handlers for this specific touch session
            const touchMoveHandler = (e) => {
                if (isDragging && barElement._touchDragId === touchDragId) {
                    const touch = e.touches[0];
                    // Create a synthetic mouse event
                    updateValueFromEvent({
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                    e.preventDefault();
                }
            };
            
            const touchEndHandler = () => {
                if (isDragging && barElement._touchDragId === touchDragId) {
                    isDragging = false;
                    document.body.style.userSelect = '';
                    saveCurrentSettings();
                    
                    // Clean up event listeners when done
                    document.removeEventListener('touchmove', touchMoveHandler);
                    document.removeEventListener('touchend', touchEndHandler);
                    document.removeEventListener('touchcancel', touchEndHandler);
                }
            };
            
            // Add temporary touch event listeners
            document.addEventListener('touchmove', touchMoveHandler);
            document.addEventListener('touchend', touchEndHandler);
            document.addEventListener('touchcancel', touchEndHandler);
        });
    }
    
    // Periodically update values in the mapping table
    setInterval(updateMappingValues, 100);
    
    // Add a help message for users
    console.info(
        'LiveArt VJ Tool\n' +
        '----------------\n' +
        'Connect a MIDI controller to control visuals\n' +
        'Default mappings: CCs 1-13 control various parameters\n' +
        'Special controls: CC14 = Randomize, CC15 = Next Preset\n' +
        '\nKeyboard Controls:\n' +
        '1-9: Increase parameters (Shift+1-9 to decrease)\n' +
        'Space: Randomize parameters\n' +
        'Arrow keys: Change visual preset\n' +
        'F: Toggle fullscreen\n' +
        'H: Hide/show controls\n' +
        'M: Show MIDI mappings\n' +
        'L: Toggle LIVE MODE (hide all UI for projection)\n' +
        'X/Y/Z: 3D rotation/translation (with Shift for larger steps)\n' +
        'R: Reset 3D transformations\n' +
        '\nPresets & Settings:\n' +
        '- Settings are automatically saved and restored\n' +
        '- Use Save/Load buttons to create named presets\n' +
        '- In the MIDI mapping panel, you can drag the sliders to change values\n' +
        '- MIDI CC Maps can be saved as presets in the mapping panel\n' +
        '- Export/Import CC Maps to files for sharing or backup\n' +
        '\nMouse/Touch:\n' +
        'Double-click: Toggle fullscreen\n' +
        'Touch: X = hue, Y = brightness\n' +
        'Pinch: Zoom and rotation\n' +
        'Drag parameter sliders: Directly adjust values without MIDI\n'
    );
});