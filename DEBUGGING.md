# Debugging Guide: C/C++ Execution Issues

## Common Issues and Solutions

### 1. Compile Server Not Starting

**Error:** `ReferenceError: __dirname is not defined`

**Solution:** ✅ Fixed - The compile server now uses ES module syntax.

**Check if running:**
```bash
curl http://localhost:3001/compile
# Should return 404 (not 500 or connection refused)
```

### 2. JSCPP Worker Timeout

**Symptoms:**
- Execution times out after 60 seconds
- No output from worker

**Debugging Steps:**

1. **Check browser console** for worker errors
2. **Verify jscpp.js exists:**
   ```bash
   ls -lh public/jscpp.js
   # Should show ~605KB file
   ```

3. **Check worker URL:**
   - Open browser DevTools → Network tab
   - Look for `cppWorker.js` request
   - Should return 200, not 404

4. **Check jscpp.js loading:**
   - In Network tab, look for `jscpp.js` request
   - Should be loaded by the worker
   - Check if it exposes `JSCPP` or `JSCPP.run`

5. **Test worker directly:**
   ```javascript
   // In browser console:
   const worker = new Worker('/cppWorker.js', { type: 'classic' });
   worker.onmessage = (e) => console.log('Worker:', e.data);
   worker.onerror = (e) => console.error('Worker error:', e);
   worker.postMessage({ 
     code: '#include <iostream>\nint main() { std::cout << "test"; return 0; }',
     testCases: [{ input: '', output: 'test' }]
   });
   ```

### 3. Compile API 500 Error

**Symptoms:**
- `api/compile` returns 500
- WASM compilation fails

**Debugging Steps:**

1. **Check compile server logs:**
   ```bash
   # Should see:
   # 🚀 C++ Compile Server running on http://localhost:3001
   # ✅ Ready to compile C/C++ to WASM
   ```

2. **Check dependencies:**
   ```bash
   clang --version
   wasm-ld --version
   # Both should work
   ```

3. **Test compile server directly:**
   ```bash
   curl -X POST http://localhost:3001/compile \
     -H "Content-Type: application/json" \
     -d '{"code":"int main(){return 0;}","language":"c"}'
   ```

4. **Check twr-wasm installation:**
   ```bash
   ls node_modules/twr-wasm/lib-c/twr.a
   # Should exist
   ```

### 4. Worker Not Loading JSCPP

**Symptoms:**
- Worker starts but times out
- No error messages

**Solution:**
- Check `public/jscpp.js` exists and is accessible
- Verify the file exposes `JSCPP` or `JSCPP.run` globally
- Check browser console for CORS or loading errors

### 5. Fallback to Main Thread Not Working

**Symptoms:**
- Worker fails but main thread also fails

**Check:**
- Is `jscpp.js` accessible at `/jscpp.js`?
- Does it expose `window.JSCPP` or `window.JSCPP.run`?
- Check browser console for script loading errors

## Debug Mode

Enable verbose logging by checking browser console. All execution steps are logged with:
- `[INFO]` - Normal operations
- `[WARN]` - Warnings (fallbacks, missing features)
- `[ERROR]` - Errors (failures)

## Quick Health Check

Run this in browser console:

```javascript
// 1. Check compile server
fetch('/api/compile', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: 'int main(){return 0;}'}) })
  .then(r => r.text()).then(console.log).catch(console.error);

// 2. Check worker
const w = new Worker('/cppWorker.js', {type: 'classic'});
w.onmessage = (e) => { console.log('✅ Worker OK:', e.data); w.terminate(); };
w.onerror = (e) => { console.error('❌ Worker Error:', e); };
w.postMessage({code: 'int main(){return 0;}', testCases: []});

// 3. Check JSCPP
const script = document.createElement('script');
script.src = '/jscpp.js';
script.onload = () => {
  console.log('✅ JSCPP loaded:', typeof window.JSCPP, typeof window.__JSCPP__);
};
script.onerror = () => console.error('❌ JSCPP failed to load');
document.head.appendChild(script);
```

## Expected Behavior

### With Compile Server Running:
1. Code execution starts
2. Tries WASM compilation (if clang available)
3. Falls back to JSCPP if compilation fails
4. Results displayed

### Without Compile Server:
1. Code execution starts
2. Skips WASM compilation (server unavailable)
3. Uses JSCPP directly
4. Results displayed

Both paths should work - WASM is optional!
