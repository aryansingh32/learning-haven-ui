# C/C++ Web Execution Guide

This project supports **two execution modes** for C/C++ code:

## 🚀 Quick Start

Simply run:
```bash
npm run dev
```

This starts **both**:
1. **Vite dev server** (port 5173) - Your React app
2. **Compile server** (port 3001) - C++ to WASM compiler

The editor will **automatically** try WASM execution first, then fall back to JSCPP if compilation isn't available.

---

## Execution Modes

### 1. **WASM Execution** (Fast, Native Performance) ⚡

**How it works:**
- Your C++ code is compiled to WebAssembly using `clang` + `wasm-ld` + `twr-wasm`
- Runs natively in the browser with full C stdlib support
- **Best performance** - compiled code runs at near-native speed

**Requirements:**
- `clang` with WASM target support
- `wasm-ld` linker
- `twr-wasm` npm package (already installed)
- Compile server running (starts automatically with `npm run dev`)

**When it's used:**
- Automatically when compile server is available
- Falls back to JSCPP if compilation fails or server is down

### 2. **JSCPP Execution** (Pure Web, No Setup) 🌐

**How it works:**
- C++ code is interpreted directly in JavaScript
- No compilation needed - works immediately
- Pure web solution - no backend required

**Requirements:**
- `public/jscpp.js` file (already included)
- That's it! No additional setup needed.

**When it's used:**
- Fallback when WASM compilation isn't available
- Works even if compile server is down
- Always available as a safety net

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Types C++ Code                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   runCpp() Function   │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ Try WASM First  │    │  Fallback: JSCPP │
│ (if available)  │    │  (always works)  │
└────────┬────────┘    └─────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ Compile Server  │    │  JSCPP Worker    │
│ (clang+wasm-ld) │    │  (interpreter)   │
└────────┬────────┘    └─────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  twr-wasm       │    │  Main Thread     │
│  Runtime        │    │  Fallback        │
└────────┬────────┘    └─────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Execution Results    │
         └────────────────────────┘
```

---

## Setup Details

### Compile Server

The compile server (`scripts/compile-server.js`) runs automatically with `npm run dev`.

**Manual start:**
```bash
npm run compile-server
# or
node scripts/compile-server.js [port]
```

**What it does:**
- Listens on `http://localhost:3001`
- Accepts POST requests to `/compile` with `{ code: string, language?: 'cpp' | 'c' }`
- Returns WASM binary (`application/wasm`)
- Uses `clang` + `wasm-ld` + `twr-wasm` toolchain

**Requirements:**
- **clang** with WASM target: `clang --target=wasm32`
- **wasm-ld**: Usually comes with LLVM/Clang
- **twr-wasm**: Already installed via npm

**Install LLVM/Clang:**
- **macOS**: `brew install llvm`
- **Linux**: `sudo apt-get install clang lld`
- **Windows**: Install LLVM from [llvm.org](https://llvm.org/)

### Vite Proxy

The Vite config proxies `/api/compile` → `http://localhost:3001/compile` so the frontend can call the compile server seamlessly.

---

## Code Structure

```
src/modules/CodeExecutor/runtimes/
├── cpp.ts              # Main entry: runCpp() - unified execution
├── cppCompile.ts       # Compile C++ to WASM (API client)
├── cppWasm.ts          # Run pre-compiled WASM via twr-wasm
├── twrBufferConsole.ts # Headless console for WASM I/O
└── cppWorker.ts        # JSCPP worker (fallback)

scripts/
└── compile-server.js   # Node.js compile server

public/
├── cppWorker.js        # JSCPP worker bundle
└── jscpp.js            # JSCPP interpreter
```

---

## Performance Comparison

| Mode      | Speed      | Setup        | C++ Support | Stdlib |
|-----------|------------|--------------|--------------|--------|
| **WASM**  | ⚡⚡⚡⚡⚡ Fast | Requires clang | Full        | Full   |
| **JSCPP** | ⚡⚡ Moderate | None         | Limited      | Limited |

---

## Troubleshooting

### "WASM compilation not available"
- **Check:** Is compile server running? (`npm run dev` starts it automatically)
- **Check:** Do you have `clang` and `wasm-ld` installed?
- **Solution:** JSCPP will be used automatically - this is fine!

### "Compilation failed"
- **Check:** C++ code syntax errors
- **Check:** Missing includes or unsupported features
- **Solution:** Code will fall back to JSCPP automatically

### "Worker failed to create"
- **Check:** Is `public/cppWorker.js` present?
- **Solution:** Falls back to main-thread JSCPP

---

## Advanced Usage

### Force JSCPP Only
```typescript
runCpp(code, testCases, { preferWasm: false });
```

### Custom Compile API
```typescript
runCpp(code, testCases, { compileApiUrl: "https://my-api.com/compile" });
```

### Direct WASM Execution
```typescript
import { runCppViaWasm } from "./runtimes";
const wasmBytes = await fetch("path/to/program.wasm").then(r => r.arrayBuffer());
const result = await runCppViaWasm(wasmBytes, testCases);
```

---

## Future Enhancements

- [ ] In-browser Clang (WASM-compiled compiler)
- [ ] Compile caching
- [ ] Multi-file compilation support
- [ ] C++ standard library selection
