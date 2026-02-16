-- Insert sample problems for testing
INSERT INTO public.problems (slug, title, description, difficulty, topic, companies, hints, solution_code, time_complexity, space_complexity, is_premium, order_index) VALUES

-- Easy Problems
('two-sum', 'Two Sum', 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.', 'easy', 'Arrays & Hashing', ARRAY['Amazon', 'Google', 'Microsoft'], 
ARRAY['Try using a hash map to store numbers you''ve seen', 'For each number, check if target - number exists in the map'],
'{"javascript": "function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return [map.get(complement), i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}", "python": "def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []"}',
'O(n)', 'O(n)', FALSE, 1),

('valid-anagram', 'Valid Anagram', 'Given two strings s and t, return true if t is an anagram of s, and false otherwise.', 'easy', 'Arrays & Hashing', ARRAY['Amazon', 'Bloomberg'],
ARRAY['Count character frequencies', 'Compare frequency maps'],
'{"javascript": "function isAnagram(s, t) {\n  if (s.length !== t.length) return false;\n  const count = {};\n  for (const char of s) count[char] = (count[char] || 0) + 1;\n  for (const char of t) {\n    if (!count[char]) return false;\n    count[char]--;\n  }\n  return true;\n}", "python": "def is_anagram(s, t):\n    if len(s) != len(t):\n        return False\n    return sorted(s) == sorted(t)"}',
'O(n)', 'O(1)', FALSE, 2),

('contains-duplicate', 'Contains Duplicate', 'Given an integer array nums, return true if any value appears at least twice in the array.', 'easy', 'Arrays & Hashing', ARRAY['Google', 'Microsoft'],
ARRAY['Use a set to track seen numbers', 'Set size will differ from array length if duplicates exist'],
'{"javascript": "function containsDuplicate(nums) {\n  return new Set(nums).size !== nums.length;\n}", "python": "def contains_duplicate(nums):\n    return len(set(nums)) != len(nums)"}',
'O(n)', 'O(n)', FALSE, 3),

-- Medium Problems
('group-anagrams', 'Group Anagrams', 'Given an array of strings strs, group the anagrams together.', 'medium', 'Arrays & Hashing', ARRAY['Amazon', 'Facebook', 'Uber'],
ARRAY['Sort each string to use as a key', 'Use a hash map with sorted string as key'],
'{"javascript": "function groupAnagrams(strs) {\n  const map = new Map();\n  for (const str of strs) {\n    const key = str.split('''').sort().join('''');\n    if (!map.has(key)) map.set(key, []);\n    map.get(key).push(str);\n  }\n  return Array.from(map.values());\n}"}',
'O(n * k log k)', 'O(n * k)', FALSE, 4),

('top-k-frequent', 'Top K Frequent Elements', 'Given an integer array nums and an integer k, return the k most frequent elements.', 'medium', 'Arrays & Hashing', ARRAY['Amazon', 'Facebook'],
ARRAY['Count frequencies first', 'Use bucket sort for optimal solution'],
'{"javascript": "function topKFrequent(nums, k) {\n  const count = new Map();\n  for (const num of nums) count.set(num, (count.get(num) || 0) + 1);\n  return Array.from(count.entries())\n    .sort((a, b) => b[1] - a[1])\n    .slice(0, k)\n    .map(entry => entry[0]);\n}"}',
'O(n log n)', 'O(n)', FALSE, 5),

('longest-consecutive', 'Longest Consecutive Sequence', 'Given an unsorted array of integers nums, return the length of the longest consecutive elements sequence.', 'medium', 'Arrays & Hashing', ARRAY['Google', 'Facebook'],
ARRAY['Use a set for O(1) lookups', 'Only start counting from the beginning of a sequence'],
'{"javascript": "function longestConsecutive(nums) {\n  const set = new Set(nums);\n  let longest = 0;\n  for (const num of set) {\n    if (!set.has(num - 1)) {\n      let length = 1;\n      while (set.has(num + length)) length++;\n      longest = Math.max(longest, length);\n    }\n  }\n  return longest;\n}"}',
'O(n)', 'O(n)', FALSE, 6),

-- Hard Problems (Premium)
('median-two-sorted', 'Median of Two Sorted Arrays', 'Given two sorted arrays nums1 and nums2, return the median of the two sorted arrays.', 'hard', 'Binary Search', ARRAY['Google', 'Amazon'],
ARRAY['Use binary search on the smaller array', 'Find the partition that splits both arrays correctly'],
'{"javascript": "function findMedianSortedArrays(nums1, nums2) {\n  if (nums1.length > nums2.length) [nums1, nums2] = [nums2, nums1];\n  const m = nums1.length, n = nums2.length;\n  let left = 0, right = m;\n  while (left <= right) {\n    const i = Math.floor((left + right) / 2);\n    const j = Math.floor((m + n + 1) / 2) - i;\n    const maxLeft1 = i === 0 ? -Infinity : nums1[i - 1];\n    const minRight1 = i === m ? Infinity : nums1[i];\n    const maxLeft2 = j === 0 ? -Infinity : nums2[j - 1];\n    const minRight2 = j === n ? Infinity : nums2[j];\n    if (maxLeft1 <= minRight2 && maxLeft2 <= minRight1) {\n      if ((m + n) % 2 === 0) {\n        return (Math.max(maxLeft1, maxLeft2) + Math.min(minRight1, minRight2)) / 2;\n      }\n      return Math.max(maxLeft1, maxLeft2);\n    } else if (maxLeft1 > minRight2) {\n      right = i - 1;\n    } else {\n      left = i + 1;\n    }\n  }\n}"}',
'O(log(min(m,n)))', 'O(1)', TRUE, 7),

('trapping-rain-water', 'Trapping Rain Water', 'Given n non-negative integers representing an elevation map, compute how much water it can trap after raining.', 'hard', 'Two Pointers', ARRAY['Amazon', 'Google', 'Bloomberg'],
ARRAY['Use two pointers from both ends', 'Track max height from left and right'],
'{"javascript": "function trap(height) {\n  let left = 0, right = height.length - 1;\n  let leftMax = 0, rightMax = 0, water = 0;\n  while (left < right) {\n    if (height[left] < height[right]) {\n      if (height[left] >= leftMax) leftMax = height[left];\n      else water += leftMax - height[left];\n      left++;\n    } else {\n      if (height[right] >= rightMax) rightMax = height[right];\n      else water += rightMax - height[right];\n      right--;\n    }\n  }\n  return water;\n}"}',
'O(n)', 'O(1)', TRUE, 8);

-- Update problem counts for topics
UPDATE public.problems SET solved_count = 0, acceptance_rate = 0;
