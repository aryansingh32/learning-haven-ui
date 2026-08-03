import React, { useState } from 'react';
import { CodeExecutionModule } from '@/modules/CodeExecutor/CodeExecutionModule';
import { QuestionData } from '@/modules/CodeExecutor/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const QUESTIONS: QuestionData[] = [
    // ─── 1. LEARNING PLAYGROUND ──────────────────────────────────────────────────
    {
        id: 'playground',
        title: '🎓 Learning Playground',
        difficulty: 'Easy',
        description: `# Welcome to the Code Playground!

Write **any code** and click **Run** to see the output instantly.

This is a real compiler running in your browser — no servers, no sign-up needed.

---

### What you can do here:
- ✅ **Variables** — store and print values
- ✅ **Loops** — for, while, range
- ✅ **Functions** — define and call your own
- ✅ **Recursion** — functions that call themselves
- ✅ **Data structures** — arrays, lists, dicts
- ✅ **Logic** — if/else, comparisons
- ✅ **Math** — arithmetic, built-in functions

> 💡 **Tip:** Switch between Python, JavaScript, and C++ using the dropdown above the editor!

---

### Languages supported:
| Language | Runtime |
|----------|---------|
| JavaScript | V8 Engine (browser) |
| Python | Pyodide (Wasm) |
| C++ | JSCPP (Wasm) |
| C | JSCPP (Wasm) |
`,
        examples: [],
        constraints: [],
        starterCode: {
            javascript: `// ─── JavaScript Playground ───────────────────────────────────
// Edit this code and click Run!

// Variables
let name = "Alice";
let age = 20;
console.log("Hello,", name, "- Age:", age);

// Loop
let sum = 0;
for (let i = 1; i <= 10; i++) sum += i;
console.log("Sum 1..10 =", sum);

// Function
function greet(person) {
    return \`Hi \${person}!\`;
}
console.log(greet("Bob"));

// Recursion
function factorial(n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
}
console.log("5! =", factorial(5));

// Arrays
const squares = [1, 2, 3, 4, 5].map(x => x * x);
console.log("Squares:", squares);
`,
            python: `# ─── Python Playground ───────────────────────────────────────
# Edit this code and click Run!

# Variables
name = "Alice"
age = 20
print(f"Hello, {name} - Age: {age}")

# Loops
total = 0
for i in range(1, 11):
    total += i
print(f"Sum 1..10 = {total}")

# Function
def greet(person):
    return f"Hi {person}!"

print(greet("Bob"))

# Recursion
def factorial(n):
    return 1 if n <= 1 else n * factorial(n - 1)

print("5! =", factorial(5))

# List comprehensions
squares = [x ** 2 for x in range(1, 6)]
print("Squares:", squares)

# Dictionary
person = {"name": "Charlie", "age": 25}
print("Person:", person)
`,
            cpp: `// ─── C++ Playground ──────────────────────────────────────────
// Edit this code and click Run!
// Note: uses JSCPP (browser C++ interpreter)

#include <iostream>
using namespace std;

// Function (use int params — JSCPP has limited string support)
int add(int a, int b) {
    return a + b;
}

// Recursion
int factorial(int n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
}

int main() {
    // Variables
    int age = 20;
    int score = 95;
    cout << "Age: " << age << ", Score: " << score << endl;

    // Loop & sum
    int sum = 0;
    for (int i = 1; i <= 10; i++) sum += i;
    cout << "Sum 1..10 = " << sum << endl;

    // Function
    cout << "3 + 7 = " << add(3, 7) << endl;

    // Recursion
    cout << "5! = " << factorial(5) << endl;

    // Array
    int nums[] = {1, 2, 3, 4, 5};
    cout << "Squares: ";
    for (int i = 0; i < 5; i++) cout << nums[i] * nums[i] << " ";
    cout << endl;

    return 0;
}
`,
            c: `/* ─── C Playground ──────────────────────────────────────────── */
#include <stdio.h>

int factorial(int n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
}

int main() {
    int age = 20;
    printf("Hello, Alice - Age: %d\\n", age);

    int sum = 0, i;
    for (i = 1; i <= 10; i++) sum += i;
    printf("Sum 1..10 = %d\\n", sum);

    printf("Hi Bob!\\n");
    printf("5! = %d\\n", factorial(5));

    int nums[] = {1, 2, 3, 4, 5};
    printf("Squares: ");
    for (i = 0; i < 5; i++) printf("%d ", nums[i] * nums[i]);
    printf("\\n");

    return 0;
}
`,
            java: `// Java needs the backend server (javac/java).
// Use JavaScript, Python, or C++ to run code here.
class Solution {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}
`
        }
    },

    // ─── 2. TWO SUM ───────────────────────────────────────────────────────────────
    {
        id: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        description: `Given an array of integers \`nums\` and an integer \`target\`, return _indices of the two numbers such that they add up to \`target\`_.`,
        examples: [
            { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
            { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
            { input: "nums = [3,3], target = 6", output: "[0,1]" },
            { input: "nums = [-3,4,3,90], target = 0", output: "[0,2]" }
        ],
        constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
        starterCode: {
            javascript: `var twoSum = function(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const diff = target - nums[i];
        if (map.has(diff)) return [map.get(diff), i];
        map.set(nums[i], i);
    }
};`,
            python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, n in enumerate(nums):
            diff = target - n
            if diff in seen:
                return [seen[diff], i]
            seen[n] = i`,
            cpp: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    int nums[10000];
    for (int i = 0; i < n; i++) cin >> nums[i];
    int target;
    cin >> target;

    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (nums[i] + nums[j] == target) {
                cout << "[" << i << "," << j << "]";
                return 0;
            }
        }
    }
    return 0;
}`,
            c: `#include <stdio.h>
int main() {
    int n, i, j;
    scanf("%d", &n);
    int nums[10000];
    for (i = 0; i < n; i++) scanf("%d", &nums[i]);
    int target;
    scanf("%d", &target);
    for (i = 0; i < n; i++)
        for (j = i + 1; j < n; j++)
            if (nums[i] + nums[j] == target) {
                printf("[%d,%d]", i, j);
                return 0;
            }
    return 0;
}`,
            java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        java.util.Map<Integer, Integer> map = new java.util.HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int diff = target - nums[i];
            if (map.containsKey(diff)) return new int[]{map.get(diff), i};
            map.put(nums[i], i);
        }
        return new int[]{};
    }
}`
        }
    },

    // ─── 3. VALID PARENTHESES ─────────────────────────────────────────────────────
    {
        id: 'valid-parens',
        title: 'Valid Parentheses',
        difficulty: 'Easy',
        description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.`,
        examples: [
            { input: 's = "()"', output: "true" },
            { input: 's = "()[]{}"', output: "true" },
            { input: 's = "(]"', output: "false" }
        ],
        constraints: ["1 <= s.length <= 10^4"],
        starterCode: {
            javascript: `var isValid = function(s) {
    const stack = [];
    const map = { ')': '(', '}': '{', ']': '[' };
    for (const char of s) {
        if (!map[char]) stack.push(char);
        else if (stack.pop() !== map[char]) return false;
    }
    return stack.length === 0;
};`,
            python: `class Solution:
    def isValid(self, s: str) -> bool:
        stack = []
        mapping = {")": "(", "}": "{", "]": "["}
        for char in s:
            if char in mapping:
                if not stack or stack[-1] != mapping[char]:
                    return False
                stack.pop()
            else:
                stack.append(char)
        return not stack`,
            cpp: `#include <iostream>
#include <string>
#include <vector>
using namespace std;

int main() {
    string s;
    cin >> s;
    // Strip surrounding quotes if present
    if (s.front() == '"') s = s.substr(1, s.size() - 2);

    vector<char> stack;
    for (char c : s) {
        if (c == '(' || c == '{' || c == '[') stack.push_back(c);
        else {
            if (stack.empty()) { cout << "false"; return 0; }
            char top = stack.back();
            if ((c == ')' && top == '(') ||
                (c == '}' && top == '{') ||
                (c == ']' && top == '['))
                stack.pop_back();
            else { cout << "false"; return 0; }
        }
    }
    cout << (stack.empty() ? "true" : "false");
    return 0;
}`,
            c: `// Use C++ for this problem`,
            java: `// Java needs backend server`
        }
    },

    // ─── 4. REVERSE INTEGER ──────────────────────────────────────────────────────
    {
        id: 'reverse-int',
        title: 'Reverse Integer',
        difficulty: 'Medium',
        description: `Given a signed 32-bit integer x, return x with its digits reversed. If reversing x causes the value to go outside the signed 32-bit integer range, return 0.`,
        examples: [
            { input: 'x = 123', output: "321" },
            { input: 'x = -123', output: "-321" },
            { input: 'x = 120', output: "21" }
        ],
        constraints: ["-2^31 <= x <= 2^31 - 1"],
        starterCode: {
            javascript: `var reverse = function(x) {
    const sign = x < 0 ? -1 : 1;
    const reversed = parseInt(Math.abs(x).toString().split('').reverse().join('')) * sign;
    if (reversed < Math.pow(-2, 31) || reversed > Math.pow(2, 31) - 1) return 0;
    return reversed;
};`,
            python: `class Solution:
    def reverse(self, x: int) -> int:
        sign = -1 if x < 0 else 1
        rev = int(str(abs(x))[::-1]) * sign
        if rev < -(2**31) or rev > 2**31 - 1:
            return 0
        return rev`,
            cpp: `#include <iostream>
#include <climits>
using namespace std;

int main() {
    int x;
    cin >> x;
    int rev = 0;
    while (x != 0) {
        int pop = x % 10;
        x /= 10;
        if (rev > INT_MAX / 10) { cout << 0; return 0; }
        if (rev < INT_MIN / 10) { cout << 0; return 0; }
        rev = rev * 10 + pop;
    }
    cout << rev;
    return 0;
}`,
            c: `#include <stdio.h>
#include <limits.h>
int main() {
    int x, rev = 0;
    scanf("%d", &x);
    while (x != 0) {
        int pop = x % 10;
        x /= 10;
        if (rev > INT_MAX / 10 || rev < INT_MIN / 10) { printf("0"); return 0; }
        rev = rev * 10 + pop;
    }
    printf("%d", rev);
    return 0;
}`,
            java: `// Java needs backend server`
        }
    }
];

const CodeExecutorTest = () => {
    const [selectedId, setSelectedId] = useState('playground');
    const question = QUESTIONS.find(q => q.id === selectedId) || QUESTIONS[0];

    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col">
            {/* Test switcher */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-zinc-900/90 backdrop-blur-sm px-3 py-2 rounded-xl border border-border shadow-xl">
                <span className="text-xs font-semibold text-zinc-400">Mode:</span>
                <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger className="w-[200px] h-7 text-xs">
                        <SelectValue placeholder="Select question" />
                    </SelectTrigger>
                    <SelectContent>
                        {QUESTIONS.map(q => (
                            <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <CodeExecutionModule
                key={question.id}
                question={question}
                onSolved={(stats) => console.log('Solved!', stats)}
            />
        </div>
    );
};

export default CodeExecutorTest;
