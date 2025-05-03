# LiveArt

A web-based VJ tool for real-time generative visuals controlled via MIDI.

## Features

- Real-time 2D and 3D visualizations
- MIDI controller integration
- Parameter control via UI sliders or MIDI CC
- Preset system for saving and loading settings
- CC mapping system with presets and import/export
- Post-processing effects for both 2D and 3D visuals

## Usage

1. Connect a MIDI controller
2. Select a visualization from the dropdown
3. Control parameters via sliders or MIDI CC messages

## MIDI Controls

Default mappings:
- CCs 1-13: Control various visual parameters
- CC14: Randomize parameters
- CC15: Next preset
- CCs 16-21: Visualization-specific parameters
- CCs 22-24: 3D controls (rotation, translation)
- CCs 25-34: Post-processing effects
- CCs 35-39: Particle Trails controls (position, size, brightness, trail length)

## Keyboard Shortcuts

- 1-9: Increase parameters (Shift+1-9 to decrease)
- Space: Randomize parameters
- Arrow keys: Change visual preset
- F: Toggle fullscreen
- G: Toggle floor grid visibility in 3D views
- H: Hide/show controls
- M: Show MIDI mappings
- L: Toggle LIVE MODE (hide all UI for projection)
- E: Toggle effects on/off
- X/Y/Z: 3D rotation/translation (with Shift for larger steps)
- R: Reset 3D transformations

## CC Map Presets

LiveArt allows you to save and load MIDI CC mapping configurations:

1. Open the MIDI Mappings panel (press M)
2. Use the "Export CC Map" button to save your current mapping configuration to a file
3. Use the "Import CC Map" button to load a mapping configuration from a file
4. Create and manage named presets for quick access to different controller mappings

## Screenshots

*Coming soon*

## Development

### Installation

```bash
git clone https://github.com/DatanoiseTV/LiveArt.git
cd LiveArt
```

Open `index.html` in a web browser that supports the Web MIDI API (Chrome recommended).

### Running Locally

You can use any local web server to run LiveArt. For example:

```bash
# Using Python
python -m http.server

# Using Node.js and npx
npx serve
```

Then open http://localhost:8000 in your browser.

### Browser Requirements

- Modern browser with WebGL support
- Web MIDI API support (Chrome recommended)
- JavaScript enabled

## Troubleshooting

### MIDI Not Working

- Make sure your MIDI device is connected before loading the page
- Chrome may require you to allow MIDI access
- Try clicking the MIDI refresh button to rescan devices

### 3D Visualizations Issues

- Check that your browser has WebGL enabled
- Try switching between different 3D scenes
- Some effects may be computationally intensive on older hardware

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Copyright © Datanoise UG, Berlin