# FlySim-RC Fix Summary

## ✅ Fixes Applied

### Fix 1: FlySimCore.js
**File:** `src/core/FlySimCore.js`  
**Line 65:** Changed default rootDir

**Before:**
```javascript
const rootDir = options.rootDir || '/aircraft';
```

**After:**
```javascript
const rootDir = options.rootDir || '';
```

**Why:** The C wrapper already adds `/aircraft/` prefix, so passing `/aircraft` as root caused double path:
- OLD: `/aircraft` + `/aircraft/c172p/c172p` = `/aircraft/aircraft/c172p/c172p` ❌
- NEW: `` + `/aircraft/c172p/c172p` = `/aircraft/c172p/c172p` ✓

### Fix 2: test-working.html (Already Fixed)
**Line 187:** Changed JSBSim_CreateFDM call

**Before:**
```javascript
fdmId = Module.ccall('JSBSim_CreateFDM', ..., ['c172p', '/aircraft']);
```

**After:**
```javascript
fdmId = Module.ccall('JSBSim_CreateFDM', ..., ['c172p', '']);
```

---

## 🚀 How to Test

### Start Server
```bash
cd F:\code\Coding\2026\flysim-rc
python -m http.server 8080
```

### Open Browser
Navigate to: **http://localhost:8080/index.html**

### Test Steps
1. Click **"Initialize"**
   - Should show: "FlySimCore initialized successfully"

2. Click **"Load C172"**
   - Should show: "C172 loaded successfully"
   - FDM ID should appear (e.g., "1")

3. Click **"Start"**
   - Simulation should start running
   - FPS counter should show ~60

4. Try controls (sliders or WASD keys)
   - Telemetry should update

### Expected Behavior
- ✅ WASM loads without errors
- ✅ Aircraft loads without 404
- ✅ Simulation runs at 60 FPS
- ✅ Controls respond

---

## 🔍 If You Still See Issues

### Error: "FlySimJSBSim not loaded"
- Test URL: http://localhost:8080/test-working.html
- This uses script tag approach instead of ES6 modules
- Check browser console for 404 errors

### Error: Path still wrong
- Clear browser cache (Ctrl+Shift+R)
- Check you're using port 8080
- Verify files are updated:
  ```bash
  grep "rootDir" src/core/FlySimCore.js
  # Should show: const rootDir = options.rootDir || '';
  ```

---

## 📁 Files Modified
1. `src/core/FlySimCore.js` - Line 65
2. `test-working.html` - Line 187 (already done)
3. `test-simple.html` - Line 153 (already done)

All fixes are complete. Ready to test!
