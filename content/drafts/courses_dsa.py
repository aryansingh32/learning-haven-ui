"""DSA Patterns course: one chapter per pattern, each tied to the drafted practice problems.
Every code snippet is executed by build_courses.py against its `test` before the course is written out.
Original text. Quiz answers are the option text (the course builder's format).
"""

COURSE = dict(
    slug='dsa-patterns-for-interviews',
    title='DSA Patterns for Interviews',
    description='Fifteen chapters that cover most coding-interview problems. Each chapter teaches one idea, shows the template, and sends you to practice problems that use it.',
    difficulty='intermediate',
)

# (title, topic_tag, difficulty, hook, minutes, lesson_md, code, test, quiz[(q, [options], correct, why)], practice_titles)
CH = []


def ch(*a):
    CH.append(a)


ch('Arrays and Prefix Sums', 'arrays', 'BEGINNER',
   'A shop owner asks: "How much did we sell between day 12 and day 40?" Asking 10,000 such questions one by one is slow. Preparing once makes every answer instant.', 45,
   """## The idea

An array gives you O(1) access by index, so most array problems are about **not repeating work**. The most useful trick is the **prefix sum**: `prefix[i]` is the sum of the first `i` elements.

Then the sum of any range `nums[l..r]` is `prefix[r + 1] - prefix[l]` — two lookups, no loop.

## Template

```python
def build_prefix(nums):
    prefix = [0]
    for x in nums:
        prefix.append(prefix[-1] + x)
    return prefix

def range_sum(prefix, l, r):      # inclusive
    return prefix[r + 1] - prefix[l]
```

## Where it shows up
- Many range-sum questions after a single preparation pass.
- **Subarray sum equals k**: a subarray ends at `j` with sum `k` exactly when some earlier prefix equals `prefix[j] - k`. Store prefix counts in a hash map.
- Running best/worst values (Kadane's algorithm, best time to buy and sell).

## Watch out for
- Off-by-one errors: the prefix array has `n + 1` entries.
- Negative numbers break "grow the window" thinking, but prefix sums still work.
""",
   "def build_prefix(nums):\n    prefix = [0]\n    for x in nums:\n        prefix.append(prefix[-1] + x)\n    return prefix\n\ndef range_sum(prefix, l, r):\n    return prefix[r + 1] - prefix[l]\n",
   "p = build_prefix([2, 4, 6, 8]); assert p == [0, 2, 6, 12, 20]; assert range_sum(p, 1, 2) == 10; assert range_sum(p, 0, 3) == 20",
   [('What is the sum of nums[l..r] using a prefix array of length n + 1?', ['prefix[r + 1] - prefix[l]', 'prefix[r] - prefix[l]', 'prefix[r] + prefix[l]', 'prefix[r + 1] + prefix[l]'], 'prefix[r + 1] - prefix[l]', 'prefix[i] holds the sum of the first i elements, so subtracting the prefix before l from the prefix through r leaves exactly nums[l..r].'),
    ('After a one-time O(n) preparation, how long does each range-sum query take?', ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'], 'O(1)', 'Each query is two array lookups and a subtraction.'),
    ('Why does a prefix-sum + hash-map approach handle arrays with negative numbers?', ['It never shrinks a window; it only compares prefix values', 'It sorts the array first', 'It ignores negative values', 'It only works for positive values'], 'It never shrinks a window; it only compares prefix values', 'Window-shrinking logic needs positive numbers; comparing prefix values does not.')],
   ['Maximum Subarray Sum', 'Product of Array Except Self', 'Subarray Sum Equals K'])

ch('Strings and Character Counts', 'strings', 'BEGINNER',
   'Two friends type their names in a hurry. Are the two scrambles the same letters? Counting beats comparing.', 40,
   """## The idea

A string is an array of characters, so every array idea applies — plus one very common tool: a **frequency table** (a dictionary or a 26-slot array) that counts how often each character appears.

Two strings are anagrams exactly when their frequency tables are equal. A string can be built from another when the available counts cover the needed counts.

## Template

```python
from collections import Counter

def is_anagram(a, b):
    return Counter(a) == Counter(b)

def can_build(note, source):
    need, have = Counter(note), Counter(source)
    return all(have[c] >= n for c, n in need.items())
```

## Habits that save you
- Strings are immutable in most languages. Building a result by `+=` in a loop can be O(n^2); collect pieces in a list and join once.
- Decide early if case, spaces and punctuation matter.
- For palindromes, compare from both ends with two pointers instead of reversing when memory matters.
""",
   "from collections import Counter\n\ndef is_anagram(a, b):\n    return Counter(a) == Counter(b)\n\ndef can_build(note, source):\n    need, have = Counter(note), Counter(source)\n    return all(have[c] >= n for c, n in need.items())\n",
   "assert is_anagram('listen', 'silent'); assert not is_anagram('rat', 'car'); assert can_build('aab', 'baaz'); assert not can_build('aaa', 'aab')",
   [('Two strings are anagrams exactly when…', ['their character counts are equal', 'they have the same length', 'they share the first letter', 'one is a substring of the other'], 'their character counts are equal', 'Anagrams use the same letters the same number of times, in any order.'),
    ('Why is building a long string with += inside a loop often slow?', ['Each += may copy the whole string', 'Strings cannot be changed', 'Loops are slow in general', 'It uses recursion'], 'Each += may copy the whole string', 'Immutable strings are copied on each concatenation, making the loop O(n^2) in the worst case.'),
    ('How many slots does a frequency array need for lowercase English letters?', ['26', '10', '52', '128'], '26', 'One slot per letter a to z.')],
   ['Valid Palindrome', 'First Unique Character', 'Ransom Note'])

ch('Hashing: Remember What You Have Seen', 'hashing', 'BEGINNER',
   'A receptionist greets thousands of visitors a day and instantly knows who has been here before. A hash map is that memory.', 45,
   """## The idea

A hash map (dictionary) or hash set gives **average O(1)** insert and lookup. Many O(n^2) "compare every pair" solutions become O(n) once you ask: *what do I need to remember so I can answer in one step?*

## Two-sum, the classic

For each number `x`, you need to know whether `target - x` has appeared before. Remember each number's index as you go.

```python
def two_sum(nums, target):
    seen = {}                      # value -> index
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []
```

## Patterns
- **Seen set** — duplicates, first repeat, cycle detection.
- **Counter** — frequencies, majority, top-k.
- **Value -> index** — pair finding, "last seen position" for windows.
- **Canonical key** — group items by a key (sorted letters for anagrams).

## Costs
Lookups are O(1) on average, but memory is O(n). Keys must be hashable and stable (use tuples, not lists).
""",
   "def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n    return []\n",
   "assert two_sum([2, 7, 11, 15], 9) == [0, 1]; assert two_sum([3, 2, 4], 6) == [1, 2]; assert two_sum([1, 2], 10) == []",
   [('What is the average cost of a lookup in a hash map?', ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)'], 'O(1)', 'Hashing jumps straight to the bucket, so lookups are constant time on average.'),
    ('To find a pair that sums to a target in one pass, what do you store?', ['Each number seen, with its index', 'The sorted array', 'Only the largest number', 'The sum of all numbers'], 'Each number seen, with its index', 'For every new number you check whether the needed partner was seen already.'),
    ('Which of these cannot be used as a dictionary key in Python?', ['A list', 'A tuple of numbers', 'A string', 'An integer'], 'A list', 'Lists are mutable and unhashable; tuples of hashables are fine.')],
   ['Isomorphic Strings', 'Subarray Sum Equals K', 'Find All Duplicates'])

ch('Two Pointers', 'two-pointers', 'INTERMEDIATE',
   'Two people start at opposite ends of a corridor, each walking inward, deciding who steps based on what they see. They meet in the middle having checked everything that mattered.', 45,
   """## The idea

Use two indexes that move through the data according to a rule. It works when the data is **sorted** or has a structure that tells you *which pointer to move*.

## Opposite ends: sorted two-sum

```python
def two_sum_sorted(nums, target):
    l, r = 0, len(nums) - 1
    while l < r:
        s = nums[l] + nums[r]
        if s == target:
            return [l, r]
        if s < target:
            l += 1          # need a bigger sum
        else:
            r -= 1          # need a smaller sum
    return []
```

## Same direction (slow and fast)
A write pointer builds the answer in place (remove duplicates, move zeroes) while a read pointer scans.

## Why it is correct
At each step you can *prove* that moving one pointer discards only candidates that cannot be the answer. State that argument out loud in an interview — it is what interviewers listen for.

## Typical problems
Pair sums, 3Sum (fix one, two-pointer the rest), container with most water, palindromes, merging sorted arrays, squaring sorted arrays.
""",
   "def two_sum_sorted(nums, target):\n    l, r = 0, len(nums) - 1\n    while l < r:\n        s = nums[l] + nums[r]\n        if s == target:\n            return [l, r]\n        if s < target:\n            l += 1\n        else:\n            r -= 1\n    return []\n",
   "assert two_sum_sorted([1, 3, 4, 6, 9], 10) == [0, 4]; assert two_sum_sorted([1, 2, 3], 7) == []",
   [('When the pair sum is smaller than the target in a sorted array, which pointer moves?', ['The left pointer moves right', 'The right pointer moves left', 'Both move', 'Neither; stop'], 'The left pointer moves right', 'A larger sum needs a larger left value, and the array is sorted ascending.'),
    ('What is the time complexity of the sorted two-pointer pair search?', ['O(n)', 'O(n^2)', 'O(log n)', 'O(1)'], 'O(n)', 'Each pointer moves at most n steps in total.'),
    ('3Sum is usually solved by…', ['Sorting, fixing one number, and running two pointers on the rest', 'Trying all pairs with a hash map only', 'Binary search on the answer', 'Recursion on every subset'], 'Sorting, fixing one number, and running two pointers on the rest', 'After sorting, each fixed value reduces the problem to a two-pointer sweep, giving O(n^2).')],
   ['Two Sum in a Sorted Array', '3Sum', 'Container With Most Water', 'Squares of a Sorted Array'])

ch('Sliding Window', 'sliding-window', 'INTERMEDIATE',
   'A camera looks at a street through a frame that slides along it. Instead of re-examining the whole frame each time, you only update what enters and what leaves.', 50,
   """## The idea

When a question is about a **contiguous** part of an array or string, keep a *window* `[l, r]` and update it incrementally as `r` moves right. Shrink from the left when the window breaks a rule.

## Fixed-size window
Add the entering element, remove the leaving one.

```python
def max_window_sum(nums, k):
    s = sum(nums[:k])
    best = s
    for i in range(k, len(nums)):
        s += nums[i] - nums[i - k]
        best = max(best, s)
    return best
```

## Variable-size window
Grow `r`; while the window is invalid, advance `l`.

```python
def longest_unique(s):
    last, start, best = {}, 0, 0
    for i, ch in enumerate(s):
        if ch in last and last[ch] >= start:
            start = last[ch] + 1
        last[ch] = i
        best = max(best, i - start + 1)
    return best
```

## When it works
The rule must be *monotone*: removing from the left never makes an invalid window "more invalid". With negative numbers a sum rule is not monotone — use prefix sums instead.

Every index enters and leaves the window at most once, so the cost is O(n).
""",
   "def max_window_sum(nums, k):\n    s = sum(nums[:k])\n    best = s\n    for i in range(k, len(nums)):\n        s += nums[i] - nums[i - k]\n        best = max(best, s)\n    return best\n\ndef longest_unique(s):\n    last, start, best = {}, 0, 0\n    for i, ch in enumerate(s):\n        if ch in last and last[ch] >= start:\n            start = last[ch] + 1\n        last[ch] = i\n        best = max(best, i - start + 1)\n    return best\n",
   "assert max_window_sum([2, 1, 5, 1, 3, 2], 3) == 9; assert longest_unique('abcabcbb') == 3; assert longest_unique('') == 0",
   [('In a fixed-size window, what changes when it slides by one step?', ['One element enters and one leaves', 'The whole window is recomputed', 'The window size doubles', 'Nothing'], 'One element enters and one leaves', 'Updating the running value by the difference avoids recomputing.'),
    ('Why does the sliding window run in O(n)?', ['Each index enters and leaves the window at most once', 'It sorts the array first', 'It uses binary search', 'It stops after k steps'], 'Each index enters and leaves the window at most once', 'Both pointers only move forward.'),
    ('A variable window for "sum at least target" needs the numbers to be…', ['Positive', 'Negative', 'Sorted descending', 'Distinct'], 'Positive', 'With positives, shrinking always lowers the sum, which makes the rule monotone.')],
   ['Maximum Sum of a Window', 'Minimum Size Subarray Sum', 'Longest Substring Without Repeating Characters', 'Permutation in String', 'Sliding Window Maximum'])

ch('Stacks and Monotonic Stacks', 'stack', 'INTERMEDIATE',
   'A pile of plates: you can only touch the top one. That restriction is exactly what makes nested structure easy to check.', 50,
   """## The idea

A stack is last-in, first-out. Use it when the **most recent unresolved thing** is the one you must deal with first: matching brackets, undo, nested expressions, evaluating postfix notation.

## Matching brackets

```python
def valid(s):
    pair = {')': '(', ']': '[', '}': '{'}
    st = []
    for c in s:
        if c in pair:
            if not st or st.pop() != pair[c]:
                return False
        else:
            st.append(c)
    return not st
```

## Monotonic stack
Keep the stack sorted (for example decreasing). When a new value breaks the order, pop and **resolve** the popped items — they just found their "next greater" element.

```python
def next_greater(nums):
    out, st = [-1] * len(nums), []
    for i, x in enumerate(nums):
        while st and nums[st[-1]] < x:
            out[st.pop()] = x
        st.append(i)
    return out
```

Each index is pushed once and popped once, so the whole pass is O(n) even though there is a loop inside a loop.

## Problems that use it
Daily temperatures, next greater element, largest rectangle in a histogram, evaluate reverse Polish notation.
""",
   "def valid(s):\n    pair = {')': '(', ']': '[', '}': '{'}\n    st = []\n    for c in s:\n        if c in pair:\n            if not st or st.pop() != pair[c]:\n                return False\n        else:\n            st.append(c)\n    return not st\n\ndef next_greater(nums):\n    out, st = [-1] * len(nums), []\n    for i, x in enumerate(nums):\n        while st and nums[st[-1]] < x:\n            out[st.pop()] = x\n        st.append(i)\n    return out\n",
   "assert valid('([]{})'); assert not valid('(]'); assert not valid('(('); assert next_greater([2, 1, 2, 4, 3]) == [4, 2, 4, -1, -1]",
   [('Which structure fits "match the most recent unclosed bracket"?', ['Stack', 'Queue', 'Hash map', 'Binary tree'], 'Stack', 'The latest opening bracket must close first: last in, first out.'),
    ('Why is a monotonic stack pass O(n) despite the nested loop?', ['Each element is pushed and popped at most once', 'The inner loop never runs', 'It sorts the input', 'It uses recursion'], 'Each element is pushed and popped at most once', 'Total pushes and pops are at most 2n.'),
    ('In "next greater element", when is an index popped?', ['When a larger value arrives', 'When a smaller value arrives', 'At the end only', 'Never'], 'When a larger value arrives', 'The arriving value is the first greater one to the right of every smaller value on the stack.')],
   ['Valid Brackets', 'Daily Temperatures', 'Next Greater Element', 'Evaluate Reverse Polish Notation', 'Largest Rectangle in Histogram'])

ch('Binary Search', 'binary-search', 'INTERMEDIATE',
   'Guess a number between 1 and 1,000,000. With "higher or lower" hints you need at most 20 guesses. That is the power of halving.', 50,
   """## The idea

Whenever you can ask a yes/no question whose answer flips **once** along an ordered range, you can binary search it: look at the middle, discard half.

## Classic search

```python
def search(nums, target):
    l, r = 0, len(nums) - 1
    while l <= r:
        m = (l + r) // 2
        if nums[m] == target:
            return m
        if nums[m] < target:
            l = m + 1
        else:
            r = m - 1
    return -1
```

## Binary search on the answer
Many problems ask for a *minimum value that works* (eating speed, ship capacity). If "works" is monotone — once a value works, every larger one does — search the value range and test each middle with a simple check.

```python
def min_speed(piles, h):
    l, r = 1, max(piles)
    while l < r:
        m = (l + r) // 2
        if sum((p + m - 1) // m for p in piles) <= h:
            r = m              # m works; try smaller
        else:
            l = m + 1
    return l
```

## Pitfalls
- Infinite loops from `l = m` without a rounding fix: pick the **half-open** style (`while l < r`) or round the middle up.
- Decide whether you want the *first* index meeting a condition (lower bound) or the *last*.
""",
   "def search(nums, target):\n    l, r = 0, len(nums) - 1\n    while l <= r:\n        m = (l + r) // 2\n        if nums[m] == target:\n            return m\n        if nums[m] < target:\n            l = m + 1\n        else:\n            r = m - 1\n    return -1\n\ndef min_speed(piles, h):\n    l, r = 1, max(piles)\n    while l < r:\n        m = (l + r) // 2\n        if sum((p + m - 1) // m for p in piles) <= h:\n            r = m\n        else:\n            l = m + 1\n    return l\n",
   "assert search([1, 3, 5, 7], 5) == 2; assert search([1, 3, 5, 7], 4) == -1; assert min_speed([3, 6, 7, 11], 8) == 4",
   [('How many steps does binary search need on one million sorted items (about)?', ['20', '1,000', '500,000', '1,000,000'], '20', 'log2(1,000,000) is about 20.'),
    ('"Binary search on the answer" requires that the check function is…', ['Monotone: once true, it stays true', 'Random', 'Recursive', 'Always true'], 'Monotone: once true, it stays true', 'Only then does the middle value tell you which half to discard.'),
    ('Which loop condition pairs with "r = m" and "l = m + 1"?', ['while l < r', 'while l <= r', 'while l > r', 'while True with no update'], 'while l < r', 'The half-open range shrinks every step and ends with l == r as the answer.')],
   ['Binary Search', 'Search Insert Position', 'Search in Rotated Sorted Array', 'First and Last Position of a Value', 'Eating Speed', 'Capacity to Ship Packages'])

ch('Sorting and Intervals', 'sorting', 'INTERMEDIATE',
   'A receptionist has a pile of bookings with start and end times. The first thing she does is sort them by start time — suddenly overlaps are neighbours.', 45,
   """## The idea

Sorting costs O(n log n) but often turns a messy problem into a linear scan. Ask: *if this were sorted, what would become easy?*

## Merge intervals

```python
def merge(intervals):
    out = []
    for s, e in sorted(intervals):
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out
```

## Which order to sort by?
- **Merge overlapping intervals** — by start.
- **Keep the most non-overlapping intervals** — by *end* (finishing early leaves the most room).
- **Meeting rooms** — turn each interval into +1 / -1 events and sort the events.

## Counting sort
When values are in a small range (like 0, 1, 2 for colours) you can sort in O(n) with counts or the Dutch national flag method.

Python's `sorted` is stable, so you can sort by several keys by sorting on the least important key first, or by using a tuple key.
""",
   "def merge(intervals):\n    out = []\n    for s, e in sorted(intervals):\n        if out and s <= out[-1][1]:\n            out[-1][1] = max(out[-1][1], e)\n        else:\n            out.append([s, e])\n    return out\n",
   "assert merge([[1, 3], [2, 6], [8, 10]]) == [[1, 6], [8, 10]]; assert merge([[1, 4], [4, 5]]) == [[1, 5]]; assert merge([[5, 6], [1, 2]]) == [[1, 2], [5, 6]]",
   [('To merge overlapping intervals you first sort by…', ['Start time', 'Length', 'End time only', 'Nothing; no sort is needed'], 'Start time', 'After sorting by start, any interval that overlaps the previous one starts inside it.'),
    ('To keep the maximum number of non-overlapping intervals, sort by…', ['End time', 'Start time', 'Length, longest first', 'Random order'], 'End time', 'Finishing earliest leaves the most room for the remaining intervals.'),
    ('What does sorting cost in general?', ['O(n log n)', 'O(n)', 'O(n^2) always', 'O(1)'], 'O(n log n)', 'Comparison sorts have an n log n lower bound.')],
   ['Merge Intervals', 'Non-overlapping Intervals', 'Meeting Rooms', 'Sort Colors'])

ch('Greedy Choices', 'greedy', 'INTERMEDIATE',
   'At a buffet with a time limit you grab what gives the most value per second now. Sometimes the best local move is also the best overall move.', 45,
   """## The idea

A greedy algorithm makes the best-looking choice at each step and never looks back. It is fast and simple, but it is only correct when you can *argue* that the local choice never hurts the final answer.

## A proof pattern: "stay ahead" or "exchange"
- **Stay ahead**: after each step, greedy is at least as good as any other strategy. *Jump game*: the furthest reachable index is only ever extended.
- **Exchange**: swap any optimal solution's first choice for greedy's and show it does not get worse. *Activity selection*: picking the earliest-finishing interval first.

```python
def can_jump(nums):
    reach = 0
    for i, x in enumerate(nums):
        if i > reach:
            return False
        reach = max(reach, i + x)
    return True
```

## When greedy fails
Coin change with coins {1, 3, 4} and amount 6: greedy takes 4 + 1 + 1 (3 coins) but 3 + 3 (2 coins) is better. When local choices interact, use dynamic programming.

## Checklist
1. Can I state the greedy rule in one sentence?
2. Can I explain why it never hurts?
3. Can I find a small counter-example? If yes, use DP.
""",
   "def can_jump(nums):\n    reach = 0\n    for i, x in enumerate(nums):\n        if i > reach:\n            return False\n        reach = max(reach, i + x)\n    return True\n",
   "assert can_jump([2, 3, 1, 1, 4]); assert not can_jump([3, 2, 1, 0, 4]); assert can_jump([0])",
   [('Greedy is only correct when…', ['The local choice can never hurt the final answer', 'The input is sorted', 'The array is small', 'It uses recursion'], 'The local choice can never hurt the final answer', 'Without that guarantee, greedy can commit to a choice that blocks the optimum.'),
    ('With coins {1, 3, 4} and amount 6, what does the greedy "largest coin first" give?', ['3 coins (4+1+1)', '2 coins (3+3)', '1 coin', 'It cannot make 6'], '3 coins (4+1+1)', 'Greedy takes 4, then 1, then 1; but 3+3 uses only 2 coins, so greedy is wrong here.'),
    ('In the jump game, what does the scan keep track of?', ['The furthest reachable index', 'The smallest jump', 'The number of jumps', 'The sum of the array'], 'The furthest reachable index', 'If the current index is beyond the furthest reach you are stuck.')],
   ['Jump Game', 'Gas Station', 'Non-overlapping Intervals'])

ch('Recursion and Backtracking', 'backtracking', 'INTERMEDIATE',
   'You are in a maze with a ball of thread. At every junction you try a path; at a dead end you pull the thread back and try the next. That is backtracking.', 55,
   """## The idea

Backtracking explores all candidate solutions by **choose -> explore -> un-choose**. It is a depth-first search over a tree of decisions, pruning branches that cannot work.

## Template

```python
def subsets(nums):
    out, cur = [], []
    def go(i):
        if i == len(nums):
            out.append(cur[:])      # copy the current choice
            return
        go(i + 1)                   # skip nums[i]
        cur.append(nums[i])         # choose nums[i]
        go(i + 1)
        cur.pop()                   # un-choose
    go(0)
    return out
```

## Anatomy
1. **State**: what you have chosen so far.
2. **Choices**: what you may add next.
3. **Goal**: when to record a result.
4. **Pruning**: when to stop early (remaining total negative, bracket count exceeded).

## Counting the work
Subsets: 2^n. Permutations: n!. Combination sum: bounded by the target. Always estimate this before coding so you know whether it will be fast enough (n up to about 20 for 2^n).

## Common mistakes
- Appending `cur` instead of a copy `cur[:]` — every result then changes later.
- Forgetting to undo the choice.
- Generating duplicates: move forward through the candidates instead of restarting from the beginning.
""",
   "def subsets(nums):\n    out, cur = [], []\n    def go(i):\n        if i == len(nums):\n            out.append(cur[:])\n            return\n        go(i + 1)\n        cur.append(nums[i])\n        go(i + 1)\n        cur.pop()\n    go(0)\n    return out\n",
   "r = subsets([1, 2, 3]); assert len(r) == 8; assert sorted(map(sorted, r)) == sorted([[], [1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]); assert subsets([]) == [[]]",
   [('What are the three moves of backtracking?', ['Choose, explore, un-choose', 'Sort, search, return', 'Split, merge, sort', 'Push, pop, peek'], 'Choose, explore, un-choose', 'You make a choice, recurse, then undo it to try the next option.'),
    ('How many subsets does a set of 10 distinct numbers have?', ['1024', '100', '3,628,800', '20'], '1024', '2^10 = 1024.'),
    ('Why do you append a COPY of the current list to the results?', ['Otherwise later changes alter stored results', 'Copies run faster', 'Lists cannot be appended', 'To save memory'], 'Otherwise later changes alter stored results', 'The same list object is modified as the search continues, so a stored reference would change too.')],
   ['Subsets', 'Permutations', 'Combination Sum', 'Generate Parentheses'])

ch('Dynamic Programming', 'dynamic-programming', 'ADVANCED',
   'Climbing a staircase, you realise the number of ways to reach step 10 depends on steps 9 and 8 — which you already counted. Never solve the same sub-problem twice.', 70,
   """## The idea

Dynamic programming (DP) solves a problem by solving smaller **overlapping** sub-problems once and reusing the answers.

## A reliable recipe
1. **State**: what do I need to know to describe a sub-problem? (`dp[i]` = best answer for the first `i` items)
2. **Transition**: how does a state come from smaller states?
3. **Base case**: what is trivially known?
4. **Order**: fill smaller states first (or use memoised recursion).
5. **Answer**: which state holds it?

## Example: coin change (fewest coins)

```python
def coin_change(coins, amount):
    INF = amount + 1
    dp = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                dp[a] = min(dp[a], dp[a - c] + 1)
    return dp[amount] if dp[amount] != INF else -1
```

## Families you will meet
- **1-D line**: climbing stairs, house robber, longest increasing subsequence.
- **Knapsack**: subset sum, partition, 0/1 knapsack (loop capacity downward so an item is used once).
- **Two strings**: edit distance, longest common subsequence — a table indexed by prefixes of both.
- **Grid**: unique paths, minimum path sum.

## Space optimisation
If `dp[i]` only needs the previous row or the previous two values, keep only those.
""",
   "def coin_change(coins, amount):\n    INF = amount + 1\n    dp = [0] + [INF] * amount\n    for a in range(1, amount + 1):\n        for c in coins:\n            if c <= a:\n                dp[a] = min(dp[a], dp[a - c] + 1)\n    return dp[amount] if dp[amount] != INF else -1\n",
   "assert coin_change([1, 2, 5], 11) == 3; assert coin_change([2], 3) == -1; assert coin_change([1], 0) == 0; assert coin_change([1, 3, 4], 6) == 2",
   [('What makes a problem suitable for dynamic programming?', ['Overlapping sub-problems with optimal substructure', 'A sorted input', 'Only positive numbers', 'A graph input'], 'Overlapping sub-problems with optimal substructure', 'The same smaller problems recur, and the best answer is built from best sub-answers.'),
    ('In 0/1 knapsack with a 1-D array, why loop the capacity downward?', ['So each item is used at most once', 'To make it faster', 'To allow repeated items', 'Because arrays are reversed'], 'So each item is used at most once', 'Going downward means dp[c - w] still holds the value from before this item.'),
    ('The first thing to define in a DP solution is…', ['The state', 'The loop order', 'The language', 'The input size'], 'The state', 'Everything else (transition, base case, order) follows from what a state means.')],
   ['Climbing Stairs', 'House Robber', 'Coin Change', 'Longest Increasing Subsequence', 'Edit Distance', 'Longest Common Subsequence', '0/1 Knapsack'])

ch('Grids and Matrices', 'matrix', 'INTERMEDIATE',
   'A treasure map is just a grid. Where you can move next depends on four neighbours — and a few tricks keep your indexing from tying itself in knots.', 40,
   """## The idea

A matrix is an array of arrays. Most problems are one of:
- **Traversal** in a special order (spiral, diagonal).
- **Transformation** (rotate, transpose, set zeroes).
- **Search** (sorted matrix as a flat array).
- **Graph** disguised as a grid (islands, shortest path).

## Neighbours
```python
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]

def neighbours(r, c, R, C):
    for dr, dc in DIRS:
        nr, nc = r + dr, c + dc
        if 0 <= nr < R and 0 <= nc < C:
            yield nr, nc
```

## Rotate 90 degrees clockwise
Reverse the order of the rows, then transpose:

```python
def rotate(matrix):
    return [list(row) for row in zip(*matrix[::-1])]
```

## Flat index trick
For a matrix with `C` columns, flat index `k` is cell `(k // C, k % C)`. A sorted-rows matrix where each row starts above the previous row's end can be binary searched as if it were one long array.

## Checklist
- Check for empty grids and single rows/columns.
- Do not modify the grid while scanning unless you mean to — record changes first.
""",
   "DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]\n\ndef neighbours(r, c, R, C):\n    for dr, dc in DIRS:\n        nr, nc = r + dr, c + dc\n        if 0 <= nr < R and 0 <= nc < C:\n            yield nr, nc\n\ndef rotate(matrix):\n    return [list(row) for row in zip(*matrix[::-1])]\n",
   "assert rotate([[1, 2], [3, 4]]) == [[3, 1], [4, 2]]; assert sorted(neighbours(0, 0, 2, 2)) == [(0, 1), (1, 0)]; assert len(list(neighbours(1, 1, 3, 3))) == 4",
   [('For a matrix with C columns, which cell does flat index k refer to?', ['(k // C, k % C)', '(k % C, k // C)', '(k * C, k)', '(k - C, k + C)'], '(k // C, k % C)', 'Integer division gives the row, remainder gives the column.'),
    ('A 90-degree clockwise rotation equals…', ['Reverse the rows, then transpose', 'Transpose only', 'Reverse each row only', 'Sort each row'], 'Reverse the rows, then transpose', 'Reversing the row order and transposing maps the first row to the last column.'),
    ('Why record zero positions before zeroing a matrix?', ['Newly created zeros would cause extra rows/columns to be zeroed', 'It is faster', 'Zeros cannot be overwritten', 'To sort the matrix'], 'Newly created zeros would cause extra rows/columns to be zeroed', 'Changing as you scan makes new zeros look original.')],
   ['Rotate Image', 'Spiral Matrix', 'Set Matrix Zeroes', 'Search a Sorted Matrix'])

ch('Graphs: BFS, DFS and Topological Order', 'graphs', 'ADVANCED',
   'Cities and roads, courses and prerequisites, friends and follows — all are graphs. Once you see the graph, three tools solve most questions.', 65,
   """## The idea

A graph is nodes and edges. Grids are graphs too (each cell is a node with up to four neighbours).

## Three tools
- **DFS** (stack/recursion): explore everything reachable. Counting connected components, flood fill, cycle detection.
- **BFS** (queue): explore level by level. The first time BFS reaches a node is by a **shortest path** when every edge costs the same.
- **Topological sort** (Kahn's algorithm): order tasks by prerequisites; if you cannot place everything there is a cycle.

```python
from collections import deque

def can_finish(n, prerequisites):
    adj = [[] for _ in range(n)]
    indeg = [0] * n
    for a, b in prerequisites:          # take b before a
        adj[b].append(a)
        indeg[a] += 1
    q = deque(i for i in range(n) if indeg[i] == 0)
    done = 0
    while q:
        u = q.popleft()
        done += 1
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return done == n
```

## Multi-source BFS
Start the queue with *several* sources (all rotten oranges) and expand together — each level is one time step.

## Always keep a visited set
Without it a cycle makes the search run forever. Mark nodes visited when you **enqueue** them, not when you dequeue them.
""",
   "from collections import deque\n\ndef can_finish(n, prerequisites):\n    adj = [[] for _ in range(n)]\n    indeg = [0] * n\n    for a, b in prerequisites:\n        adj[b].append(a)\n        indeg[a] += 1\n    q = deque(i for i in range(n) if indeg[i] == 0)\n    done = 0\n    while q:\n        u = q.popleft()\n        done += 1\n        for v in adj[u]:\n            indeg[v] -= 1\n            if indeg[v] == 0:\n                q.append(v)\n    return done == n\n",
   "assert can_finish(2, [[1, 0]]); assert not can_finish(2, [[1, 0], [0, 1]]); assert can_finish(3, [])",
   [('Which traversal finds shortest paths in an unweighted graph?', ['BFS', 'DFS', 'Binary search', 'Sorting'], 'BFS', 'BFS reaches nodes in order of increasing distance.'),
    ('How does topological sorting reveal a cycle?', ['Not every node can be removed', 'The queue overflows', 'A node has two parents', 'It cannot'], 'Not every node can be removed', 'Nodes in a cycle always have an unmet prerequisite, so they never reach in-degree zero.'),
    ('When should a node be marked visited in BFS?', ['When it is enqueued', 'When it is dequeued', 'Never', 'After the whole BFS'], 'When it is enqueued', 'Marking early prevents the same node from being queued several times.')],
   ['Number of Islands', 'Course Schedule', 'Rotting Oranges', 'Shortest Path in a Binary Matrix'])

ch('Math and Bit Tricks', 'math-bits', 'INTERMEDIATE',
   'A programmer sees the number 16 and thinks "10000". Seeing numbers as bits opens up one-line answers to problems that look hard.', 45,
   """## Bit basics
- `x & (x - 1)` clears the lowest set bit. So `x & (x - 1) == 0` for positive `x` means **power of two**; repeating it **counts set bits**.
- `x ^ x = 0` and `x ^ 0 = x`, so XOR-ing a list cancels pairs: the **single number** survives.
- `x >> 1` halves; `i >> 1` has the same set bits as `i` without its last bit, which gives `bits[i] = bits[i >> 1] + (i & 1)`.

```python
def popcount(n):
    c = 0
    while n:
        n &= n - 1
        c += 1
    return c
```

## Number theory staples
- **GCD** by Euclid: `gcd(a, b) = gcd(b, a % b)`.
- **Sieve of Eratosthenes**: cross out multiples of each prime, O(n log log n).
- **Modular arithmetic**: remainders of powers repeat in a cycle; use `pow(b, e, m)`.
- **Factorial trailing zeros**: count factors of 5: n/5 + n/25 + ...

```python
def gcd(a, b):
    while b:
        a, b = b, a % b
    return a
```

## Careful with
Integer overflow in languages with fixed-size integers (use 64-bit or modular reduction), and negative numbers with `%` and shifts.
""",
   "def popcount(n):\n    c = 0\n    while n:\n        n &= n - 1\n        c += 1\n    return c\n\ndef gcd(a, b):\n    while b:\n        a, b = b, a % b\n    return a\n",
   "assert popcount(11) == 3; assert popcount(0) == 0; assert gcd(12, 18) == 6; assert gcd(7, 13) == 1; assert (16 & 15) == 0; assert (12 & 11) != 0",
   [('What does x & (x - 1) do?', ['Clears the lowest set bit', 'Sets the lowest bit', 'Doubles x', 'Negates x'], 'Clears the lowest set bit', 'Subtracting 1 flips the lowest set bit and the zeros below it, so the AND removes that bit.'),
    ('XOR-ing every element of a list where each value appears twice except one gives…', ['The value that appears once', 'Zero', 'The sum', 'The largest value'], 'The value that appears once', 'Equal values cancel out under XOR.'),
    ('Euclid\'s algorithm computes…', ['The greatest common divisor', 'The least common multiple directly', 'Prime numbers', 'Powers of two'], 'The greatest common divisor', 'It repeatedly replaces (a, b) by (b, a mod b).')],
   ['Power of Two', 'Number of 1 Bits', 'Single Number', 'Count Primes', 'Greatest Common Divisor'])

ch('Complexity and Choosing the Right Tool', 'complexity', 'BEGINNER',
   'Your code works on 10 inputs but the interviewer asks about 10 million. Estimating cost before you write code is the skill that separates "works" from "scales".', 40,
   """## Big-O in plain words
Big-O describes how the work grows with the input size `n`, ignoring constants.

| Complexity | n = 1,000 | typical example |
|---|---|---|
| O(1) | 1 | hash lookup, array index |
| O(log n) | 10 | binary search |
| O(n) | 1,000 | one pass |
| O(n log n) | 10,000 | sorting |
| O(n^2) | 1,000,000 | nested loops |
| O(2^n) | huge | all subsets |

A rough rule: a computer does about 10^8 simple operations per second, so for n = 10^5 aim for O(n log n); for n = 10^3 O(n^2) is fine.

## Reading constraints as hints
- n <= 20 -> exponential (backtracking, bitmask).
- n <= 10^3 -> O(n^2) (simple DP).
- n <= 10^5 -> O(n log n) or O(n) (sorting, heap, hash map, two pointers, binary search).
- n <= 10^9 -> O(log n) or O(1) (math, binary search on the answer).

## Space matters too
Recursion uses stack space proportional to its depth; a DP table uses its size. Say both time and space when you explain a solution.

## A routine for any problem
1. Restate it with a small example.
2. Write the brute force and its cost.
3. Find the repeated work or the structure to exploit.
4. Choose the pattern (hash, window, pointers, binary search, DP, graph...).
5. Test on edge cases: empty, one element, duplicates, negatives, the largest input.
""",
   "# Nested loops vs a set: same answer, very different cost.\ndef has_duplicate_slow(nums):\n    return any(nums[i] == nums[j] for i in range(len(nums)) for j in range(i + 1, len(nums)))\n\ndef has_duplicate_fast(nums):\n    return len(set(nums)) != len(nums)\n",
   "import random\nfor _ in range(200):\n    a = [random.randint(0, 20) for _ in range(random.randint(0, 12))]\n    assert has_duplicate_slow(a) == has_duplicate_fast(a)",
   [('For n = 100,000, which time complexity is comfortable?', ['O(n log n)', 'O(n^2)', 'O(2^n)', 'O(n!)'], 'O(n log n)', 'n^2 would be 10^10 operations; n log n is about 1.7 million.'),
    ('A constraint of n <= 20 usually suggests…', ['An exponential solution such as backtracking', 'Binary search', 'A sieve', 'A single pass only'], 'An exponential solution such as backtracking', '2^20 is about a million, which is fine.'),
    ('What is the first step of the problem-solving routine?', ['Restate the problem with a small example', 'Write the optimised code', 'Pick a language feature', 'Submit'], 'Restate the problem with a small example', 'Understanding the problem on a small case prevents solving the wrong thing.')],
   ['Find All Duplicates', 'Move Zeroes to the End', 'Missing Number'])
