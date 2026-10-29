from lib import P


def ri(rng, n, lo, hi):
    return [rng.randint(lo, hi) for _ in range(n)]


# ───────────────────── Two pointers / sliding window ─────────────────────
def maxArea(height):
    l, r, best = 0, len(height) - 1, 0
    while l < r:
        best = max(best, min(height[l], height[r]) * (r - l))
        if height[l] < height[r]:
            l += 1
        else:
            r -= 1
    return best


def threeSum(nums):
    nums = sorted(nums)
    out = []
    for i in range(len(nums) - 2):
        if i and nums[i] == nums[i - 1]:
            continue
        l, r = i + 1, len(nums) - 1
        while l < r:
            s = nums[i] + nums[l] + nums[r]
            if s < 0:
                l += 1
            elif s > 0:
                r -= 1
            else:
                out.append([nums[i], nums[l], nums[r]])
                l += 1
                while l < r and nums[l] == nums[l - 1]:
                    l += 1
    return out


def twoSumSorted(numbers, target):
    l, r = 0, len(numbers) - 1
    while l < r:
        s = numbers[l] + numbers[r]
        if s == target:
            return [l + 1, r + 1]
        if s < target:
            l += 1
        else:
            r -= 1
    return []


def sortedSquares(nums):
    n = len(nums)
    out = [0] * n
    l, r = 0, n - 1
    for i in range(n - 1, -1, -1):
        if abs(nums[l]) > abs(nums[r]):
            out[i] = nums[l] ** 2; l += 1
        else:
            out[i] = nums[r] ** 2; r -= 1
    return out


def maxSumWindow(nums, k):
    s = sum(nums[:k])
    best = s
    for i in range(k, len(nums)):
        s += nums[i] - nums[i - k]
        best = max(best, s)
    return best


def minSubArrayLen(target, nums):
    l, s, best = 0, 0, 0
    for r, x in enumerate(nums):
        s += x
        while s >= target:
            best = r - l + 1 if best == 0 else min(best, r - l + 1)
            s -= nums[l]; l += 1
    return best


def characterReplacement(s, k):
    from collections import defaultdict
    cnt, l, mx, best = defaultdict(int), 0, 0, 0
    for r, c in enumerate(s):
        cnt[c] += 1
        mx = max(mx, cnt[c])
        while r - l + 1 - mx > k:
            cnt[s[l]] -= 1; l += 1
        best = max(best, r - l + 1)
    return best


def checkInclusion(s1, s2):
    from collections import Counter
    n = len(s1)
    if n > len(s2):
        return False
    need = Counter(s1)
    win = Counter(s2[:n])
    if win == need:
        return True
    for i in range(n, len(s2)):
        win[s2[i]] += 1
        win[s2[i - n]] -= 1
        if win[s2[i - n]] == 0:
            del win[s2[i - n]]
        if win == need:
            return True
    return False


def maxSlidingWindow(nums, k):
    from collections import deque
    dq, out = deque(), []
    for i, x in enumerate(nums):
        while dq and nums[dq[-1]] <= x:
            dq.pop()
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()
        if i >= k - 1:
            out.append(nums[dq[0]])
    return out


