/**
 * Settings Module
 * Manages application settings and persistence
 */

import LiveArt from '../index.js';
import events from './events.js';

class SettingsManager {
    constructor() {
        // Default settings
        this.defaults = {
            // Visual parameters
            params: {
                hue: 0.65,          // Cool blue default
                saturation: 0.85,   // Vivid colors
                brightness: 0.95,   // Bright visuals
                density: 0.7,       // More elements
                complexity: 0.65,   // Moderately complex
                reactivity: 0.7,    // Responsive to changes
                zoom: 1.1,          // Slightly zoomed in
                noiseScale: 0.02,   // Good noise scale
                speed: 0.2,         // Animation speed
                size: 0.5,          // Element size
                rotation: 0.1,      // Rotation speed
                symmetry: 6,        // Symmetry factor
                smoothing: 0.5      // Parameter smoothing
            },
            
            // Visual presets
            presets: {},
            
            // MIDI settings
            midi: {
                mappings: {},
                presets: {}
            },
            
            // Audio settings
            audio: {
                selectedSourceId: null,
                bufferSize: 512,
                freqMapping: {
                    enabled: false,
                    sensitivity: 0.5,
                    smoothing: 0.7,
                    mappings: []
                }
            },
            
            // UI settings
            ui: {
                controlsTimeout: 3000,
                showFPS: true,
                liveMode: false
            }
        };
        
        // Current settings (cloned from defaults)
        this.current = JSON.parse(JSON.stringify(this.defaults));
        
        // Initialize settings
        this.init();
    }
    
    /**
     * Initialize settings
     */
    init() {
        this.loadFromStorage();
    }
    
    /**
     * Load settings from localStorage
     */
    loadFromStorage() {
        try {
            // Load general settings
            const storedSettings = localStorage.getItem('liveArtSettings');
            if (storedSettings) {
                const parsedSettings = JSON.parse(storedSettings);
                this.mergeSettings(parsedSettings);
                LiveArt.log('Settings loaded from storage');
            }
            
            // Load user presets
            const userPresets = localStorage.getItem('liveArtUserPresets');
            if (userPresets) {
                this.current.presets = JSON.parse(userPresets);
                LiveArt.log('User presets loaded from storage');
            }
            
            // Load MIDI mappings
            const midiMappings = localStorage.getItem('liveArtMidiMappings');
            if (midiMappings) {
                this.current.midi.mappings = JSON.parse(midiMappings);
                LiveArt.log('MIDI mappings loaded from storage');
            }
            
            // Load MIDI presets
            const midiPresets = localStorage.getItem('liveArtMidiPresets');
            if (midiPresets) {
                this.current.midi.presets = JSON.parse(midiPresets);
                LiveArt.log('MIDI presets loaded from storage');
            }
            
            // Load audio settings
            const audioSettings = localStorage.getItem('liveArtAudioSettings');
            if (audioSettings) {
                this.current.audio = JSON.parse(audioSettings);
                LiveArt.log('Audio settings loaded from storage');
            }
            
            // Notify that settings are loaded
            events.trigger('settings:loaded', this.current);
            
            return true;
        } catch (error) {
            LiveArt.log(`Error loading settings: ${error.message}`, 'error');
            console.error(error);
            return false;
        }
    }
    
    /**
     * Save current settings to localStorage
     */
    saveToStorage() {
        try {
            // Save general settings
            localStorage.setItem('liveArtSettings', JSON.stringify({
                params: this.current.params,
                ui: this.current.ui
            }));
            
            // Save user presets separately
            localStorage.setItem('liveArtUserPresets', JSON.stringify(this.current.presets));
            
            // Save MIDI mappings separately
            localStorage.setItem('liveArtMidiMappings', JSON.stringify(this.current.midi.mappings));
            
            // Save MIDI presets separately
            localStorage.setItem('liveArtMidiPresets', JSON.stringify(this.current.midi.presets));
            
            // Save audio settings separately
            localStorage.setItem('liveArtAudioSettings', JSON.stringify(this.current.audio));
            
            // Notify that settings are saved
            events.trigger('settings:saved', this.current);
            
            return true;
        } catch (error) {
            LiveArt.log(`Error saving settings: ${error.message}`, 'error');
            console.error(error);
            return false;
        }
    }
    
