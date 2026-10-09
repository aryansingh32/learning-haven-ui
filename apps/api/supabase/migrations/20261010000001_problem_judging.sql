-- =============================================================================
-- In-app coding practice: test cases, starter code and judge settings for
-- problems, so learners solve problems inside Forge and the server can judge
-- a submission instead of trusting the browser.
--
-- Additive only: one new table, two new columns with defaults. Like
-- public.problems, the new table has RLS on and no client policies: the API
-- (service role) reads it and sends learners the sample tests only. Hidden
-- tests never leave the server.
-- =============================================================================

create table if not exists public.problem_test_cases (
  id              uuid primary key default gen_random_uuid(),
  problem_id      uuid not null references public.problems(id) on delete cascade,
  input           text not null,               -- LeetCode style: "nums = [2,7,11,15], target = 9"
  expected_output text not null,               -- printed value, compared with compareOutputs()
  is_sample       boolean not null default false,
  explanation     text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_problem_test_cases_problem on public.problem_test_cases (problem_id, sort_order);
alter table public.problem_test_cases enable row level security;

alter table public.problems
  add column if not exists starter_code jsonb not null default '{}'::jsonb,   -- { "javascript": "...", "python": "...", "java": "..." }
  add column if not exists judge_config jsonb not null default '{}'::jsonb;   -- { "compare": "exact" | "unordered" | "unordered_deep" }

alter table public.problems
  drop constraint if exists problems_judge_compare_check,
  add constraint problems_judge_compare_check
    check (coalesce(judge_config->>'compare', 'exact') in ('exact', 'unordered', 'unordered_deep'));

-- ── Content for the problems that are live today (matched by slug; no-ops elsewhere) ──

drop table if exists pg_temp._seed;
create temporary table _seed (slug text, compare text, starter jsonb, constraints text, tests jsonb);

insert into _seed values
('two-sum', 'unordered',
 jsonb_build_object(
   'javascript', E'/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nfunction twoSum(nums, target) {\n  \n}\n',
   'python', E'class Solution:\n    def twoSum(self, nums, target):\n        pass\n',
   'java', E'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}\n'),
 E'2 <= nums.length <= 10^4\n-10^9 <= nums[i], target <= 10^9\nExactly one valid answer exists. Return the two indices in any order.',
 '[["nums = [2,7,11,15], target = 9","[0,1]",true,"nums[0] + nums[1] == 9"],
   ["nums = [3,2,4], target = 6","[1,2]",true,null],
   ["nums = [3,3], target = 6","[0,1]",false,null],
   ["nums = [-1,-2,-3,-4,-5], target = -8","[2,4]",false,null],
   ["nums = [0,4,3,0], target = 0","[0,3]",false,null],
   ["nums = [1,5,9,13,20], target = 33","[3,4]",false,null]]'),
('valid-anagram', 'exact',
 jsonb_build_object(
   'javascript', E'/**\n * @param {string} s\n * @param {string} t\n * @return {boolean}\n */\nfunction isAnagram(s, t) {\n  \n}\n',
   'python', E'class Solution:\n    def isAnagram(self, s, t):\n        pass\n',
   'java', E'class Solution {\n    public boolean isAnagram(String s, String t) {\n        \n    }\n}\n'),
 E'0 <= s.length, t.length <= 5 * 10^4\ns and t contain lowercase English letters.',
 '[["s = \"anagram\", t = \"nagaram\"","true",true,null],
   ["s = \"rat\", t = \"car\"","false",true,null],
   ["s = \"a\", t = \"ab\"","false",false,null],
   ["s = \"aacc\", t = \"ccac\"","false",false,null],
   ["s = \"listen\", t = \"silent\"","true",false,null],
   ["s = \"\", t = \"\"","true",false,null]]'),
('contains-duplicate', 'exact',
 jsonb_build_object(
   'javascript', E'/**\n * @param {number[]} nums\n * @return {boolean}\n */\nfunction containsDuplicate(nums) {\n  \n}\n',
   'python', E'class Solution:\n    def containsDuplicate(self, nums):\n        pass\n',
   'java', E'class Solution {\n    public boolean containsDuplicate(int[] nums) {\n        \n    }\n}\n'),
 E'0 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9',
 '[["nums = [1,2,3,1]","true",true,"1 appears twice"],
   ["nums = [1,2,3,4]","false",true,null],
   ["nums = [1,1,1,3,3,4,3,2,4,2]","true",false,null],
   ["nums = [7]","false",false,null],
   ["nums = [-1,-1]","true",false,null],
   ["nums = []","false",false,null]]'),
('group-anagrams', 'unordered_deep',
 jsonb_build_object(
   'javascript', E'/**\n * @param {string[]} strs\n * @return {string[][]}\n */\nfunction groupAnagrams(strs) {\n  \n}\n',
   'python', E'class Solution:\n    def groupAnagrams(self, strs):\n        pass\n',
   'java', E'class Solution {\n    public List<List<String>> groupAnagrams(String[] strs) {\n        \n    }\n}\n'),
 E'1 <= strs.length <= 10^4\nstrs[i] contains lowercase English letters.\nGroups and the words inside them may be in any order.',
 '[["strs = [\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]","[[\"bat\"],[\"nat\",\"tan\"],[\"ate\",\"eat\",\"tea\"]]",true,null],
   ["strs = [\"a\"]","[[\"a\"]]",true,null],
   ["strs = [\"abc\",\"bca\",\"cab\",\"xyz\"]","[[\"abc\",\"bca\",\"cab\"],[\"xyz\"]]",false,null],
   ["strs = [\"ab\",\"ba\",\"ab\"]","[[\"ab\",\"ba\",\"ab\"]]",false,null],
   ["strs = [\"x\",\"y\",\"z\"]","[[\"x\"],[\"y\"],[\"z\"]]",false,null]]'),
('top-k-frequent', 'unordered',
 jsonb_build_object(
   'javascript', E'/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number[]}\n */\nfunction topKFrequent(nums, k) {\n  \n}\n',
   'python', E'class Solution:\n    def topKFrequent(self, nums, k):\n        pass\n',
   'java', E'class Solution {\n    public int[] topKFrequent(int[] nums, int k) {\n        \n    }\n}\n'),
 E'1 <= nums.length <= 10^5\nk is between 1 and the number of distinct values.\nThe answer is unique; return it in any order.',
 '[["nums = [1,1,1,2,2,3], k = 2","[1,2]",true,null],
   ["nums = [1], k = 1","[1]",true,null],
   ["nums = [4,4,4,5,5,6], k = 1","[4]",false,null],
   ["nums = [1,2,2,3,3,3], k = 2","[3,2]",false,null],
   ["nums = [5,5,6,6,6,7], k = 2","[6,5]",false,null]]'),
('longest-consecutive', 'exact',
 jsonb_build_object(
   'javascript', E'/**\n * @param {number[]} nums\n * @return {number}\n */\nfunction longestConsecutive(nums) {\n  \n}\n',
   'python', E'class Solution:\n    def longestConsecutive(self, nums):\n        pass\n',
   'java', E'class Solution {\n    public int longestConsecutive(int[] nums) {\n        \n    }\n}\n'),
 E'0 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9\nAim for O(n) time.',
 '[["nums = [100,4,200,1,3,2]","4",true,"The run is 1, 2, 3, 4"],
   ["nums = [0,3,7,2,5,8,4,6,0,1]","9",true,null],
   ["nums = []","0",false,null],
   ["nums = [1,2,0,1]","3",false,null],
   ["nums = [9]","1",false,null],
   ["nums = [10,5,12,3,55,30,4,11,2]","4",false,null]]'),
('median-two-sorted', 'exact',
 jsonb_build_object(
   'javascript', E'/**\n * @param {number[]} nums1\n * @param {number[]} nums2\n * @return {number}\n */\nfunction findMedianSortedArrays(nums1, nums2) {\n  \n}\n',
   'python', E'class Solution:\n    def findMedianSortedArrays(self, nums1, nums2):\n        pass\n',
   'java', E'class Solution {\n    public double findMedianSortedArrays(int[] nums1, int[] nums2) {\n        \n    }\n}\n'),
 E'0 <= m, n <= 1000 and 1 <= m + n\nBoth arrays are sorted.\nAim for O(log(m + n)) time.',
 '[["nums1 = [1,3], nums2 = [2]","2",true,"Merged: [1,2,3], median 2"],
   ["nums1 = [1,2], nums2 = [3,4]","2.5",true,"Merged: [1,2,3,4], median (2 + 3) / 2"],
   ["nums1 = [], nums2 = [1]","1",false,null],
   ["nums1 = [0,0], nums2 = [0,0]","0",false,null],
   ["nums1 = [2], nums2 = []","2",false,null],
   ["nums1 = [1,3,5], nums2 = [2,4,6]","3.5",false,null]]'),
('trapping-rain-water', 'exact',
 jsonb_build_object(
   'javascript', E'/**\n * @param {number[]} height\n * @return {number}\n */\nfunction trap(height) {\n  \n}\n',
   'python', E'class Solution:\n    def trap(self, height):\n        pass\n',
   'java', E'class Solution {\n    public int trap(int[] height) {\n        \n    }\n}\n'),
 E'0 <= height.length <= 2 * 10^4\n0 <= height[i] <= 10^5',
 '[["height = [0,1,0,2,1,0,1,3,2,1,2,1]","6",true,null],
   ["height = [4,2,0,3,2,5]","9",true,null],
   ["height = []","0",false,null],
   ["height = [3,0,3]","3",false,null],
   ["height = [1,2,3]","0",false,null],
   ["height = [5,4,1,2]","1",false,null]]');

update public.problems p
   set starter_code = s.starter,
       judge_config = jsonb_build_object('compare', s.compare),
       constraints  = coalesce(p.constraints, s.constraints)
  from _seed s
 where p.slug = s.slug;

-- Only seed tests for a problem that has none yet, so re-running is safe.
insert into public.problem_test_cases (problem_id, input, expected_output, is_sample, explanation, sort_order)
select p.id, t.value->>0, t.value->>1, (t.value->>2)::boolean, t.value->>3, t.ordinality::int
  from _seed s
  join public.problems p on p.slug = s.slug
  cross join lateral jsonb_array_elements(s.tests) with ordinality as t(value, ordinality)
 where not exists (select 1 from public.problem_test_cases x where x.problem_id = p.id);

drop table pg_temp._seed;
