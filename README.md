# LiveArt - Web-based VJ Tool

A real-time generative visual tool for live performances, controlled via MIDI controllers.

## Features

- **Web-based**: Runs in any modern browser without installation
- **MIDI Control**: Connect any MIDI controller to manipulate visuals in real-time
- **Generative Visuals**: Multiple visual algorithms with parameterized control
- **Performance Optimized**: Built for live shows with optimized rendering
- **Responsive**: Works on any screen size with touch support for mobile devices
- **Keyboard Fallback**: Use keyboard number keys 1-9 for testing without MIDI hardware

## Quick Start

1. Open `index.html` in a modern web browser
2. Connect a MIDI controller (or use keyboard controls)
3. Double-click for fullscreen mode
4. Select different visual presets from the dropdown

## MIDI Mapping

Default MIDI CC mappings:

| CC Number | Parameter   | Effect                        |
|-----------|-------------|-------------------------------|
| 1         | hue         | Base color hue (0-1)          |
| 2         | saturation  | Color saturation (0-1)        |
| 3         | brightness  | Color brightness (0-1)        |
| 4         | density     | Number of elements (0-1)      |
| 5         | speed       | Animation speed (0-1)         |
| 6         | size        | Element size (0-1)            |
| 7         | complexity  | Pattern complexity (0-1)      |
| 8         | rotation    | Global rotation               |
| 9         | zoom        | Global zoom (0.5-2)           |
| 10        | noiseScale  | Noise scale for patterns      |
| 11        | noiseSpeed  | Speed of noise-based movement |
| 12        | symmetry    | Symmetry divisions (1-8)      |
| 13        | reactivity  | Parameter smoothing           |

## Visual Algorithms

- **Particles**: Dynamic particle system with noise-based movement
- **Waves**: Layered wave patterns with frequency modulation
- **Grid**: Reactive grid cells with dynamic sizing
- **Fractals**: Recursive branching patterns

## Requirements

- Modern web browser with HTML5 and WebMIDI support (Chrome recommended)
- MIDI controller (optional)

## Development

The project is structured as follows:

- `index.html` - Main HTML entry point
- `css/style.css` - Styling
- `js/midi.js` - MIDI device handling
- `js/visuals.js` - Visual algorithms and rendering engine
- `js/app.js` - Main application logic

## License

MIT License

## Credits

Created with ❤️ for live visual performers