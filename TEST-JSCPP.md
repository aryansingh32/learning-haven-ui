# Testing JSCPP Loading

## Quick Test Script

Run this in your browser console to test JSCPP loading:

```javascript
// Test 1: Check if jscpp.js loads in main thread
const script = document.createElement('script');
script.src = '/jscpp.js';
script.onload = () => {
    console.log('✅ Script loaded');
    console.log('module.exports:', typeof window.module?.exports);
    console.log('JSCPP:', typeof window.JSCPP);
    console.log('__JSCPP__:', typeof window.__JSCPP__);
    
    // Try to get the run function
    const JSCPP = window.module?.exports || window.JSCPP;
    const run = typeof JSCPP === 'function' ? JSCPP : (JSCPP?.run);
    console.log('run function:', typeof run);
    
    if (typeof run === 'function') {
        console.log('✅ JSCPP.run found! Testing...');
        try {
            const result = run('int main(){return 0;}', '', {});
            console.log('✅ Test run successful:', result);
        } catch(e) {
            console.error('❌ Test run failed:', e);
        }
    } else {
        console.error('❌ JSCPP.run not found');
    }
};
script.onerror = (e) => console.error('❌ Script failed to load:', e);
document.head.appendChild(script);

// Test 2: Test worker
const worker = new Worker('/cppWorker.js', {type: 'classic'});
worker.onmessage = (e) => {
    console.log('✅ Worker response:', e.data);
    worker.terminate();
};
worker.onerror = (e) => {
    console.error('❌ Worker error:', e);
    worker.terminate();
};
worker.postMessage({
    code: 'int main(){return 0;}',
    testCases: [{input: '', output: ''}]
});
```

## Expected Output

If everything works:
- Script should load successfully
- `module.exports` should be a function
- Worker should respond with success message
