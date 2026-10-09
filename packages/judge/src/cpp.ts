// C++ "Solution class" harness. C++ has no reflection, so the method's
// signature is read here and every test's `name = value` input is turned into
// typed C++ literals at generation time. Results are printed JSON-style, so
// the shared compareOutputs() reads them like the other languages' output.
// Pure string functions; execution lives in runner.ts.

export interface CppSignature {
  returnType: CppType;
  name: string;
  params: Array<{ type: CppType; name: string }>;
}

type ScalarKind = 'int' | 'long' | 'double' | 'bool' | 'char' | 'string' | 'void';
export type CppType = { kind: ScalarKind } | { kind: 'vector'; of: CppType };

const SCALARS: Record<string, ScalarKind> = {
  int: 'int', 'unsigned': 'int', 'unsignedint': 'int', short: 'int', size_t: 'long',
  long: 'long', longlong: 'long', longint: 'long', int64_t: 'long', 'unsignedlonglong': 'long',
  double: 'double', float: 'double', longdouble: 'double',
  bool: 'bool', char: 'char', string: 'string', void: 'void',
};

export class CppSignatureError extends Error {}

/** Parse "const vector<vector<int>>&" → { kind: 'vector', of: { kind: 'vector', of: int } }. */
export function parseCppType(raw: string): CppType {
  const t = raw.replace(/\bstd::/g, '').replace(/\bconst\b/g, '').replace(/[&*]/g, '').replace(/\s+/g, ' ').trim();
  const vec = t.match(/^vector\s*<(.+)>$/);
  if (vec) {
    const of = parseCppType(vec[1]);
    if (of.kind === 'void') throw new CppSignatureError(`vector<void> is not a type`);
    return { kind: 'vector', of };
  }
  const kind = SCALARS[t.replace(/\s+/g, '')];
  if (!kind) throw new CppSignatureError(`The judge can't pass or return the type "${raw.trim()}" yet. Use int, long long, double, bool, char, string or vector of those.`);
  return { kind };
}

function cppTypeName(t: CppType): string {
  switch (t.kind) {
    case 'int': return 'int';
    case 'long': return 'long long';
    case 'double': return 'double';
    case 'bool': return 'bool';
    case 'char': return 'char';
    case 'string': return 'std::string';
    case 'void': return 'void';
    case 'vector': return `std::vector<${cppTypeName(t.of)}>`;
  }
}

/** Split "a, vector<pair<int,int>> b" on top-level commas. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '<' || ch === '(') depth++;
    if (ch === '>' || ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const NOT_METHODS = new Set(['if', 'for', 'while', 'switch', 'return', 'catch', 'Solution', 'sizeof']);

/**
 * The method to call: inside `class Solution`, the one named `hint` if present,
 * otherwise the first method. Throws CppSignatureError when there is none or a
 * type isn't supported.
 */
