# Comparison: Our Implementation vs 0x62 Working Demo

## Key Differences Found

### 1. Loading Strategy
**0x62 Demo (Working):**
- Uses `loadScript()` to load a scenario script
- Script loads the aircraft model internally
- Then calls `runIc()` to initialize

**Our Implementation (Not Working):**
- Uses `loadModel()` directly
- Trying to load aircraft XML directly
- Getting error codes from embind

### 2. API Naming
**0x62 SDK:**
- CamelCase: `runIc()`, `setPropertyValue()`, `getPropertyValue()`
- Wrapper class handles conversion

**Our Bindings:**
- PascalCase: `RunIC()`, `SetPropertyValue()`, `GetPropertyValue()`
- Direct embind (C++ style)

### 3. File Loading
**0x62 Demo:**
- Loads files via `fetchBytes()` 
- Writes to VFS with `writeDataFile()`
- Uses manifest.json to specify files

**Our Implementation:**
- Similar approach with `writeRuntimeFile()`
- Should work the same way

### 4. Error Handling
**0x62 Demo:**
- Uses try-catch with proper error formatting
- Checks boolean returns explicitly
- Has `formatStartupError()` helper

## Root Cause Analysis

The error code **597560** (and similar) appears to be:
1. An embind internal error code/pointer
2. Occurring when LoadModel fails to find files
3. Not being properly converted to a JavaScript exception

The issue is likely:
- Files are being written to wrong VFS paths
- Or LoadModel can't find the aircraft XML
- The embind binding isn't handling SGPath correctly

## Recommended Fix

### Option 1: Use Script-Based Loading (Like 0x62)
Instead of calling LoadModel directly, create a script file that loads the aircraft:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<runscript name="Test">
  <use aircraft="c172x"/>
  <run start="0" end="100" dt="0.008">
    <event name="Start">
      <set name="simulation/dt" value="0.008"/>
    </event>
  </run>
</runscript>
```

Then load it with:
```typescript
sdk.loadScript('/runtime/test-script.xml');
sdk.runIC();
```

### Option 2: Fix VFS Paths
Ensure files are written to correct paths:
- Aircraft: `/runtime/aircraft/c172x/c172x.xml`
- Engine: `/runtime/engine/eng_io320.xml`
- Systems: `/runtime/systems/GNCUtilities.xml`

### Option 3: Debug Current Implementation
Add detailed logging to see:
1. What paths files are being written to
2. What paths JSBSim is looking for
3. What the actual error is

## Immediate Next Steps

1. **Test with a simpler aircraft** (ball works, c172x has too many dependencies)
2. **Use loadScript() approach** like 0x62 demo
3. **Create a scenario manifest** similar to 0x62
4. **Verify all file paths** are correct

## Working Example from 0x62

```typescript
const sdk = await JSBSimSdk.create({
  moduleUrl: "/wasm/jsbsim_wasm.mjs",
  wasmUrl: "/wasm/jsbsim_wasm.wasm",
});

sdk.configurePaths({
  rootDir: "/runtime",
  aircraftPath: "aircraft",
  enginePath: "engine",
  systemsPath: "systems",
});

// Load files into VFS
for (const file of manifest.files) {
  const bytes = await fetchBytes(file.publicPath);
  sdk.writeDataFile(file.runtimePath, bytes);
}

// Load script instead of model directly
const loaded = sdk.loadScript("/runtime/scenario/script.xml");
if (!loaded) throw new Error("Failed to load script");

// Initialize
if (!sdk.runIc()) throw new Error("Failed to initialize");
```

## Our Current Status

✅ SDK initializes successfully
✅ WASM loads with embind
✅ VFS file writing works
❌ LoadModel returns error codes
❌ Aircraft loading fails

## Recommendation

**Switch to script-based loading** like 0x62 demo:
1. Create a simple test script
2. Load the script with `loadScript()`
3. Initialize with `runIC()`
4. This bypasses the LoadModel issues
