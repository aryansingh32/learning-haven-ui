"""Shared helpers for the problem drafts.

A problem is written once, as a Python reference solution plus input generators.
Expected outputs are COMPUTED from the reference, never typed by hand, and
verify_problems.mjs then runs the reference through the real judge package.
All statements are original text written for Forge.
"""
import json
import random
from dataclasses import dataclass, field
from typing import Callable

# Types: int, bool, str, int[], str[], int[][], lists (list of int lists), strs (list of strings)
SCALAR_JAVA = {'int': 'int', 'bool': 'boolean', 'str': 'String', 'int[]': 'int[]', 'str[]': 'String[]'}
JAVA_RET = {**SCALAR_JAVA, 'lists': 'List<List<Integer>>', 'strs': 'List<String>'}
JS_DOC = {'int': 'number', 'bool': 'boolean', 'str': 'string', 'int[]': 'number[]', 'str[]': 'string[]',
          'int[][]': 'number[][]', 'lists': 'number[][]', 'strs': 'string[]'}
CPP = {'int': 'int', 'bool': 'bool', 'str': 'string', 'int[]': 'vector<int>&', 'str[]': 'vector<string>&',
       'int[][]': 'vector<vector<int>>&'}
CPP_RET = {'int': 'int', 'bool': 'bool', 'str': 'string', 'int[]': 'vector<int>', 'str[]': 'vector<string>',
           'int[][]': 'vector<vector<int>>', 'lists': 'vector<vector<int>>', 'strs': 'vector<string>'}


@dataclass
class P:
    slug: str
    title: str
    topic: str
    difficulty: str            # easy | medium | hard
    name: str                  # function name
    params: list               # [(name, type)]
    ret: str
    description: str
    constraints: str
    hints: list
    explanation: str           # editorial (approach + why it works)
    time: str
    space: str
    ref: Callable              # reference solution
    samples: list              # list of arg dicts, shown to learners (first two)
    edges: list = field(default_factory=list)   # hidden edge cases
    gen: Callable = None       # gen(rng) -> arg dict, for random hidden tests
    n_random: int = 4
    compare: str = 'exact'     # exact | unordered | unordered_deep
    premium: bool = False


def fmt_input(p: P, args: dict) -> str:
    return ', '.join(f'{n} = {json.dumps(args[n], separators=(",", ":"))}' for n, _ in p.params)


def fmt_output(v) -> str:
    return json.dumps(v, separators=(',', ':'))


def build_tests(p: P):
    import copy
    rng = random.Random(p.slug)  # deterministic
    cases, seen = [], set()

    def add(args, sample, why=None):
        key = fmt_input(p, args)
        if key in seen:
            return
        seen.add(key)
        out = p.ref(**copy.deepcopy(args))
        cases.append({'input': key, 'expected': fmt_output(out), 'sample': sample, 'explanation': why})

    for i, s in enumerate(p.samples):
        add(s, i < 2)
    for e in p.edges:
        add(e, False)
    tries = 0
    while p.gen and tries < 200 and len(cases) < len(p.samples) + len(p.edges) + p.n_random:
        add(p.gen(rng), False)
        tries += 1
    assert len(cases) >= 6, f'{p.slug}: only {len(cases)} tests'
    assert sum(c['sample'] for c in cases) == 2, p.slug
    return cases


def starters(p: P) -> dict:
    names = ', '.join(n for n, _ in p.params)
    doc = ''.join(f' * @param {{{JS_DOC[t]}}} {n}\n' for n, t in p.params) + f' * @return {{{JS_DOC[p.ret]}}}\n'
    out = {
        'javascript': f'/**\n{doc} */\nfunction {p.name}({names}) {{\n  \n}}\n',
        'python': f'class Solution:\n    def {p.name}(self, {names}):\n        pass\n',
    }
    if all(t in SCALAR_JAVA for _, t in p.params) and p.ret in JAVA_RET:
        jp = ', '.join(f'{SCALAR_JAVA[t]} {n}' for n, t in p.params)
        out['java'] = f'class Solution {{\n    public {JAVA_RET[p.ret]} {p.name}({jp}) {{\n        \n    }}\n}}\n'
    cp = ', '.join(f'{CPP[t]} {n}' for n, t in p.params)
    out['cpp'] = f'class Solution {{\npublic:\n    {CPP_RET[p.ret]} {p.name}({cp}) {{\n        \n    }}\n}};\n'
    return out


def python_reference_source(p: P) -> str:
    """Not used for expected outputs; verify_problems.mjs needs runnable source, so each
    problem module also exposes its reference as text via inspect."""
    import inspect, textwrap
    src = textwrap.dedent(inspect.getsource(p.ref))
    return src
