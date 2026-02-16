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
    python: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        `,
    cpp: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};`,
    c: `/**\n * Note: The returned array must be malloced, assume caller calls free().\n */\nint* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    \n}`,
    java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}`
};
