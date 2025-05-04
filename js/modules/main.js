/**
 * LiveArt - Main Entry Point
 * Initializes all modules and starts the application
 */

// Import core modules
import LiveArt from './index.js';
import events from './core/events.js';
import settings from './core/settings.js';
import utils from './core/utils.js';
import engine from './core/engine.js';

// Import audio modules
import audioEngine from './audio/audio-engine.js';
import frequencyMapper from './audio/frequency-mapping.js';

// Import MIDI modules
import midiController from './midi/midi-controller.js';
import midiMapping from './midi/midi-mapping.js';

// Import UI modules
import uiManager from './ui/ui-manager.js';
import frequencyVisualizer from './ui/frequency-visualizer.js';

// Import visual modules
import VisualEngine from './visuals/visual-engine.js';
import OscilloscopeVisualizer from './visuals/oscilloscope.js';
import AudioReactiveVisualizer from './visuals/audio-reactive.js';
import WebGLEngine from './webgl/webgl-engine.js';

// Set debug mode based on URL parameter
const urlParams = new URLSearchParams(window.location.search);
const debugMode = urlParams.has('debug');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Show loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading-indicator';
    loadingEl.innerHTML = 'Initializing LiveArt...';
    document.body.appendChild(loadingEl);
    
    try {
        // Initialize LiveArt with options
        LiveArt.init({
            debugMode
        });
        
        // Initialize visual engines with error handling
        try {
            const visualEngine = new VisualEngine('canvas-2d');
            if (!visualEngine.init()) {
                throw new Error('Failed to initialize 2D visual engine');
            }
            LiveArt.log('2D visual engine initialized successfully');
            
            // Initialize visualizations
            const oscilloscope = new OscilloscopeVisualizer(visualEngine);
            oscilloscope.init();
            
            const audioReactive = new AudioReactiveVisualizer(visualEngine);
            audioReactive.init();
            
            // Set initial visualization
            const initialVisual = 'oscilloscope';
            events.trigger('engine:visualChanged', {
                visualId: initialVisual,
                isWebGL: false
            });
        } catch (error) {
            LiveArt.log(`Error initializing 2D engine: ${error.message}`, 'error');
            console.error('2D engine error:', error);
        }
        
        try {
            const webglEngine = new WebGLEngine('container-3d');
            if (!webglEngine.init()) {
                throw new Error('Failed to initialize WebGL engine');
            }
            LiveArt.log('WebGL engine initialized successfully');
            
            // WebGL visualizations would be initialized here
            
        } catch (error) {
            LiveArt.log(`Error initializing WebGL engine: ${error.message}`, 'error');
            console.error('WebGL engine error:', error);
        }
        
        // Log initialization complete
        LiveArt.log('LiveArt initialized successfully!');
        
        // Remove loading indicator after a short delay
        setTimeout(() => {
            if (loadingEl.parentNode) {
                loadingEl.parentNode.removeChild(loadingEl);
            }
        }, 500);
    } catch (error) {
        console.error('Error initializing LiveArt:', error);
        
        // Show error in loading indicator
        loadingEl.className = 'loading-indicator error';
        loadingEl.innerHTML = `Error initializing LiveArt: ${error.message}`;
    }
});

// Export for old code compatibility
window.LiveArt = LiveArt;