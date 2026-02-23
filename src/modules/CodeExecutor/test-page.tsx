import React from 'react';
import { CodeExecutionModule } from '@/modules/CodeExecutor/CodeExecutionModule';
import { QuestionData } from '@/modules/CodeExecutor/types';

/**
 * Sample question with properly formatted test cases.
 * Input format must match what the workers expect:
 *   - JS/Python: "nums = [2,7,11,15], target = 9" (LeetCode format)
 *   - C/C++:     stdin-style input parsed by the code itself
 *   - Java:      Same as JS/Python (parsed via reflection)
 */
const SAMPLE_QUESTION: QuestionData = {
    id: '1',
    title: 'Two Sum',
    difficulty: 'Easy',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return _indices of the two numbers such that they add up to \`target\`_.

You may assume that each input would have **exactly one solution**, and you may not use the *same* element twice.

You can return the answer in any order.

### Example 1:
**Input:** nums = [2,7,11,15], target = 9
**Output:** [0,1]
**Explanation:** Because nums[0] + nums[1] == 9, we return [0, 1].

### Example 2:
**Input:** nums = [3,2,4], target = 6
**Output:** [1,2]

### Example 3:
**Input:** nums = [3,3], target = 6
**Output:** [0,1]
`,
    examples: [
        { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
        { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
        { input: "nums = [3,3], target = 6", output: "[0,1]" }
    ],
    constraints: [
        "2 <= nums.length <= 10^4",
        "-10^9 <= nums[i] <= 10^9",
        "-10^9 <= target <= 10^9",
        "Only one valid answer exists."
    ],
    starterCode: {
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
        python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, n in enumerate(nums):
            diff = target - n
            if diff in seen:
                return [seen[diff], i]
            seen[n] = i
`,
        cpp: `#include <iostream>
using namespace std;

// Read input from cin, write output to cout
int main() {
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
    for (int i = 0; i < n; i++) scanf("%d", &nums[i]);
    int target;
    scanf("%d", &target);

    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
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
    }
};

const CodeExecutorTest = () => {
    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col">
            <CodeExecutionModule
                question={SAMPLE_QUESTION}
                onSolved={(stats) => console.log('Question Solved!', stats)}
            />
        </div>
    );
};

export default CodeExecutorTest;
