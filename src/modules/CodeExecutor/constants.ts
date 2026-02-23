import { SupportedLanguage } from "./types";

export const LANGUAGE_OPTIONS: { label: string; value: SupportedLanguage }[] = [
    { label: "JavaScript", value: "javascript" },
    { label: "Python", value: "python" },
    { label: "C++", value: "cpp" },
    { label: "C", value: "c" },
    { label: "Java", value: "java" },
];

export const DEFAULT_CODE_TEMPLATES: Record<SupportedLanguage, string> = {
    javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const diff = target - nums[i];
        if (map.has(diff)) return [map.get(diff), i];
        map.set(nums[i], i);
    }
};`,
    python: `from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            diff = target - n
            if diff in seen:
                return [seen[diff], i]
            seen[n] = i
`,
    cpp: `#include <iostream>
using namespace std;

int main() {
    // Input is preprocessed: first line = array size, second = elements, third = target
    int n;
    cin >> n;
    int nums[10000];
    for (int i = 0; i < n; i++) cin >> nums[i];
    int target;
    cin >> target;

    // Two Sum: find indices i,j where nums[i]+nums[j]==target
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
    int n;
    scanf("%d", &n);
    int nums[10000];
    int i, j;
    for (i = 0; i < n; i++) scanf("%d", &nums[i]);
    int target;
    scanf("%d", &target);

    for (i = 0; i < n; i++) {
        for (j = i + 1; j < n; j++) {
            if (nums[i] + nums[j] == target) {
                printf("[%d,%d]", i, j);
                return 0;
            }
        }
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
};
