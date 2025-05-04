/**
 * LiveArt - Modular JavaScript Framework
 * Main entry point for the modular LiveArt framework
 */

// Module registry
const LiveArt = {
    // Module registry
    modules: {},
    
    // Configuration
    config: {
        debugMode: false,
    },
    
    // Initialize the application
    init(options = {}) {
        // Merge options with default config
        Object.assign(this.config, options);
        
        // Log initialization
        this.log('Initializing LiveArt framework...');
        
        // Initialize each module
        Object.values(this.modules).forEach(module => {
            if (typeof module.init === 'function') {
                module.init();
            }
        });
        
        this.log('LiveArt framework initialized');
        
        // Return the LiveArt instance for chaining
        return this;
    },
    
    // Register a module
    registerModule(name, module) {
        if (this.modules[name]) {
            this.log(`Module '${name}' is being overwritten`, 'warn');
        }
        
        this.modules[name] = module;
        this.log(`Module '${name}' registered`);
        
        // Return the LiveArt instance for chaining
        return this;
    },
    
    // Get a module
    getModule(name) {
        return this.modules[name];
    },
    
    // Simple logging utility
    log(message, level = 'log') {
        if (this.config.debugMode || level === 'error' || level === 'warn') {
            console[level](`[LiveArt] ${message}`);
        }
    }
};

// Expose the LiveArt object globally
window.LiveArt = LiveArt;

// Export the LiveArt object
export default LiveArt;