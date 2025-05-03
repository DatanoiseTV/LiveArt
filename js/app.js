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
            
            // Create settings object
            const settings = {
                visualType: visualType,
                params: params,
                isWebGL: isWebGL
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
        
        // Create preset object
        userPresets[presetName] = {
            visualType: visualType,
            params: params,
            isWebGL: isWebGL
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
            webglEngine.loadScene(webglSceneName);
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
                speed: 0.2,         // Reduced from 0.4
                size: 0.5,
                complexity: 0.6,
                symmetry: 6,
                reactivity: 0.7,
                rotation: 0.1       // Added explicit rotation
            },
            waves: {
                hue: 0.3,           // Green
                saturation: 0.7,
                brightness: 0.9,
                density: 0.6,
                speed: 0.5,
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
                speed: 0.3,
                size: 0.6,
                complexity: 0.5,
                noiseScale: 0.02,
                reactivity: 0.5
            },
            fractals: {
                hue: 0.8,           // Purple
                saturation: 0.9,
                brightness: 0.85,
                density: 0.4,
                speed: 0.2,
                size: 0.7,
                complexity: 0.8,
                rotation: 0.4,
                reactivity: 0.6
            },
            audioReactive: {
                hue: 0.55,          // Cyan
                saturation: 0.85,
                brightness: 0.9,
                density: 0.7,
                speed: 0.4,
                size: 0.6,
                complexity: 0.7,
                reactivity: 0.9
            },
            fluidDynamics: {
                hue: 0.7,           // Blue-purple
                saturation: 0.75,
                brightness: 0.85,
                density: 0.6,
                speed: 0.35,
                size: 0.4,
                complexity: 0.65,
                reactivity: 0.8
            },
            neonGrid: {
                hue: 0.9,           // Pink
                saturation: 0.9,
                brightness: 0.95,
                density: 0.5,
                speed: 0.3,
                size: 0.5,
                complexity: 0.7,
                rotation: 0.3,
                reactivity: 0.7
            },
            galaxies: {
                hue: 0.7,           // Purple
                saturation: 0.8,
                brightness: 0.85,
                density: 0.8,
                speed: 0.25,
                size: 0.6,
                complexity: 0.6,
                reactivity: 0.65
            },
            
            // 3D WebGL Visuals
            'webgl-cubeField': {
                hue: 0.6,           // Blue
                saturation: 0.8,
                brightness: 0.9,
                density: 0.6,
                speed: 0.4,
                size: 0.5,
                complexity: 0.7,
                rotation: 0.2,
                zoom: 0.6,
                reactivity: 0.7
            },
            'webgl-tunnelEffect': {
                hue: 0.85,          // Pink
                saturation: 0.9,
                brightness: 0.95,
                density: 0.7,
                speed: 0.5,
                size: 0.6,
                complexity: 0.8,
                rotation: 0.3,
                zoom: 0.4,
                reactivity: 0.8
            },
            'webgl-particleSystem': {
                hue: 0.15,          // Yellow-orange
                saturation: 0.9,
                brightness: 0.9,
                density: 0.8,
                speed: 0.35,
                size: 0.4,
                complexity: 0.65,
                rotation: 0.1,
                zoom: 0.5,
                reactivity: 0.7
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
        12: { param: 'symmetry', name: 'Symmetry', min: 1, max: 8, integer: true },
        13: { param: 'reactivity', name: 'Reactivity' },
        
        // Special controls
        14: { param: 'special', name: 'Randomize', action: 'randomize' },
        15: { param: 'special', name: 'Next Preset', action: 'nextPreset' }
    };
    
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
        { param: 'symmetry', name: 'Symmetry', min: 1, max: 8, integer: true },
        { param: 'reactivity', name: 'Reactivity' },
        { param: 'special', name: 'Randomize', action: 'randomize' },
        { param: 'special', name: 'Next Preset', action: 'nextPreset' }
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
    
    // Function to cycle to next preset
    function nextPreset() {
        const presetSelect = document.getElementById('visual-preset');
        const options = presetSelect.options;
        let currentIndex = presetSelect.selectedIndex;
        let nextIndex = (currentIndex + 1) % options.length;
        
        presetSelect.selectedIndex = nextIndex;
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
    const helpPanel = document.getElementById('help-panel');
    const helpButton = document.getElementById('help-button');
    const closeHelpButton = document.getElementById('close-help');
    const mappingTable = document.getElementById('midi-mapping-table').querySelector('tbody');
    const learnStatus = document.getElementById('learn-status');
    const cancelLearnButton = document.getElementById('cancel-learn');
    
    // State for MIDI learning
    let isLearning = false;
    let learningParameter = null;
    let learningButton = null;
    
    // Toggle help panel visibility
    function toggleHelpPanel() {
        helpPanel.classList.toggle('active');
        if (helpPanel.classList.contains('active')) {
            updateMappingTable();
        }
    }
    
    // Setup event listeners for help panel
    helpButton.addEventListener('click', toggleHelpPanel);
    closeHelpButton.addEventListener('click', toggleHelpPanel);
    
    // Also open help panel with M key
    window.addEventListener('keydown', (e) => {
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
            // Look for mappings where param matches
            const mappingEntries = Object.entries(MIDI_MAPPINGS).filter(
                ([_, config]) => config.param === paramConfig.param && 
                (config.action === undefined || config.action === paramConfig.action)
            );
            
            let ccNumber = '';
            if (mappingEntries.length > 0) {
                ccNumber = mappingEntries[0][0];
            }
            
            // Get current value (if applicable)
            let currentValue = '';
            let valuePercent = 0;
            if (paramConfig.param !== 'special' && visualEngine.params[paramConfig.param] !== undefined) {
                currentValue = visualEngine.params[paramConfig.param].toFixed(2);
                valuePercent = (visualEngine.params[paramConfig.param] * 100).toFixed(0);
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
            if (paramConfig.param !== 'special') {
                const valueBar = document.createElement('div');
                valueBar.className = 'parameter-value';
                
                const bar = document.createElement('div');
                bar.className = 'value-bar';
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
    
    // Update mapping table with live values
    function updateMappingValues() {
        if (!helpPanel.classList.contains('active')) return;
        
        // Find value bars and update them
        const rows = mappingTable.querySelectorAll('tr');
        rows.forEach(row => {
            const paramName = row.querySelector('td').textContent;
            const param = AVAILABLE_PARAMETERS.find(p => p.name === paramName)?.param;
            
            if (param && param !== 'special' && visualEngine.params[param] !== undefined) {
                const valueCell = row.querySelector('.parameter-value');
                if (valueCell) {
                    const fill = valueCell.querySelector('.value-fill');
                    const text = valueCell.querySelector('.value-text');
                    
                    const value = visualEngine.params[param];
                    let valuePercent = (value * 100).toFixed(0);
                    if (valuePercent > 100) valuePercent = 100;
                    if (valuePercent < 0) valuePercent = 0;
                    
                    fill.style.width = `${valuePercent}%`;
                    text.textContent = value.toFixed(2);
                }
            }
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
        '\nPresets & Settings:\n' +
        '- Settings are automatically saved and restored\n' +
        '- Use Save/Load buttons to create named presets\n' +
        '\nMouse/Touch:\n' +
        'Double-click: Toggle fullscreen\n' +
        'Touch: X = hue, Y = brightness\n' +
        'Pinch: Zoom and rotation\n'
    );
});