export function findCppMethod(code: string, hint: string): CppSignature {
  const start = code.search(/\b(class|struct)\s+Solution\b/);
  if (start < 0) throw new CppSignatureError('Keep the Solution class from the starter code — the judge calls its method.');
  const body = code.slice(start);
  const re = /([A-Za-z_][\w:<>,\s*&]*?)\s*\b([A-Za-z_]\w*)\s*\(([^()]*)\)\s*(?:const\s*)?(?:noexcept\s*)?\{/g;
  const found: Array<{ ret: string; name: string; params: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const ret = m[1].replace(/\b(public|private|protected)\s*:/g, '').replace(/\b(static|inline|virtual|constexpr)\b/g, '').trim();
    if (NOT_METHODS.has(m[2]) || !ret || /[;{}()=]/.test(ret)) continue;
    found.push({ ret, name: m[2], params: m[3] });
  }
  const pick = found.find((f) => f.name === hint) ?? found[0];
  if (!pick) throw new CppSignatureError('No method found in your Solution class.');
  const params = splitTopLevel(pick.params).map((p) => p.trim()).filter((p) => p && p !== 'void').map((p) => {
    const pm = p.replace(/=.*$/, '').trim().match(/^(.*?)([A-Za-z_]\w*)$/);
    if (!pm || !pm[1].trim()) throw new CppSignatureError(`Couldn't read the parameter "${p}".`);
    return { type: parseCppType(pm[1]), name: pm[2] };
  });
  return { returnType: parseCppType(pick.ret), name: pick.name, params };
}

/** Function the problem expects, from C++ starter code. */
export function cppFunctionHint(starter: string): string {
  try {
    return findCppMethod(starter, '').name;
  } catch {
    return '';
  }
}

// ── Literals ───────────────────────────────────────────────────────────────

class InputMismatch extends Error {}

function cppString(s: string): string {
  // Bytes as octal escapes: unlike \x, an octal escape never swallows the next character.
  let out = '"';
  for (const byte of Buffer.from(s, 'utf8')) {
    const c = String.fromCharCode(byte);
    if (c === '"' || c === '\\') out += '\\' + c;
    else if (byte >= 0x20 && byte < 0x7f && c !== '?') out += c;
    else out += '\\' + byte.toString(8).padStart(3, '0');
  }
  return out + '"';
}

export function cppLiteral(value: unknown, t: CppType): string {
  switch (t.kind) {
    case 'int':
    case 'long':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new InputMismatch();
      if (t.kind === 'int' && (value > 2147483647 || value < -2147483648)) throw new InputMismatch();
      return t.kind === 'long' ? `${value}LL` : `${value}`;
    case 'double':
      if (typeof value !== 'number') throw new InputMismatch();
      return Number.isInteger(value) ? `${value}.0` : String(value);
    case 'bool':
      if (typeof value !== 'boolean') throw new InputMismatch();
      return String(value);
    case 'char':
      if (typeof value !== 'string' || [...value].length !== 1 || Buffer.byteLength(value) !== 1) throw new InputMismatch();
      return `static_cast<char>(${value.charCodeAt(0)})`;
    case 'string':
      if (typeof value !== 'string') throw new InputMismatch();
      return `std::string(${cppString(value)}, ${Buffer.byteLength(value, 'utf8')})`;
    case 'vector':
      if (!Array.isArray(value)) throw new InputMismatch();
      return `${cppTypeName(t)}{${value.map((v) => cppLiteral(v, t.of)).join(', ')}}`;
    case 'void':
      throw new InputMismatch();
  }
}

/** Same reading of "nums = [2,7], target = 9" as the JavaScript and Python harnesses. */
export function parseInputValues(input: string): unknown[] {
  const cleaned = input.replace(/[a-zA-Z_]\w*\s*=\s*/g, '').trim();
  return cleaned ? (JSON.parse(`[${cleaned}]`) as unknown[]) : [];
}

// ── Program ────────────────────────────────────────────────────────────────

const PRINTERS = `
static void __forge_print(std::ostream& o, int v) { o << v; }
static void __forge_print(std::ostream& o, long long v) { o << v; }
static void __forge_print(std::ostream& o, bool v) { o << (v ? "true" : "false"); }
static void __forge_print(std::ostream& o, double v) {
  if (std::isnan(v) || std::isinf(v)) { o << "null"; return; }
  std::ostringstream s; s.precision(15); s << v; o << s.str();
}
static void __forge_print(std::ostream& o, const std::string& v) {
  o << '"';
  for (unsigned char c : v) {
    if (c == '"' || c == '\\\\') o << '\\\\' << c;
    else if (c == '\\n') o << "\\\\n";
    else if (c == '\\t') o << "\\\\t";
    else if (c == '\\r') o << "\\\\r";
    else if (c < 0x20) { char b[8]; std::snprintf(b, sizeof b, "\\\\u%04x", c); o << b; }
    else o << c;
  }
  o << '"';
}
static void __forge_print(std::ostream& o, char v) { __forge_print(o, std::string(1, v)); }
// Declared before the template: names used inside it must already be visible.
static void __forge_print(std::ostream& o, const std::vector<bool>& v) {
  o << '[';
  for (size_t i = 0; i < v.size(); i++) { if (i) o << ','; o << (v[i] ? "true" : "false"); }
  o << ']';
}
template <typename T> static void __forge_print(std::ostream& o, const std::vector<T>& v) {
  o << '[';
  for (size_t i = 0; i < v.size(); i++) { if (i) o << ','; __forge_print(o, v[i]); }
  o << ']';
}
`;

/**
 * Build the full program. Inputs that don't fit the signature become an
 * error line for that test instead of failing the whole compile.
 */
export function cppHarness(code: string, hint: string, marker: string, inputs: string[]): string {
  const sig = findCppMethod(code, hint);
  const mark = cppString(marker);
  const cases = inputs.map((input, i) => {
    let values: unknown[];
    try {
      values = parseInputValues(input);
    } catch {
      return `  std::printf("%sE${i}:%s\\n", ${mark}, "This test's input could not be read."); std::fflush(stdout);`;
    }
    let decls: string[];
    try {
      if (values.length !== sig.params.length) throw new InputMismatch();
      decls = sig.params.map((p, k) => `${cppTypeName(p.type)} __a${k} = ${cppLiteral(values[k], p.type)};`);
    } catch (e) {
      if (!(e instanceof InputMismatch)) throw e;
      return `  std::printf("%sE${i}:%s\\n", ${mark}, "This test's input doesn't match the parameters of ${sig.name}()."); std::fflush(stdout);`;
    }
    const args = sig.params.map((_, k) => `__a${k}`).join(', ');
    const call = sig.returnType.kind === 'void'
      ? `__s.${sig.name}(${args}); std::cout.rdbuf(__old); __out << "null";`
      : `${cppTypeName(sig.returnType)} __r = __s.${sig.name}(${args}); std::cout.rdbuf(__old); __forge_print(__out, __r);`;
    return `  {
    std::ostringstream __cap, __out; std::streambuf* __old = std::cout.rdbuf(__cap.rdbuf());
    try {
      ${decls.join(' ')}
      Solution __s;
      ${call}
      std::printf("%sO${i}:%s\\n", ${mark}, __out.str().c_str());
    } catch (const std::exception& __e) {
      std::cout.rdbuf(__old);
      std::printf("%sE${i}:%s\\n", ${mark}, __e.what());
    } catch (...) {
      std::cout.rdbuf(__old);
      std::printf("%sE${i}:%s\\n", ${mark}, "Your code threw an exception.");
    }
    std::fflush(stdout);
  }`;
  });

  return `#include <bits/stdc++.h>
using namespace std;

${code}

${PRINTERS}
int main() {
  // Your own cout output is captured per test, so it can't mix with the results.
${cases.join('\n')}
  return 0;
}
`;
}