WINDOWS = [
    P('container-with-most-water', 'Container With Most Water', 'Two Pointers', 'medium', 'maxArea', [('height', 'int[]')], 'int',
      'height[i] is the height of a vertical line at position i. Choose two lines that, together with the x-axis, form a container holding the most water. Return that maximum area. The container cannot be slanted.',
      '2 <= height.length <= 10^5\n0 <= height[i] <= 10^4',
      ['The area between lines i and j is min(height[i], height[j]) x (j - i).', 'Start with the widest container. Which line should you move to have any chance of a larger area?'],
      'Two pointers from both ends. Area is limited by the shorter line, so moving the taller line inward can only reduce width without raising the limit. Always move the shorter side; every skipped pair is provably no better.',
      'O(n)', 'O(1)', maxArea,
      [{'height': [1, 8, 6, 2, 5, 4, 8, 3, 7]}, {'height': [1, 1]}],
      [{'height': [0, 0]}, {'height': [4, 3, 2, 1, 4]}, {'height': [1, 2, 1]}],
      lambda r: {'height': ri(r, r.randint(2, 10), 0, 12)}),
    P('three-sum-triplets', '3Sum', 'Two Pointers', 'medium', 'threeSum', [('nums', 'int[]')], 'lists',
      'Return all unique triplets [a, b, c] from nums such that a + b + c = 0. The answer must not contain duplicate triplets; the order of triplets and of numbers inside a triplet does not matter.',
      '0 <= nums.length <= 3000\n-10^5 <= nums[i] <= 10^5',
      ['Sorting makes duplicates adjacent and enables two pointers.', 'Fix the first number, then solve a sorted two-sum for the rest. Skip repeated first numbers.'],
      'Sort. For each index i (skipping repeated values) run two pointers l and r over the rest: a sum below zero moves l up, above zero moves r down, and a hit records the triplet and skips repeated l values. Sorting costs O(n log n); the pointer sweeps cost O(n^2).',
      'O(n^2)', 'O(1) extra', threeSum,
      [{'nums': [-1, 0, 1, 2, -1, -4]}, {'nums': [0, 1, 1]}],
      [{'nums': [0, 0, 0]}, {'nums': []}, {'nums': [0, 0, 0, 0]}, {'nums': [-2, 0, 1, 1, 2]}],
      lambda r: {'nums': ri(r, r.randint(3, 9), -4, 4)}, compare='unordered_deep'),
    P('two-sum-sorted', 'Two Sum in a Sorted Array', 'Two Pointers', 'easy', 'twoSumSorted', [('numbers', 'int[]'), ('target', 'int')], 'int[]',
      'numbers is sorted in non-decreasing order. Return the 1-based positions [i, j], i < j, of the two numbers that add up to target. Exactly one solution exists.',
      '2 <= numbers.length <= 3 x 10^4\n-1000 <= numbers[i] <= 1000\nExactly one solution exists.',
      ['A sorted array lets you decide which end to move.', 'If the sum is too small move the left pointer right; too big, move the right pointer left.'],
      'Pointers at both ends. The sum of the two ends is compared with the target: smaller means the left value must grow, larger means the right value must shrink. They converge on the unique pair.',
      'O(n)', 'O(1)', twoSumSorted,
      [{'numbers': [2, 7, 11, 15], 'target': 9}, {'numbers': [2, 3, 4], 'target': 6}],
      [{'numbers': [-1, 0], 'target': -1}, {'numbers': [1, 2, 3, 4, 4, 9, 56, 90], 'target': 8}],
      lambda r: (lambda a: (lambda i, j: {'numbers': a, 'target': a[i] + a[j]})(*sorted(r.sample(range(len(a)), 2))))(sorted(r.sample(range(-20, 20), r.randint(3, 9))))),
    P('squares-of-sorted-array', 'Squares of a Sorted Array', 'Two Pointers', 'easy', 'sortedSquares', [('nums', 'int[]')], 'int[]',
      'nums is sorted in non-decreasing order and may contain negatives. Return the squares of each number, also sorted in non-decreasing order.',
      '1 <= nums.length <= 10^4\n-10^4 <= nums[i] <= 10^4',
      ['The largest square is at one of the two ends.', 'Fill the answer from the back.'],
      'The biggest absolute value is always at the left or right end. Compare the two ends, place the larger square at the back of the output, and move that pointer inward. This avoids a full sort.',
      'O(n)', 'O(n)', sortedSquares,
      [{'nums': [-4, -1, 0, 3, 10]}, {'nums': [-7, -3, 2, 3, 11]}],
      [{'nums': [0]}, {'nums': [-5, -4]}, {'nums': [1, 2, 3]}],
      lambda r: {'nums': sorted(ri(r, r.randint(1, 9), -9, 9))}),
    P('max-sum-subarray-size-k', 'Maximum Sum of a Window', 'Sliding Window', 'easy', 'maxSumWindow', [('nums', 'int[]'), ('k', 'int')], 'int',
      'Return the largest sum of any k consecutive elements of nums.',
      '1 <= k <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
      ['Recomputing each window from scratch repeats work.', 'Moving the window by one adds one element and removes one.'],
      'Compute the first window\'s sum, then slide: add the entering element, subtract the leaving one, and keep the maximum. Each element enters and leaves once.',
      'O(n)', 'O(1)', maxSumWindow,
      [{'nums': [2, 1, 5, 1, 3, 2], 'k': 3}, {'nums': [1, 4, 2, 10, 23, 3, 1, 0, 20], 'k': 4}],
      [{'nums': [5], 'k': 1}, {'nums': [-1, -2, -3], 'k': 2}, {'nums': [1, 2, 3], 'k': 3}],
      lambda r: (lambda n: {'nums': ri(r, n, -9, 9), 'k': r.randint(1, n)})(r.randint(1, 10))),
    P('minimum-size-subarray-sum', 'Minimum Size Subarray Sum', 'Sliding Window', 'medium', 'minSubArrayLen', [('target', 'int'), ('nums', 'int[]')], 'int',
      'All numbers in nums are positive. Return the length of the shortest contiguous subarray whose sum is at least target, or 0 if no such subarray exists.',
      '1 <= target <= 10^9\n1 <= nums.length <= 10^5\n1 <= nums[i] <= 10^4',
      ['Because all numbers are positive, adding elements only increases the sum.', 'Grow the window on the right; shrink it from the left while the sum still meets the target.'],
      'Expand the right edge, adding to the running sum. While the sum is at least target, record the window length and shrink from the left. Positivity guarantees that shrinking never needs to be undone, so each index is visited at most twice.',
      'O(n)', 'O(1)', minSubArrayLen,
      [{'target': 7, 'nums': [2, 3, 1, 2, 4, 3]}, {'target': 11, 'nums': [1, 1, 1, 1]}],
      [{'target': 4, 'nums': [1, 4, 4]}, {'target': 1, 'nums': [1]}, {'target': 15, 'nums': [1, 2, 3, 4, 5]}],
      lambda r: {'target': r.randint(1, 20), 'nums': ri(r, r.randint(1, 9), 1, 6)}),
    P('longest-repeating-character-replacement', 'Longest Repeating Character Replacement', 'Sliding Window', 'medium', 'characterReplacement', [('s', 'str'), ('k', 'int')], 'int',
      'You may change at most k characters of s to any uppercase letter. Return the length of the longest substring that can be made of one repeated letter.',
      '1 <= s.length <= 10^5\n0 <= k <= s.length\nUppercase English letters.',
      ['A window is valid if (length - count of its most common letter) <= k.', 'You never need to shrink the recorded best, so the maximum count only needs to grow.'],
      'Sliding window with letter counts. The cost to unify a window is its length minus the count of its most frequent letter. If that cost exceeds k, move the left edge. The maximum valid window length seen is the answer.',
      'O(n)', 'O(1)', characterReplacement,
      [{'s': 'ABAB', 'k': 2}, {'s': 'AABABBA', 'k': 1}],
      [{'s': 'A', 'k': 0}, {'s': 'ABCDE', 'k': 0}, {'s': 'ABCDE', 'k': 5}],
      lambda r: (lambda n: {'s': ''.join(r.choice('ABC') for _ in range(n)), 'k': r.randint(0, n)})(r.randint(1, 10))),
    P('permutation-in-string', 'Permutation in String', 'Sliding Window', 'medium', 'checkInclusion', [('s1', 'str'), ('s2', 'str')], 'bool',
      'Return true if s2 contains a substring that is a permutation of s1 (the same letters, any order).',
      '1 <= s1.length, s2.length <= 10^4\nLowercase English letters.',
      ['Any permutation of s1 has the same letter counts as s1.', 'Slide a window of length |s1| across s2 and compare counts.'],
      'Count the letters of s1. Slide a window of the same length over s2, updating the counts incrementally (add the new letter, drop the old one) and compare to s1\'s counts after every move.',
      'O(|s2|)', 'O(1) (26 letters)', checkInclusion,
      [{'s1': 'ab', 's2': 'eidbaooo'}, {'s1': 'ab', 's2': 'eidboaoo'}],
      [{'s1': 'a', 's2': 'a'}, {'s1': 'abc', 's2': 'ab'}, {'s1': 'adc', 's2': 'dcda'}],
      lambda r: {'s1': ''.join(r.choice('abc') for _ in range(r.randint(1, 3))), 's2': ''.join(r.choice('abc') for _ in range(r.randint(1, 9)))}),
    P('sliding-window-maximum', 'Sliding Window Maximum', 'Sliding Window', 'hard', 'maxSlidingWindow', [('nums', 'int[]'), ('k', 'int')], 'int[]',
      'A window of size k slides from the left of nums to the right, one position at a time. Return the maximum value inside the window at each position.',
      '1 <= k <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
      ['Checking every window costs O(n k).', 'Keep a queue of indices whose values are in decreasing order — smaller values behind a bigger one can never be the maximum.'],
      'Monotonic deque of indices. Before pushing index i, pop smaller values from the back (they can never beat nums[i] while it is in the window). Pop the front if it has left the window. The front is always the current maximum. Each index is pushed and popped once.',
      'O(n)', 'O(k)', maxSlidingWindow,
      [{'nums': [1, 3, -1, -3, 5, 3, 6, 7], 'k': 3}, {'nums': [1], 'k': 1}],
      [{'nums': [9, 11], 'k': 2}, {'nums': [4, -2], 'k': 1}, {'nums': [7, 2, 4], 'k': 2}],
      lambda r: (lambda n: {'nums': ri(r, n, -9, 9), 'k': r.randint(1, n)})(r.randint(2, 12))),
]


