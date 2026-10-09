-- =============================================================================
-- C++ for in-app practice: starter code for the problems that are live today,
-- so the practice workspace offers C++ (judged on the server; Run goes to the
-- server too, sample tests only). Matched by slug; no-ops elsewhere.
--
-- Additive and re-runnable: only adds a "cpp" key where none exists.
-- Apply after 20261010000001_problem_judging.sql.
-- =============================================================================

update public.problems p
   set starter_code = p.starter_code || jsonb_build_object('cpp', s.cpp)
  from (values
    ('two-sum',             E'class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};\n'),
    ('valid-anagram',       E'class Solution {\npublic:\n    bool isAnagram(string s, string t) {\n        \n    }\n};\n'),
    ('contains-duplicate',  E'class Solution {\npublic:\n    bool containsDuplicate(vector<int>& nums) {\n        \n    }\n};\n'),
    ('group-anagrams',      E'class Solution {\npublic:\n    vector<vector<string>> groupAnagrams(vector<string>& strs) {\n        \n    }\n};\n'),
    ('top-k-frequent',      E'class Solution {\npublic:\n    vector<int> topKFrequent(vector<int>& nums, int k) {\n        \n    }\n};\n'),
    ('longest-consecutive', E'class Solution {\npublic:\n    int longestConsecutive(vector<int>& nums) {\n        \n    }\n};\n'),
    ('median-two-sorted',   E'class Solution {\npublic:\n    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {\n        \n    }\n};\n'),
    ('trapping-rain-water', E'class Solution {\npublic:\n    int trap(vector<int>& height) {\n        \n    }\n};\n')
  ) as s(slug, cpp)
 where p.slug = s.slug
   and not (p.starter_code ? 'cpp');
