/**
 * Headless console for twr-wasm: buffers stdout and feeds stdin from a string.
 * Used to run pre-compiled C/C++ WASM with programmatic input/output (e.g. test cases).
 * Based on twr-wasm's console interface; see twr-wasm docs and twrConsoleDebug.
 */
import {
    twrLibrary,
    twrLibraryInstanceRegistry,
    IOTypes,
    type TLibImports,
} from "twr-wasm";

/** Convert C code point + codePage to Unicode code point (minimal: treat as UTF-32 / BMP). */
function codePointFrom(ch: number, _codePage: number): number {
    if (ch >= 0 && ch <= 0x10ffff) return ch;
    return 0;
}

export class TwrBufferConsole extends twrLibrary {
    id: number;
    outputBuffer = "";
    /** Queue of input code points (from setInput). EOF = -1 when queue empty. */
    private inputQueue: number[] = [];

    imports: TLibImports = {
        twrConCharOut: { noBlock: true },
        twrConGetProp: {},
        twrConPutStr: { noBlock: true },
        twrConCharIn: {},
        twrConSetFocus: { noBlock: true },
    };

    libSourcePath = new URL(import.meta.url).pathname;
    interfaceName = "twrConsole";

    constructor() {
        super();
        this.id = twrLibraryInstanceRegistry.register(this);
    }

    /** Set stdin content for the next run (e.g. test case input). */
    setInput(s: string): void {
        this.inputQueue = [];
        for (let i = 0; i < s.length; i++) {
            const cp = s.codePointAt(i) ?? 0;
            this.inputQueue.push(cp);
            if (cp > 0xffff) i++;
        }
    }

    /** Clear and get current stdout. */
    getOutput(): string {
        const out = this.outputBuffer;
        this.outputBuffer = "";
        return out;
    }

    /** Reset state for a new run. */
    reset(): void {
        this.outputBuffer = "";
        this.inputQueue = [];
    }

    charOut(ch: string): void {
        if (ch.length > 1) {
            this.outputBuffer += ch;
        } else {
            this.outputBuffer += ch;
        }
    }

    twrConCharOut(_callingMod: unknown, ch: number, codePage: number): void {
        const char = codePointFrom(ch, codePage);
        if (char > 0) {
            this.outputBuffer += String.fromCodePoint(char);
        }
    }

    getProp(propName: string): number {
        if (propName === "type") {
            return IOTypes.CHARREAD | IOTypes.CHARWRITE;
        }
        return 0;
    }

    twrConGetProp(callingMod: { wasmMem: { getString: (idx: number) => string } }, pn: number): number {
        const propName = callingMod.wasmMem.getString(pn);
        return this.getProp(propName);
    }

    putStr(str: string): void {
        this.outputBuffer += str;
    }

    twrConPutStr(callingMod: { wasmMem: { getString: (idx: number, len?: number, codePage?: number) => string } }, chars: number, codePage: number): void {
        this.putStr(callingMod.wasmMem.getString(chars, undefined, codePage));
    }

    /** Sync getc: return next input code point or -1 (EOF). */
    twrConCharIn(): number {
        const next = this.inputQueue.shift();
        return next !== undefined ? next : -1;
    }

    twrConSetFocus(): void {
        // no-op for headless
    }

    keyDown(_ev: KeyboardEvent): void {
        // no-op; input is fed via setInput
    }
}