# ───────────────────────── Stack ─────────────────────────
def dailyTemperatures(temperatures):
    out, st = [0] * len(temperatures), []
    for i, t in enumerate(temperatures):
        while st and temperatures[st[-1]] < t:
            j = st.pop()
            out[j] = i - j
        st.append(i)
    return out


def evalRPN(tokens):
    st = []
    for t in tokens:
        if t in '+-*/' and len(t) == 1:
            b, a = st.pop(), st.pop()
            st.append(a + b if t == '+' else a - b if t == '-' else a * b if t == '*' else int(a / b))
        else:
            st.append(int(t))
    return st[0]


def nextGreater(nums):
    out, st = [-1] * len(nums), []
    for i, x in enumerate(nums):
        while st and nums[st[-1]] < x:
            out[st.pop()] = x
        st.append(i)
    return out


def largestRectangle(heights):
    st, best = [], 0
    for i, h in enumerate(heights + [0]):
        start = i
        while st and st[-1][1] >= h:
            idx, hh = st.pop()
            best = max(best, hh * (i - idx))
            start = idx
        st.append((start, h))
    return best


def generateParenthesis(n):
    out = []

    def go(s, o, c):
        if len(s) == 2 * n:
            out.append(s); return
        if o < n:
            go(s + '(', o + 1, c)
        if c < o:
            go(s + ')', o, c + 1)
    go('', 0, 0)
    return out


