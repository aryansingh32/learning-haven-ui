# 🚀 Quick Start: C/C++ Web Editor

## Run Everything with One Command

```bash
npm run dev
```

This starts **both**:
- ✅ **Vite dev server** (port 5173) - Your React editor
- ✅ **Compile server** (port 3001) - C++ to WASM compiler

## How It Works

When you run C++ code in the editor:

1. **First**: Tries to compile to WASM (fast, native performance) ⚡
   - Uses `clang` + `wasm-ld` + `twr-wasm`
   - Runs via compile server on port 3001
   - Executes with full C stdlib support

2. **Fallback**: Uses JSCPP interpreter (pure web, always works) 🌐
   - No compilation needed
   - Works even if compile server is down
   - Limited C++ features but reliable

## Requirements

### For WASM Execution (Optional but Recommended)
- **clang** with WASM support
- **wasm-ld** linker

**Install:**
- macOS: `brew install llvm`
- Linux: `sudo apt-get install clang lld`
- Windows: Install LLVM from [llvm.org](https://llvm.org/)

### For JSCPP Execution (Always Works)
- ✅ Already included! No setup needed.

## What Happens

```
You type C++ code
    ↓
Editor tries WASM compilation
    ├─ Success? → Run WASM (fast) ⚡
    └─ Failed?  → Run JSCPP (reliable) 🌐
    ↓
Results displayed
```

## Troubleshooting

**"WASM compilation not available"**
- This is fine! JSCPP will be used automatically.
- To enable WASM: Install `clang` and `wasm-ld` (see above).

**Compile server not starting?**
- Check if port 3001 is available
- Run manually: `npm run compile-server`

**Want JSCPP only?**
- The system automatically falls back if WASM isn't available
- Or modify `src/modules/CodeExecutor/runtimes/cpp.ts` to set `preferWasm: false`

## Learn More

See [docs/CPP-WASM-EXECUTION.md](./docs/CPP-WASM-EXECUTION.md) for detailed architecture and advanced usage.
