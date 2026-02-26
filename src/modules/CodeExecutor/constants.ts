import { SupportedLanguage } from "./types";

export const LANGUAGE_OPTIONS: { label: string; value: SupportedLanguage }[] = [
    { label: "JavaScript", value: "javascript" },
    { label: "Python", value: "python" },
    { label: "C++", value: "cpp" },
    { label: "C", value: "c" },
    { label: "Java", value: "java" },
];

/**
 * Default starter code for each language.
 * These are free-form learning examples — just run them to see output!
 * The compiler supports both free-form mode (like here) and LeetCode problem mode.
 */
export const DEFAULT_CODE_TEMPLATES: Record<SupportedLanguage, string> = {
    javascript: `// ─── JavaScript Playground ───────────────────────────────────────
// Just write code and click Run to see the output!

// 1. Variables & Types
let name = "Alice";
let age = 20;
let isStudent = true;
console.log("Name:", name, "| Age:", age, "| Student:", isStudent);

// 2. Loops
let sum = 0;
for (let i = 1; i <= 10; i++) sum += i;
console.log("Sum 1 to 10:", sum);

// 3. Functions
function greet(person) {
    return \`Hello, \${person}!\`;
}
console.log(greet("Bob"));

// 4. Recursion
function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
console.log("5! =", factorial(5));

// 5. Arrays & Higher-order functions
const nums = [1, 2, 3, 4, 5];
const squares = nums.map(x => x * x);
const evens  = nums.filter(x => x % 2 === 0);
console.log("Squares:", squares);
console.log("Evens:  ", evens);

// 6. Objects
const person = { name: "Charlie", age: 25, city: "Delhi" };
console.log("Person:", JSON.stringify(person));
`,

    python: `# ─── Python Playground ───────────────────────────────────────────
# Just write code and click Run to see the output!

# 1. Variables & Types
name = "Alice"
age = 20
is_student = True
print(f"Name: {name} | Age: {age} | Student: {is_student}")

# 2. Loops
total = sum(range(1, 11))
print("Sum 1 to 10:", total)

for i in range(1, 6):
    print("*" * i)

# 3. Functions
def greet(person):
    return f"Hello, {person}!"

print(greet("Bob"))

# 4. Recursion
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print("5! =", factorial(5))

# 5. Lists & Comprehensions
nums = [1, 2, 3, 4, 5]
squares = [x ** 2 for x in nums]
evens   = [x for x in nums if x % 2 == 0]
print("Squares:", squares)
print("Evens:  ", evens)

# 6. Dictionary
person = {"name": "Charlie", "age": 25, "city": "Delhi"}
print("Person:", person)
`,

    cpp: `// ─── C++ Playground ──────────────────────────────────────────────
// Edit this code and click Run to see real output!
// Note: uses JSCPP (browser-based C++ interpreter)

#include <iostream>
using namespace std;

// Functions returning int
int add(int a, int b) {
    return a + b;
}

// Recursion
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    // 1. Variables
    int age = 20;
    int score = 95;
    cout << "Age: " << age << ", Score: " << score << endl;

    // 2. Loop & sum
    int sum = 0;
    for (int i = 1; i <= 10; i++) sum += i;
    cout << "Sum 1..10 = " << sum << endl;

    // 3. Star pattern
    for (int i = 1; i <= 5; i++) {
        for (int j = 0; j < i; j++) cout << "*";
        cout << endl;
    }

    // 4. Function
    cout << "3 + 7 = " << add(3, 7) << endl;

    // 5. Recursion
    cout << "5! = " << factorial(5) << endl;

    // 6. Array
    int nums[] = {1, 2, 3, 4, 5};
    cout << "Squares: ";
    for (int i = 0; i < 5; i++) cout << nums[i] * nums[i] << " ";
    cout << endl;

    return 0;
}
`,

    c: `/* ─── C Playground ─────────────────────────────────────────────── */
#include <stdio.h>

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int add(int a, int b) { return a + b; }

int main() {
    /* 1. Variables */
    int age = 20;
    int score = 95;
    printf("Age: %d, Score: %d\n", age, score);

    /* 2. Loops */
    int sum = 0, i, j;
    for (i = 1; i <= 10; i++) sum += i;
    printf("Sum 1..10 = %d\n", sum);

    for (i = 1; i <= 5; i++) {
        for (j = 0; j < i; j++) printf("*");
        printf("\n");
    }

    /* 3. Function */
    printf("3 + 7 = %d\n", add(3, 7));

    /* 4. Recursion */
    printf("5! = %d\n", factorial(5));

    /* 5. Array */
    int nums[] = {1, 2, 3, 4, 5};
    printf("Squares: ");
    for (i = 0; i < 5; i++) printf("%d ", nums[i] * nums[i]);
    printf("\n");

    return 0;
}
`,

    java: `// Java requires the backend server. Use JavaScript, Python, or C++ to run code in-browser.
// Start the backend with: cd backend && npm run dev

class Solution {
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
};
