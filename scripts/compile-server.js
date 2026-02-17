#!/usr/bin/env node
/**
 * Simple C/C++ to WASM compile server for local development.
 * Requires: clang, wasm-ld, and twr-wasm installed.
 * 
 * Usage: node scripts/compile-server.js [port]
 * Default port: 3001
 * 
 * This server compiles C/C++ code to WASM using twr-wasm toolchain.
 */

import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : 3001;
const TWR_WASM_PATH = path.join(__dirname, '..', 'node_modules', 'twr-wasm');

// Check if twr-wasm is installed
async function checkDependencies() {
    try {
        await fs.access(path.join(TWR_WASM_PATH, 'lib-c', 'twr.a'));
    } catch {
        console.warn('⚠️  twr-wasm not found. Install with: npm install twr-wasm');
        console.warn('   Compilation will be disabled. JSCPP will be used as fallback.');
        return false;
    }
    
    try {
        await execAsync('clang --version');
        await execAsync('wasm-ld --version');
    } catch {
        console.warn('⚠️  clang or wasm-ld not found. Install LLVM/Clang with WASM support.');
        console.warn('   Compilation will be disabled. JSCPP will be used as fallback.');
        return false;
    }
    
    return true;
}

async function compileToWasm(code, language = 'cpp') {
    const workDir = path.join(tmpdir(), `cpp-compile-${randomUUID()}`);
    await fs.mkdir(workDir, { recursive: true });
    
    const ext = language === 'cpp' ? 'cpp' : 'c';
    const sourceFile = path.join(workDir, `main.${ext}`);
    const objectFile = path.join(workDir, 'main.o');
    const wasmFile = path.join(workDir, 'main.wasm');
    
    try {
        // Write source
        await fs.writeFile(sourceFile, code, 'utf8');
        
        // Compile with clang
        const includePath = path.join(TWR_WASM_PATH, 'include');
        const compileCmd = `clang --target=wasm32 -nostdinc -nostdlib -isystem "${includePath}" -c "${sourceFile}" -o "${objectFile}"`;
        await execAsync(compileCmd);
        
        // Link with wasm-ld
        const libPath = path.join(TWR_WASM_PATH, 'lib-c', 'twr.a');
        const linkCmd = `wasm-ld "${objectFile}" "${libPath}" -o "${wasmFile}" --no-entry --initial-memory=131072 --max-memory=131072 --export=main`;
        await execAsync(linkCmd);
        
        // Read WASM binary
        const wasmBytes = await fs.readFile(wasmFile);
        
        return wasmBytes.buffer;
    } catch (err) {
        throw new Error(`Compilation failed: ${err.message}`);
    } finally {
        // Cleanup
        try {
            await fs.rm(workDir, { recursive: true, force: true });
        } catch {}
    }
}

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Health check endpoint
    if (req.method === 'GET' && req.url === '/health') {
        const hasDeps = await checkDependencies();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            hasDependencies: hasDeps,
            port: PORT 
        }));
        return;
    }
    
    if (req.method !== 'POST' || req.url !== '/compile') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found', availableEndpoints: ['/compile', '/health'] }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const { code, language = 'cpp' } = JSON.parse(body);
            
            if (!code || typeof code !== 'string') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request: code required' }));
                return;
            }
            
            console.log(`[${new Date().toISOString()}] Compiling ${language} code (${code.length} chars)...`);
            const wasmBytes = await compileToWasm(code, language);
            console.log(`[${new Date().toISOString()}] ✅ Compilation successful (${wasmBytes.byteLength} bytes)`);
            res.writeHead(200, { 
                'Content-Type': 'application/wasm',
                'Content-Length': wasmBytes.byteLength
            });
            res.end(Buffer.from(wasmBytes));
        } catch (err) {
            const errorMsg = err.message || String(err);
            console.error(`[${new Date().toISOString()}] ❌ Compilation failed:`, errorMsg);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: errorMsg, details: err.stack }));
        }
    });
});

async function start() {
    try {
        const hasDeps = await checkDependencies();
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use. Try a different port:`);
                console.error(`   node scripts/compile-server.js ${PORT + 1}`);
                console.error(`   Or kill the process using port ${PORT}`);
                // Don't exit - let concurrently handle it, or the server will keep retrying
            } else if (err.code === 'EACCES') {
                console.error(`❌ Permission denied binding to port ${PORT}`);
                console.error(`   Try a different port: node scripts/compile-server.js ${PORT + 1}`);
            } else {
                console.error('❌ Server error:', err.message || err);
            }
        });
        
        // Bind to localhost instead of 0.0.0.0 to avoid permission issues
        server.listen(PORT, '127.0.0.1', () => {
            console.log(`🚀 C++ Compile Server running on http://127.0.0.1:${PORT}`);
            if (hasDeps) {
                console.log('✅ Ready to compile C/C++ to WASM');
            } else {
                console.log('⚠️  Dependencies missing - server will return errors');
                console.log('   Install: clang, wasm-ld, and ensure twr-wasm is installed');
                console.log('   Note: JSCPP will be used as fallback (no compilation needed)');
            }
            console.log(`   POST /compile with { code: string, language?: 'cpp' | 'c' }`);
            console.log(`   GET  /health for status check`);
        });
    } catch (err) {
        console.error('❌ Failed to start compile server:', err.message || err);
        console.error('   JSCPP will be used as fallback (no compilation needed)');
        // Don't exit - let the process continue so vite can still run
    }
}

start().catch((err) => {
    console.error('❌ Compile server startup error:', err.message || err);
    console.error('   JSCPP will be used as fallback (no compilation needed)');
    // Keep process alive so concurrently doesn't kill everything
    setInterval(() => {}, 1000);
});
