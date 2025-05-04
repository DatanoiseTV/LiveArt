/**
 * UI Manager Module
 * Manages the user interface components
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import settings from '../core/settings.js';
import utils from '../core/utils.js';

class UIManager {
    constructor() {
        // UI elements
        this.elements = {
            container: null,
            controls: null,
            presetSelector: null,
            midiPortSelector: null,
            fps: null,
            helpPanel: null,
            audioSettingsPanel: null
        };
        
        // UI state
        this.state = {
            controlsVisible: true,
            liveMode: false,
            controlsTimeout: null,
            controlsTimeoutDuration: 3000,
            helpPanelVisible: false,
            audioSettingsPanelVisible: false,
            mappingPanelVisible: false
        };
        
        // Bind methods
        this.handleParameterChanged = this.handleParameterChanged.bind(this);
        this.handleMIDIActivity = this.handleMIDIActivity.bind(this);
        this.handleFPSUpdate = this.handleFPSUpdate.bind(this);
    }
    
    /**
     * Initialize the UI manager
     */
    init() {
        LiveArt.log('Initializing UI manager...');
        
        // Get UI elements
        this.initElements();
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Set up UI based on settings
        this.applySettings();
        
        LiveArt.log('UI manager initialized');
    }
    
    /**
     * Initialize UI elements
     */
    initElements() {
        // Main container
        this.elements.container = document.querySelector('.container');
        
        // Controls
        this.elements.controls = document.querySelector('.controls');
        this.elements.presetSelector = document.querySelector('#preset-select');
        this.elements.midiPortSelector = document.querySelector('#midi-port');
        this.elements.fps = document.querySelector('#fps');
        
        // Panels
        this.elements.helpPanel = document.querySelector('#help-panel');
        this.elements.audioSettingsPanel = document.querySelector('#audio-settings-panel');
        this.elements.mappingPanel = document.querySelector('#mapping-panel');
        
        // Add additional elements as needed
    }
    
    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Listen for parameter changes
        events.on('parameter:changed', this.handleParameterChanged, this);
        events.on('parameter:influenced', this.handleParameterChanged, this);
        
        // Listen for MIDI activity
        events.on('midiMapping:activity', this.handleMIDIActivity, this);
        
        // Listen for FPS updates
        events.on('engine:animate', this.handleFPSUpdate, this);
        
        // Listen for settings changes
        events.on('settings:changed', this.handleSettingsChanged, this);
        
        // Add document event listeners
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Initialize control toggle
        const showControlsButton = document.querySelector('.show-controls-button');
        if (showControlsButton) {
            showControlsButton.addEventListener('click', () => this.toggleControls());
        }
        
        // Initialize panel toggles
        this.initPanelToggles();
        
        // Listen for mouse movement to show controls
        document.addEventListener('mousemove', () => this.resetControlsTimeout());
    }
    
    /**
     * Initialize panel toggle buttons
     */
    initPanelToggles() {
        // Help panel
        const helpButton = document.querySelector('.help-button');
        const helpCloseButton = document.querySelector('#help-panel .close-panel');
        
        if (helpButton && helpCloseButton) {
            helpButton.addEventListener('click', () => this.toggleHelpPanel());
            helpCloseButton.addEventListener('click', () => this.toggleHelpPanel());
        }
        
        // Audio settings panel
        const audioSettingsButton = document.querySelector('.audio-settings-button');
        const audioSettingsCloseButton = document.querySelector('#audio-settings-panel .close-panel');
        
        if (audioSettingsButton && audioSettingsCloseButton) {
            audioSettingsButton.addEventListener('click', () => this.toggleAudioSettingsPanel());
            audioSettingsCloseButton.addEventListener('click', () => this.toggleAudioSettingsPanel());
        }
    }
    
    /**
     * Apply settings to UI
     */
    applySettings() {
        // Get UI settings
        const uiSettings = settings.get('ui', {
            controlsTimeout: 3000,
            showFPS: true,
            liveMode: false
        });
        
        // Apply settings
        this.state.controlsTimeoutDuration = uiSettings.controlsTimeout;
        this.state.liveMode = uiSettings.liveMode;
        
        // Apply live mode if active
        if (this.state.liveMode) {
            this.enableLiveMode();
        }
    }
    
    /**
     * Handle parameter changes
     * @param {object} data - Parameter change data
     */
    handleParameterChanged(data) {
        const { param, value, source } = data;
        
        // Update parameter UI (if any)
        const paramElement = document.querySelector(`[data-param="${param}"]`);
        
        if (paramElement) {
            // Update the UI value
            paramElement.value = value;
            
            // Add active class for visual feedback
            paramElement.classList.add('active');
            
            // Remove active class after animation completes
            setTimeout(() => {
                paramElement.classList.remove('active');
            }, 300);
        }
    }
    
    /**
     * Handle MIDI activity
     * @param {object} data - MIDI activity data
     */
    handleMIDIActivity(data) {
        const { param, value } = data;
        
        // Find activity indicator for this parameter
        const activityIndicator = document.querySelector(`[data-param-activity="${param}"]`);
        
        if (activityIndicator) {
            // Add active class for visual feedback
            activityIndicator.classList.add('active');
            
            // Remove active class after animation completes
            setTimeout(() => {
                activityIndicator.classList.remove('active');
            }, 300);
        }
    }
    
    /**
     * Handle FPS updates
     * @param {object} data - Animation data
     */
    handleFPSUpdate(data) {
        const { fps } = data;
        
        // Update FPS counter if visible
        if (this.elements.fps) {
            this.elements.fps.textContent = Math.round(fps);
        }
    }
    
    /**
     * Handle settings changes
     * @param {object} data - Settings change data
     */
    handleSettingsChanged(data) {
        const { path, value } = data;
        
        // React to specific settings changes
        if (path === 'ui.controlsTimeout') {
            this.state.controlsTimeoutDuration = value;
        } else if (path === 'ui.liveMode') {
            this.state.liveMode = value;
            
            if (value) {
                this.enableLiveMode();
            } else {
                this.disableLiveMode();
            }
        }
    }
    
    /**
     * Handle key down events
     * @param {KeyboardEvent} e - Key event
     */
    handleKeyDown(e) {
        // Skip keyboard shortcuts if the event occurred in a text input, textarea, or select element
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        // Reset controls timeout on key activity (unless in live mode)
        if (!this.state.liveMode) {
            this.resetControlsTimeout();
        }
        
        // Handle specific key shortcuts
        switch (e.key.toLowerCase()) {
            case 'h':
                // H key for help panel
                this.toggleHelpPanel();
                break;
                
            case 'f':
                // F key for fullscreen
                this.toggleFullscreen();
                break;
                
            case 'l':
                // L key for live mode
                this.toggleLiveMode();
                break;
                
            case 'm':
                // M key for MIDI mappings
                this.toggleHelpPanel();
                break;
                
            default:
                // Other keys handled by other modules
                break;
        }
    }
    
    /**
     * Toggle controls visibility
     */
    toggleControls() {
        if (!this.elements.controls) return;
        
        this.state.controlsVisible = !this.state.controlsVisible;
        
        if (this.state.controlsVisible) {
            this.elements.controls.classList.remove('hidden');
            this.resetControlsTimeout();
        } else {
            this.elements.controls.classList.add('hidden');
        }
        
        events.trigger('ui:controlsToggled', {
            visible: this.state.controlsVisible
        });
    }
    
    /**
     * Reset the controls timeout
     */
    resetControlsTimeout() {
        // Only if controls are visible and not in live mode
        if (!this.state.controlsVisible || this.state.liveMode) return;
        
        // Clear existing timeout
        if (this.state.controlsTimeout) {
            clearTimeout(this.state.controlsTimeout);
            this.state.controlsTimeout = null;
        }
        
        // Set new timeout
        this.state.controlsTimeout = setTimeout(() => {
            if (this.elements.controls) {
                this.elements.controls.classList.add('hidden');
                this.state.controlsVisible = false;
            }
        }, this.state.controlsTimeoutDuration);
    }
    
    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                LiveArt.log(`Error attempting to enable fullscreen: ${err.message}`, 'error');
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * Toggle live mode
     */
    toggleLiveMode() {
        this.state.liveMode = !this.state.liveMode;
        
        if (this.state.liveMode) {
            this.enableLiveMode();
        } else {
            this.disableLiveMode();
        }
        
        // Save setting
        settings.set('ui.liveMode', this.state.liveMode);
        
        events.trigger('ui:liveModeToggled', {
            active: this.state.liveMode
        });
    }
    
    /**
     * Enable live mode
     */
    enableLiveMode() {
        // Hide controls
        if (this.elements.controls) {
            this.elements.controls.classList.add('hidden');
            this.state.controlsVisible = false;
        }
        
        // Add live mode class to container
        if (this.elements.container) {
            this.elements.container.classList.add('live-mode');
        }
        
        // Show live mode indicator
        this.showNotification('LIVE MODE', 3000);
        
        LiveArt.log('Live mode enabled');
    }
    
    /**
     * Disable live mode
     */
    disableLiveMode() {
        // Remove live mode class from container
        if (this.elements.container) {
            this.elements.container.classList.remove('live-mode');
        }
        
        // Show controls
        if (this.elements.controls) {
            this.elements.controls.classList.remove('hidden');
            this.state.controlsVisible = true;
            this.resetControlsTimeout();
        }
        
        LiveArt.log('Live mode disabled');
    }
    
    /**
     * Toggle help panel
     */
    toggleHelpPanel() {
        if (!this.elements.helpPanel) return;
        
        this.state.helpPanelVisible = !this.state.helpPanelVisible;
        
        if (this.state.helpPanelVisible) {
            this.elements.helpPanel.classList.add('active');
        } else {
            this.elements.helpPanel.classList.remove('active');
        }
        
        events.trigger('ui:helpPanelToggled', {
            visible: this.state.helpPanelVisible
        });
    }
    
    /**
     * Toggle audio settings panel
     */
    toggleAudioSettingsPanel() {
        if (!this.elements.audioSettingsPanel) return;
        
        this.state.audioSettingsPanelVisible = !this.state.audioSettingsPanelVisible;
        
        if (this.state.audioSettingsPanelVisible) {
            this.elements.audioSettingsPanel.classList.add('active');
        } else {
            this.elements.audioSettingsPanel.classList.remove('active');
        }
        
        events.trigger('ui:audioSettingsPanelToggled', {
            visible: this.state.audioSettingsPanelVisible
        });
    }
    
    /**
     * Show a notification
     * @param {string} message - Notification message
     * @param {number} duration - Duration in milliseconds
     */
    showNotification(message, duration = 1500) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
        
        events.trigger('ui:notificationShown', {
            message,
            duration
        });
    }
    
    /**
     * Get the current UI state
     * @returns {object} Current UI state
     */
    getState() {
        return { ...this.state };
    }
}

// Create UI manager instance
const uiManager = new UIManager();

// Register as a module
LiveArt.registerModule('uiManager', uiManager);

export default uiManager;