def rpn_gen(r):
    # build a valid expression bottom-up so division by zero never happens
    def build(d):
        if d == 0 or r.random() < 0.3:
            return [str(r.randint(1, 9))]
        a, b = build(d - 1), build(d - 1)
        return a + b + [r.choice('+-*')] if r.random() < 0.8 else a + b + ['/']
    toks = build(2)
    return {'tokens': toks}


def rpn_safe(r):
    while True:
        g = rpn_gen(r)
        try:
            evalRPN(g['tokens']); return g
        except Exception:
            continue


STACK = [
    P('daily-temperatures', 'Daily Temperatures', 'Stack', 'medium', 'dailyTemperatures', [('temperatures', 'int[]')], 'int[]',
      'For each day, return how many days you must wait for a warmer temperature. If no warmer day follows, use 0.',
      '1 <= temperatures.length <= 10^5\n30 <= temperatures[i] <= 100',
      ['Brute force compares each day with all later days.', 'Keep a stack of days that are still waiting for a warmer one.'],
      'Monotonic stack of indices with decreasing temperatures. When today is warmer than the day on top, that day has found its answer (the index difference). Pop and repeat, then push today. Each day is pushed and popped once.',
      'O(n)', 'O(n)', dailyTemperatures,
      [{'temperatures': [73, 74, 75, 71, 69, 72, 76, 73]}, {'temperatures': [30, 40, 50, 60]}],
      [{'temperatures': [90]}, {'temperatures': [60, 50, 40]}, {'temperatures': [50, 50, 50]}],
      lambda r: {'temperatures': ri(r, r.randint(1, 10), 30, 40)}),
    P('evaluate-reverse-polish', 'Evaluate Reverse Polish Notation', 'Stack', 'medium', 'evalRPN', [('tokens', 'str[]')], 'int',
      'Evaluate an arithmetic expression in Reverse Polish Notation. Valid operators are + - * and /. Division truncates toward zero. The expression is always valid.',
      '1 <= tokens.length <= 10^4\nEach token is an operator or an integer in [-200, 200].\nNo division by zero.',
      ['Operands come before their operator.', 'Push numbers; on an operator pop two, apply, push the result.'],
      'Scan left to right with a stack. A number is pushed. An operator pops the right operand then the left operand, applies itself, and pushes the result. Truncate division toward zero (not floor). The final stack top is the value.',
      'O(n)', 'O(n)', evalRPN,
      [{'tokens': ['2', '1', '+', '3', '*']}, {'tokens': ['4', '13', '5', '/', '+']}],
      [{'tokens': ['7']}, {'tokens': ['-7', '2', '/']}, {'tokens': ['10', '6', '9', '3', '+', '-11', '*', '/', '*', '17', '+', '5', '+']}],
      rpn_safe),
    P('next-greater-element', 'Next Greater Element', 'Stack', 'medium', 'nextGreater', [('nums', 'int[]')], 'int[]',
      'For each element, return the first greater element that appears to its right, or -1 if there is none.',
      '1 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9',
      ['Which elements are still "waiting" for a greater value?', 'A stack holds them, and the waiting values are in non-increasing order.'],
      'Scan left to right with a stack of indices whose answer is unknown. A new value resolves every smaller value on top of the stack. Remaining indices have no greater element and keep -1.',
      'O(n)', 'O(n)', nextGreater,
      [{'nums': [2, 1, 2, 4, 3]}, {'nums': [5, 4, 3]}],
      [{'nums': [1]}, {'nums': [1, 1, 1]}, {'nums': [-1, 0, -2, 5]}],
      lambda r: {'nums': ri(r, r.randint(1, 10), -5, 5)}),
    P('largest-rectangle-in-histogram', 'Largest Rectangle in Histogram', 'Stack', 'hard', 'largestRectangle', [('heights', 'int[]')], 'int',
      'heights[i] is the height of a histogram bar of width 1. Return the area of the largest rectangle that fits inside the histogram.',
      '1 <= heights.length <= 10^5\n0 <= heights[i] <= 10^4',
      ['A rectangle is limited by its shortest bar.', 'For each bar, how far can it extend left and right before meeting a shorter bar?'],
      'Monotonic stack of (start index, height) with increasing heights. When a shorter bar arrives, pop taller bars: each popped bar spans from its start to the current index, giving a candidate area; the new bar inherits the earliest start among the popped ones. A sentinel 0 at the end flushes the stack.',
      'O(n)', 'O(n)', largestRectangle,
      [{'heights': [2, 1, 5, 6, 2, 3]}, {'heights': [2, 4]}],
      [{'heights': [0]}, {'heights': [5]}, {'heights': [3, 3, 3]}, {'heights': [6, 2, 5, 4, 5, 1, 6]}],
      lambda r: {'heights': ri(r, r.randint(1, 9), 0, 8)}),
    P('generate-parentheses', 'Generate Parentheses', 'Backtracking', 'medium', 'generateParenthesis', [('n', 'int')], 'strs',
      'Return every well-formed string of n pairs of round brackets. The order of the strings does not matter.',
      '1 <= n <= 8',
      ['You can add "(" while fewer than n have been used.', 'You can add ")" only if it closes an already open bracket.'],
      'Backtracking. Build the string left to right, tracking opened and closed counts. Add "(" if opened < n, and ")" if closed < opened. Every complete string of length 2n built this way is valid, and none is missed. The count is the Catalan number.',
      'O(4^n / sqrt(n))', 'O(n) recursion', generateParenthesis,
      [{'n': 1}, {'n': 3}],
      [{'n': 2}, {'n': 4}, {'n': 5}, {'n': 6}],
      None, compare='unordered'),
]

