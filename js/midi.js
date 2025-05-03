/**
 * MIDI Controller for LiveArt
 * Handles MIDI device connections and CC message processing
 */
class MIDIController {
    constructor() {
        this.isConnected = false;
        this.midiAccess = null;
        this.inputs = [];
        this.activeInput = null;
        this.ccValues = new Map(); // Store all CC values
        this.ccCallbacks = new Map(); // Callbacks for specific CC changes
        this.anyControlChangeCallback = null; // Callback for any CC change
        this.programChangeCallback = null; // Callback for program change messages
        
        // Initialize
        this.init();
        
        // Setup port selector
        this.setupPortSelector();
    }
    
    /**
     * Initialize MIDI access
     */
    init() {
        // Check if Web MIDI API is supported
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess({ sysex: false })
                .then(this.onMIDISuccess.bind(this), this.onMIDIFailure.bind(this));
        } else {
            console.warn('Web MIDI API is not supported in this browser.');
            this.updateMIDIStatus(false);
        }
    }
    
    /**
     * Rescan for MIDI ports
     * Useful when new devices are connected
     */
    async rescanMIDIPorts() {
        console.log('Rescanning for MIDI ports...');
        
        try {
            if (navigator.requestMIDIAccess) {
                // Request fresh MIDI access to trigger port detection
                this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
                
                // Reset input list
                this.inputs = [];
                
                // Get all available inputs again
                const inputs = this.midiAccess.inputs.values();
                for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
                    this.inputs.push(input.value);
                    console.log(`MIDI Input detected: ${input.value.name} (${input.value.id})`);
                }
                
                // Update the port selector
                this.updatePortList();
                
                // Reconnect state change listeners
                this.midiAccess.onstatechange = this.onStateChange.bind(this);
                
                // Try to select the first available input if none is active
                if (!this.activeInput && this.inputs.length > 0) {
                    this.selectInput(this.inputs[0].id);
                }
                
                return true;
            }
        } catch (err) {
            console.error('Error rescanning MIDI ports:', err);
        }
        
        return false;
    }
    
    /**
     * Setup MIDI port selector dropdown
     */
    setupPortSelector() {
        const portSelector = document.getElementById('midi-input');
        if (portSelector) {
            // Listen for port selection changes
            portSelector.addEventListener('change', (e) => {
                const selectedId = e.target.value;
                this.selectInput(selectedId);
            });
            
            // Automatically rescan for ports when the dropdown is clicked
            portSelector.addEventListener('mousedown', () => {
                // Rescan before showing the options
                this.rescanMIDIPorts().then(() => {
                    console.log('MIDI ports rescanned on dropdown click');
                });
            });
        }
        
        // Check if a rescan button exists or create one
        const midiPortContainer = document.querySelector('.midi-port-selector');
        if (midiPortContainer) {
            // Check if a rescan button already exists
            let rescanButton = document.getElementById('rescan-midi');
            
            // Create the button if it doesn't exist
            if (!rescanButton) {
                rescanButton = document.createElement('button');
                rescanButton.id = 'rescan-midi';
                rescanButton.title = 'Rescan for MIDI devices';
                rescanButton.textContent = '↻';
                rescanButton.className = 'rescan-midi-button';
                
                // Add click handler to rescan
                rescanButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.rescanMIDIPorts();
                });
                
                // Add the button to the container
                midiPortContainer.appendChild(rescanButton);
            }
        }
    }
    
    /**
     * Handle successful MIDI access
     * @param {MIDIAccess} midiAccess - The MIDI access object
     */
    onMIDISuccess(midiAccess) {
        this.midiAccess = midiAccess;
        this.inputs = [];
        
        // Get all available inputs
        const inputs = this.midiAccess.inputs.values();
        for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
            this.inputs.push(input.value);
            console.log(`MIDI Input detected: ${input.value.name} (${input.value.id})`);
        }
        
        // Update port selector dropdown
        this.updatePortList();
        
        // Try to select the first available input
        if (this.inputs.length > 0) {
            this.selectInput(this.inputs[0].id);
        }
        
        // Listen for connection changes
        this.midiAccess.onstatechange = this.onStateChange.bind(this);
    }
    
    /**
     * Update the port selector dropdown with available inputs
     */
    updatePortList() {
        const portSelector = document.getElementById('midi-input');
        if (!portSelector) return;
        
        // Clear existing options
        while (portSelector.firstChild) {
            portSelector.removeChild(portSelector.firstChild);
        }
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = this.inputs.length === 0 ? 
            'No MIDI inputs available' : 
            '-- Select MIDI Input --';
        portSelector.appendChild(defaultOption);
        
        // Add an option for each input
        this.inputs.forEach(input => {
            const option = document.createElement('option');
            option.value = input.id;
            option.textContent = input.name || `MIDI Input ${input.id}`;
            portSelector.appendChild(option);
            
            // Select this option if it's the active input
            if (this.activeInput && input.id === this.activeInput.id) {
                option.selected = true;
            }
        });
    }
    
    /**
     * Handle MIDI access failure
     * @param {Error} error - The error object
     */
    onMIDIFailure(error) {
        console.error('Failed to access MIDI devices:', error);
        this.updateMIDIStatus(false);
    }
    
    /**
     * Handle MIDI connection state changes
     * @param {MIDIConnectionEvent} event - The state change event
     */
    onStateChange(event) {
        console.log(`MIDI connection state change: ${event.port.name} - ${event.port.state}`);
        
        // Refresh the available inputs
        this.inputs = [];
        const inputs = this.midiAccess.inputs.values();
        for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
            this.inputs.push(input.value);
        }
        
        // Update the port selector
        this.updatePortList();
        
        // Check if our active input was disconnected
        if (this.activeInput && event.port.id === this.activeInput.id && event.port.state === 'disconnected') {
            console.log(`Active MIDI input ${this.activeInput.name} disconnected`);
            this.activeInput = null;
            this.isConnected = false;
            this.updateMIDIStatus(false);
        }
        
        // Auto-connect to the first available input if none is active
        if (!this.activeInput && this.inputs.length > 0) {
            this.selectInput(this.inputs[0].id);
        }
    }
    
    /**
     * Select a MIDI input by ID
     * @param {string} inputId - The ID of the MIDI input to use
     */
    selectInput(inputId) {
        // If empty input ID, deactivate all inputs
        if (!inputId) {
            if (this.activeInput) {
                console.log(`Deactivating MIDI input: ${this.activeInput.name}`);
                this.activeInput.onmidimessage = null;
                this.activeInput = null;
                this.isConnected = false;
                this.updateMIDIStatus(false);
            }
            return;
        }
        
        // Find the input with matching ID
        const selectedInput = this.inputs.find(input => input.id === inputId);
        
        // If we found a matching input
        if (selectedInput) {
            // Remove message handler from current active input (if any)
            if (this.activeInput) {
                this.activeInput.onmidimessage = null;
            }
            
            // Set new active input
            this.activeInput = selectedInput;
            this.activeInput.onmidimessage = this.onMIDIMessage.bind(this);
            this.isConnected = true;
            console.log(`Activated MIDI input: ${this.activeInput.name}`);
            
            // Update UI
            this.updateMIDIStatus(true);
            
            // Update select dropdown if needed
            const portSelector = document.getElementById('midi-input');
            if (portSelector && portSelector.value !== inputId) {
                portSelector.value = inputId;
            }
        } else {
            console.warn(`MIDI input with ID ${inputId} not found`);
        }
    }
    
    /**
     * Process incoming MIDI messages
     * @param {MIDIMessageEvent} message - The MIDI message
     */
    onMIDIMessage(message) {
        const data = message.data;
        const messageType = data[0] & 0xf0;
        
        // Handle Control Change messages (CC)
        if (messageType === 0xB0) {
            const controller = data[1];
            const value = data[2];
            const normalizedValue = value / 127; // Normalize to 0-1 range
            
            // Store CC value
            this.ccValues.set(controller, normalizedValue);
            
            // Show visual feedback
            this.showMIDIActivity();
            
            // Trigger specific CC callback if registered
            if (this.ccCallbacks.has(controller)) {
                this.ccCallbacks.get(controller)(normalizedValue, controller);
            }
            
            // Trigger general CC callback if registered
            if (this.anyControlChangeCallback) {
                this.anyControlChangeCallback(controller, normalizedValue);
            }
        }
        // Handle Program Change messages
        else if (messageType === 0xC0) {
            const programNumber = data[1];
            console.log(`Program Change: ${programNumber}`);
            
            // Show visual feedback
            this.showMIDIActivity();
            
            // Trigger program change callback if registered
            if (this.programChangeCallback) {
                this.programChangeCallback(programNumber);
            }
        }
    }
    
    /**
     * Show visual feedback for MIDI activity
     */
    showMIDIActivity() {
        const indicator = document.getElementById('midi-indicator');
        if (indicator) {
            // Add a pulse class
            indicator.classList.add('pulse');
            
            // Remove the pulse class after animation
            setTimeout(() => {
                indicator.classList.remove('pulse');
            }, 150);
        }
    }
    
    /**
     * Register a callback for a specific CC number
     * @param {number} ccNumber - The CC number to watch
     * @param {function} callback - Function to call when this CC changes
     */
    onControlChange(ccNumber, callback) {
        this.ccCallbacks.set(ccNumber, callback);
    }
    
    /**
     * Register a callback for any CC change
     * @param {function} callback - Function to call on any CC change
     */
    onAnyControlChange(callback) {
        this.anyControlChangeCallback = callback;
    }
    
    /**
     * Register a callback for program change messages
     * @param {function} callback - Function to call on program change
     */
    onProgramChange(callback) {
        this.programChangeCallback = callback;
    }
    
    /**
     * Get the current value of a CC
     * @param {number} ccNumber - The CC number
     * @param {number} defaultValue - Default value if CC hasn't been received
     * @returns {number} - The normalized (0-1) CC value
     */
    getCCValue(ccNumber, defaultValue = 0) {
        return this.ccValues.has(ccNumber) ? this.ccValues.get(ccNumber) : defaultValue;
    }
    
    /**
     * Update MIDI connection status indicator
     * @param {boolean} isConnected - Whether MIDI is connected
     */
    updateMIDIStatus(isConnected) {
        const indicator = document.getElementById('midi-indicator');
        if (indicator) {
            if (isConnected) {
                indicator.classList.add('connected');
            } else {
                indicator.classList.remove('connected');
            }
        }
    }
}

// Create global MIDI controller instance
const midiController = new MIDIController();