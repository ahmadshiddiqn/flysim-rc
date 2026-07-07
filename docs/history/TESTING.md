# FlySim-RC Test Setup

## Build Complete! ✅

All Phase 1.1 and 1.2 components are ready for testing.

## Files Created

### WASM Build (in `build/`)
- **jsbsim.js** (95KB) - JavaScript loader with ES6 module exports
- **jsbsim.wasm** (1.5MB) - WebAssembly binary
- **jsbsim.data** (3.0MB) - Preloaded aircraft files (40+ aircraft!)

### Source Code
- **src/core/jsbsim_wrapper.h/cpp** - C API wrapper
- **src/core/FlySimCore.js** - JavaScript wrapper class
- **index.html** - Test page with UI

### Documentation
- **docs/PRD.md** - Product Requirements
- **docs/FRD.md** - Functional Requirements

## How to Test

### 1. Start a Local Web Server

Since WASM requires a web server (not `file://`), use one of these:

**Option A: Python (if installed)**
```bash
cd F:\code\Coding\2026\flysim-rc
python -m http.server 8000
```

**Option B: Node.js (if installed)**
```bash
cd F:\code\Coding\2026\flysim-rc
npx serve
```

**Option C: VS Code Live Server extension**
Just right-click on index.html → "Open with Live Server"

### 2. Open Browser

Navigate to: `http://localhost:8000`

### 3. Test Steps

1. Click **"Initialize"** button
   - Should load the WASM module
   - Console should show: "FlySimCore initialized successfully"

2. Click **"Load C172"** button
   - Loads the Cessna 172 aircraft
   - FDM ID should appear (e.g., "1")

3. Click **"Start"** button
   - Simulation loop starts running at 120Hz
   - Telemetry should update in real-time

4. Try **controls**:
   - Use sliders to move ailerons/elevator/rudder/throttle
   - Watch the attitude values change
   - Or use keyboard: WASD + QE

5. Click **"Reset"** to return to initial position

6. Click **"Stop"** to pause simulation

## Expected Behavior

✅ **Success:**
- WASM loads without errors
- Aircraft loads (C172 by default)
- Telemetry updates (altitude, roll, pitch, etc.)
- FPS counter shows ~60 FPS
- Controls respond to input

❌ **Issues to watch for:**
- WASM loading errors in console
- Aircraft not found errors
- Physics explosions (infinite values)
- Low FPS (<30)

## Aircraft Available

The following aircraft are preloaded and ready to test:
- c172p (Cessna 172 - default)
- J3Cub (Piper Cub)
- pa18 (Piper Super Cub)
- c310 (Cessna 310)
- f16 (F-16)
- And 35+ more in `aircraft/` directory

## Next Steps

If testing is successful, proceed to:
- **Phase 1.3:** Gamepad API support
- **Phase 1.4:** Keyboard input (already partially working!)
- **Phase 1.5:** 2D Instrument panel

## Troubleshooting

### "Failed to initialize"
- Check browser console (F12)
- Verify WASM files are in `build/` directory
- Make sure using HTTP server, not file://

### "Failed to load aircraft"
- Check jsbsim.data was copied
- Verify aircraft name exists in `aircraft/` directory
- Check console for specific error

### Performance issues
- Close other browser tabs
- Check Task Manager for memory usage
- Try different browser (Chrome recommended)

## Console Commands (for debugging)

Open browser console (F12) and try:
```javascript
// Check if sim is initialized
sim.module  // Should show object

// Get current state
sim.getState()

// Set controls directly
sim.setControls({aileron: 0.5, elevator: -0.3})
```

---

**Ready to test!** Start your local server and navigate to http://localhost:8000
