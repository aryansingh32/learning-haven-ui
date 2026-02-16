import React from 'react';
import { useState } from 'react';
import { CodeExecutionModule } from '@/modules/CodeExecutor/CodeExecutionModule';
import { QuestionData } from '@/modules/CodeExecutor/types';

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
        javascript: "var twoSum = function(nums, target) {\n\n};",
        python: "",
        cpp: "",
        c: "",
        java: ""
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
