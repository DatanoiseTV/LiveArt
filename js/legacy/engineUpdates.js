/**
 * Updates for the visual engines to support parameter smoothing
 */

// Add smoothing update method to both engine prototypes
VisualEngine.prototype.updateParamsWithSmoothing = function(delta) {
    // Calculate smoothing factor based on delta time and smoothing parameter
    // Higher smoothing means slower approach to target values
    const smoothingStrength = this.params.smoothing;
    
    // If smoothing is very low, just copy target values directly
    if (smoothingStrength < 0.05) {
        Object.keys(this.targetParams).forEach(key => {
            this.params[key] = this.targetParams[key];
        });
        return;
    }
    
    // Scale factor - larger numbers make the approach faster
    const smoothingRate = 10 * (1 - smoothingStrength);
    
    // Calculate smoothing factor that works with variable framerates
    const smoothingFactor = Math.min(1.0, smoothingRate * delta / 1000);
    
    // Update each parameter with exponential smoothing
    Object.keys(this.targetParams).forEach(key => {
        // Skip the smoothing parameter itself
        if (key === 'smoothing') return;
        
        // Apply smoothing - linear interpolation towards target
        this.params[key] += (this.targetParams[key] - this.params[key]) * smoothingFactor;
    });
};

// Add same method to WebGL engine
WebGLVisuals.prototype.updateParamsWithSmoothing = function(delta) {
    // Calculate smoothing factor based on delta time and smoothing parameter
    // Higher smoothing means slower approach to target values
    const smoothingStrength = this.params.smoothing;
    
    // If smoothing is very low, just copy target values directly
    if (smoothingStrength < 0.05) {
        Object.keys(this.targetParams).forEach(key => {
            this.params[key] = this.targetParams[key];
        });
        return;
    }
    
    // Scale factor - larger numbers make the approach faster
    const smoothingRate = 10 * (1 - smoothingStrength);
    
    // Calculate smoothing factor that works with variable framerates
    const smoothingFactor = Math.min(1.0, smoothingRate * delta / 1000);
    
    // Update each parameter with exponential smoothing
    Object.keys(this.targetParams).forEach(key => {
        // Skip the smoothing parameter itself
        if (key === 'smoothing') return;
        
        // Apply smoothing - linear interpolation towards target
        this.params[key] += (this.targetParams[key] - this.params[key]) * smoothingFactor;
    });
    
    // Also handle smoothing for effect parameters
    if (this.effectParams) {
        // For simplicity, we're not using target params for effects
        // Future update could implement this
    }
};