# ───────────────────────── Binary search ─────────────────────────
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


def searchInsert(nums, target):
    l, r = 0, len(nums)
    while l < r:
        m = (l + r) // 2
        if nums[m] < target:
            l = m + 1
        else:
            r = m
    return l


def searchRotated(nums, target):
    l, r = 0, len(nums) - 1
    while l <= r:
        m = (l + r) // 2
        if nums[m] == target:
            return m
        if nums[l] <= nums[m]:
            if nums[l] <= target < nums[m]:
                r = m - 1
            else:
                l = m + 1
        else:
            if nums[m] < target <= nums[r]:
                l = m + 1
            else:
                r = m - 1
    return -1


def searchRange(nums, target):
    import bisect
    a = bisect.bisect_left(nums, target)
    if a == len(nums) or nums[a] != target:
        return [-1, -1]
    return [a, bisect.bisect_right(nums, target) - 1]


def minEatingSpeed(piles, h):
    l, r = 1, max(piles)
    while l < r:
        m = (l + r) // 2
        if sum((p + m - 1) // m for p in piles) <= h:
            r = m
        else:
            l = m + 1
    return l


def mySqrt(x):
    l, r = 0, x
    while l < r:
        m = (l + r + 1) // 2
        if m * m <= x:
            l = m
        else:
            r = m - 1
    return l


def shipWithinDays(weights, days):
    def need(cap):
        d, cur = 1, 0
        for w in weights:
            if cur + w > cap:
                d += 1; cur = 0
            cur += w
        return d
    l, r = max(weights), sum(weights)
    while l < r:
        m = (l + r) // 2
        if need(m) <= days:
            r = m
        else:
            l = m + 1
    return l


def findMin(nums):
    l, r = 0, len(nums) - 1
    while l < r:
        m = (l + r) // 2
        if nums[m] > nums[r]:
            l = m + 1
        else:
            r = m
    return nums[l]


def rotated(r, n):
    a = sorted(r.sample(range(-20, 20), n))
    k = r.randint(0, n - 1)
    return a[k:] + a[:k]


SEARCH = [
    P('binary-search-index', 'Binary Search', 'Binary Search', 'easy', 'search', [('nums', 'int[]'), ('target', 'int')], 'int',
      'nums is sorted in ascending order and has no duplicates. Return the index of target, or -1 if it is not present. Aim for O(log n).',
      '1 <= nums.length <= 10^4\nAll values are distinct and sorted ascending.',
      ['Look at the middle element first.', 'Each comparison lets you discard half of the remaining range.'],
      'Keep a range [l, r]. Compare the middle value with target: equal returns the index, smaller moves l past the middle, bigger moves r before it. The range halves each step.',
      'O(log n)', 'O(1)', search,
      [{'nums': [-1, 0, 3, 5, 9, 12], 'target': 9}, {'nums': [-1, 0, 3, 5, 9, 12], 'target': 2}],
      [{'nums': [5], 'target': 5}, {'nums': [5], 'target': 4}, {'nums': [1, 3], 'target': 3}],
      lambda r: (lambda a: {'nums': a, 'target': r.choice(a + [100])})(sorted(r.sample(range(-20, 20), r.randint(1, 10))))),
    P('search-insert-position', 'Search Insert Position', 'Binary Search', 'easy', 'searchInsert', [('nums', 'int[]'), ('target', 'int')], 'int',
      'nums is sorted and has distinct values. Return the index of target if it is present; otherwise return the index where it would be inserted to keep the array sorted.',
      '1 <= nums.length <= 10^4\nAscending, distinct.',
      ['This is "the first index whose value is >= target".', 'A lower-bound binary search finds it.'],
      'Lower-bound search on a half-open range [l, r): if nums[m] < target the answer is right of m, otherwise m could be the answer. When l == r it is the first position not less than target.',
      'O(log n)', 'O(1)', searchInsert,
      [{'nums': [1, 3, 5, 6], 'target': 5}, {'nums': [1, 3, 5, 6], 'target': 2}],
      [{'nums': [1, 3, 5, 6], 'target': 7}, {'nums': [1, 3, 5, 6], 'target': 0}, {'nums': [4], 'target': 4}],
      lambda r: {'nums': sorted(r.sample(range(0, 30), r.randint(1, 8))), 'target': r.randint(-2, 32)}),
    P('search-in-rotated-sorted-array', 'Search in Rotated Sorted Array', 'Binary Search', 'medium', 'searchRotated', [('nums', 'int[]'), ('target', 'int')], 'int',
      'A sorted array of distinct values was rotated at an unknown pivot (for example [0,1,2,4,5,6,7] became [4,5,6,7,0,1,2]). Return the index of target or -1. Aim for O(log n).',
      '1 <= nums.length <= 5000\nAll values are distinct.',
      ['At least one half of the range around the middle is always sorted.', 'Check whether the target lies inside the sorted half.'],
      'Binary search where, at each step, one of the two halves [l..m] or [m..r] is sorted. Test if the target falls inside that sorted half to decide which side to keep.',
      'O(log n)', 'O(1)', searchRotated,
      [{'nums': [4, 5, 6, 7, 0, 1, 2], 'target': 0}, {'nums': [4, 5, 6, 7, 0, 1, 2], 'target': 3}],
      [{'nums': [1], 'target': 1}, {'nums': [1], 'target': 0}, {'nums': [3, 1], 'target': 1}],
      lambda r: (lambda a: {'nums': a, 'target': r.choice(a + [99])})(rotated(r, r.randint(1, 9)))),
    P('find-first-and-last-position', 'First and Last Position of a Value', 'Binary Search', 'medium', 'searchRange', [('nums', 'int[]'), ('target', 'int')], 'int[]',
      'nums is sorted ascending and may contain duplicates. Return [first, last], the first and last index where target occurs, or [-1, -1] if it does not occur. Aim for O(log n).',
      '0 <= nums.length <= 10^5',
      ['Two binary searches: one for the left edge, one for the right edge.', 'The left edge is the first index with value >= target.'],
      'Find the lower bound (first index >= target) and the upper bound (first index > target). If the lower bound does not hold target the answer is [-1, -1]; otherwise it is [lower, upper - 1].',
      'O(log n)', 'O(1)', searchRange,
      [{'nums': [5, 7, 7, 8, 8, 10], 'target': 8}, {'nums': [5, 7, 7, 8, 8, 10], 'target': 6}],
      [{'nums': [], 'target': 0}, {'nums': [2, 2], 'target': 2}, {'nums': [1], 'target': 1}],
      lambda r: {'nums': sorted(ri(r, r.randint(1, 10), 0, 5)), 'target': r.randint(0, 6)}),
    P('koko-eating-bananas', 'Eating Speed', 'Binary Search', 'medium', 'minEatingSpeed', [('piles', 'int[]'), ('h', 'int')], 'int',
      'There are piles of bananas. Each hour you choose one pile and eat up to k bananas from it (if the pile has fewer, you finish it and waste the rest of the hour). Return the smallest integer k that lets you finish all piles within h hours.',
      '1 <= piles.length <= h <= 10^9\n1 <= piles[i] <= 10^9',
      ['If k works then any larger k works too.', 'Binary search on k, checking the hours needed with a loop.'],
      'The answer lies in [1, max(piles)]. For a candidate k the hours needed are the sum of ceil(pile / k). That value only decreases as k grows, so binary search for the smallest k whose hours are at most h.',
      'O(n log max(piles))', 'O(1)', minEatingSpeed,
      [{'piles': [3, 6, 7, 11], 'h': 8}, {'piles': [30, 11, 23, 4, 20], 'h': 5}],
      [{'piles': [1], 'h': 1}, {'piles': [30, 11, 23, 4, 20], 'h': 6}, {'piles': [5, 5], 'h': 10}],
      lambda r: (lambda p: {'piles': p, 'h': r.randint(len(p), len(p) + 8)})(ri(r, r.randint(1, 6), 1, 25))),
    P('integer-square-root', 'Integer Square Root', 'Binary Search', 'easy', 'mySqrt', [('x', 'int')], 'int',
      'Return the integer part of the square root of the non-negative integer x, without using a built-in square root.',
      '0 <= x <= 2^31 - 1',
      ['You are looking for the largest m with m x m <= x.', 'That property holds for small m and fails for large m.'],
      'Binary search on m in [0, x] for the largest value with m*m <= x. Use the upper middle in the loop so the range always shrinks.',
      'O(log x)', 'O(1)', mySqrt,
      [{'x': 4}, {'x': 8}],
      [{'x': 0}, {'x': 1}, {'x': 2147395599}, {'x': 15}],
      lambda r: {'x': r.randint(0, 100000)}),
    P('capacity-to-ship-packages', 'Capacity to Ship Packages', 'Binary Search', 'medium', 'shipWithinDays', [('weights', 'int[]'), ('days', 'int')], 'int',
      'Packages must be shipped in the given order, one ship load per day. Each day the ship carries consecutive packages without exceeding its capacity. Return the smallest capacity that ships everything within the given number of days.',
      '1 <= days <= weights.length <= 5 x 10^4\n1 <= weights[i] <= 500',
      ['The capacity is at least the heaviest package and at most the sum of all.', 'For a candidate capacity, simulate loading to count days — a larger capacity never needs more days.'],
      'Binary search the capacity between max(weights) and sum(weights). A greedy simulation counts the days needed for a capacity (start a new day when the next package would overflow). Move to the smaller half when the capacity works.',
      'O(n log sum)', 'O(1)', shipWithinDays,
      [{'weights': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'days': 5}, {'weights': [3, 2, 2, 4, 1, 4], 'days': 3}],
      [{'weights': [1, 2, 3, 1, 1], 'days': 4}, {'weights': [7], 'days': 1}],
      lambda r: (lambda w: {'weights': w, 'days': r.randint(1, len(w))})(ri(r, r.randint(1, 8), 1, 9))),
    P('find-minimum-rotated', 'Find Minimum in Rotated Sorted Array', 'Binary Search', 'medium', 'findMin', [('nums', 'int[]')], 'int',
      'A sorted array of distinct values was rotated between 1 and n times. Return its minimum element in O(log n).',
      '1 <= nums.length <= 5000\nDistinct values.',
      ['Compare the middle value with the last value.', 'If nums[m] > nums[r], the minimum is to the right of m.'],
      'If the middle element is greater than the rightmost one, the rotation point (the minimum) lies right of the middle; otherwise it is at the middle or to its left. Shrink the range until one element remains.',
      'O(log n)', 'O(1)', findMin,
      [{'nums': [3, 4, 5, 1, 2]}, {'nums': [4, 5, 6, 7, 0, 1, 2]}],
      [{'nums': [1]}, {'nums': [2, 1]}, {'nums': [1, 2, 3]}],
      lambda r: {'nums': rotated(r, r.randint(1, 9))}),
]

PROBLEMS = WINDOWS + STACK + SEARCH
