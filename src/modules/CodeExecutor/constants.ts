import { SupportedLanguage } from "./types";

export const LANGUAGE_OPTIONS: { label: string; value: SupportedLanguage }[] = [
    { label: "JavaScript", value: "javascript" },
    { label: "Python", value: "python" },
    { label: "C++", value: "cpp" },
    { label: "C", value: "c" },
    { label: "Java", value: "java" },
];

export const DEFAULT_CODE_TEMPLATES: Record<SupportedLanguage, string> = {
    javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    \n};`,
    python: `from typing import List\n\nclass Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        pass\n`,
    cpp: `#include <iostream>\nusing namespace std;\n\n// Read input from cin, write output to cout\nint main() {\n    int n;\n    cin >> n;\n    int nums[10000];\n    for (int i = 0; i < n; i++) cin >> nums[i];\n    int target;\n    cin >> target;\n\n    // Two Sum: find indices i,j where nums[i]+nums[j]==target\n    for (int i = 0; i < n; i++) {\n        for (int j = i + 1; j < n; j++) {\n            if (nums[i] + nums[j] == target) {\n                cout << "[" << i << "," << j << "]";\n                return 0;\n            }\n        }\n    }\n    return 0;\n}`,
    c: `#include <stdio.h>\n\nint main() {\n    int n;\n    scanf("%d", &n);\n    int nums[10000];\n    for (int i = 0; i < n; i++) scanf("%d", &nums[i]);\n    int target;\n    scanf("%d", &target);\n\n    // Two Sum: find indices i,j where nums[i]+nums[j]==target\n    for (int i = 0; i < n; i++) {\n        for (int j = i + 1; j < n; j++) {\n            if (nums[i] + nums[j] == target) {\n                printf("[%d,%d]", i, j);\n                return 0;\n            }\n        }\n    }\n    return 0;\n}`,
    java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}`
};