    /**
     * Reset settings to defaults
     * @param {boolean} save - Whether to save after resetting
     */
    reset(save = true) {
        this.current = JSON.parse(JSON.stringify(this.defaults));
        
        // Notify that settings are reset
        events.trigger('settings:reset', this.current);
        
        if (save) {
            this.saveToStorage();
        }
    }
    
    /**
     * Merge settings with current settings
     * @param {object} settings - Settings to merge
     */
    mergeSettings(settings) {
        // Deep merge settings
        this.deepMerge(this.current, settings);
    }
    
    /**
     * Deep merge objects
     * @param {object} target - Target object
     * @param {object} source - Source object
     * @returns {object} Merged object
     */
    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }
    
    /**
     * Get a setting value
     * @param {string} path - Path to the setting (e.g. 'params.hue')
     * @param {any} defaultValue - Default value if setting is not found
     * @returns {any} Setting value
     */
    get(path, defaultValue = null) {
        const parts = path.split('.');
        let current = this.current;
        
        for (const part of parts) {
            if (current === undefined || current === null) {
                return defaultValue;
            }
            current = current[part];
        }
        
        return current !== undefined ? current : defaultValue;
    }
    
    /**
     * Set a setting value
     * @param {string} path - Path to the setting (e.g. 'params.hue')
     * @param {any} value - Value to set
     * @param {boolean} save - Whether to save after setting
     * @param {boolean} notify - Whether to trigger an event
     */
    set(path, value, save = true, notify = true) {
        const parts = path.split('.');
        const lastPart = parts.pop();
        let current = this.current;
        
        // Navigate to the correct object
        for (const part of parts) {
            if (current[part] === undefined) {
                current[part] = {};
            }
            current = current[part];
        }
        
        // Set the value
        current[lastPart] = value;
        
        // Notify about the change
        if (notify) {
            events.trigger('settings:changed', { path, value });
        }
        
        // Save if requested
        if (save) {
            this.saveToStorage();
        }
    }
    
    /**
     * Get the current parameter values
     * @returns {object} Current parameters
     */
    getParams() {
        return { ...this.current.params };
    }
    
    /**
     * Set a parameter value
     * @param {string} name - Parameter name
     * @param {number} value - Parameter value
     * @param {boolean} save - Whether to save after setting
     */
    setParam(name, value, save = true) {
        this.set(`params.${name}`, value, save);
    }
    
    /**
     * Get presets
     * @returns {object} Presets
     */
    getPresets() {
        return { ...this.current.presets };
    }
    
    /**
     * Save current parameters as a preset
     * @param {string} name - Preset name
     */
    savePreset(name) {
        this.current.presets[name] = { ...this.current.params };
        this.saveToStorage();
        events.trigger('settings:presetSaved', name);
    }
    
    /**
     * Load a preset
     * @param {string} name - Preset name
     */
    loadPreset(name) {
        if (this.current.presets[name]) {
            this.current.params = { ...this.current.presets[name] };
            this.saveToStorage();
            events.trigger('settings:presetLoaded', name);
        }
    }
    
    /**
     * Delete a preset
     * @param {string} name - Preset name
     */
    deletePreset(name) {
        if (this.current.presets[name]) {
            delete this.current.presets[name];
            this.saveToStorage();
            events.trigger('settings:presetDeleted', name);
        }
    }
    
    /**
     * Save audio settings
     * @param {object} settings - Audio settings
     */
    saveAudioSettings(settings) {
        this.current.audio = { ...settings };
        this.saveToStorage();
        events.trigger('settings:audioSettingsSaved', this.current.audio);
    }
    
    /**
     * Get audio settings
     * @returns {object} Audio settings
     */
    getAudioSettings() {
        return { ...this.current.audio };
    }
    
    /**
     * Save MIDI mappings
     * @param {object} mappings - MIDI mappings
     */
    saveMidiMappings(mappings) {
        this.current.midi.mappings = { ...mappings };
        this.saveToStorage();
        events.trigger('settings:midiMappingsSaved', this.current.midi.mappings);
    }
    
    /**
     * Get MIDI mappings
     * @returns {object} MIDI mappings
     */
    getMidiMappings() {
        return { ...this.current.midi.mappings };
    }
}

// Create the settings manager instance
const settings = new SettingsManager();

// Register as a module
LiveArt.registerModule('settings', settings);

export default settings;