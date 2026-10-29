from lib import P


def ri(rng, n, lo, hi):
    return [rng.randint(lo, hi) for _ in range(n)]


def word(rng, n, alpha='abc'):
    return ''.join(rng.choice(alpha) for _ in range(n))


def grid(r, rows, cols, lo, hi):
    return [ri(r, cols, lo, hi) for _ in range(rows)]


# ───────────────────────── Dynamic programming ─────────────────────────
def climbStairs(n):
    a, b = 1, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b


def rob(nums):
    take, skip = 0, 0
    for x in nums:
        take, skip = skip + x, max(take, skip)
    return max(take, skip)


def coinChange(coins, amount):
    INF = amount + 1
    dp = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                dp[a] = min(dp[a], dp[a - c] + 1)
    return dp[amount] if dp[amount] != INF else -1


def lengthOfLIS(nums):
    import bisect
    tails = []
    for x in nums:
        i = bisect.bisect_left(tails, x)
        if i == len(tails):
            tails.append(x)
        else:
            tails[i] = x
    return len(tails)


def uniquePaths(m, n):
    row = [1] * n
    for _ in range(1, m):
        for j in range(1, n):
            row[j] += row[j - 1]
    return row[-1]


def minDistance(a, b):
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            cur[j] = prev[j - 1] if a[i - 1] == b[j - 1] else 1 + min(prev[j], cur[j - 1], prev[j - 1])
        prev = cur
    return prev[-1]


def longestCommonSubsequence(a, b):
    prev = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            cur[j] = prev[j - 1] + 1 if a[i - 1] == b[j - 1] else max(prev[j], cur[j - 1])
        prev = cur
    return prev[-1]


def canPartition(nums):
    s = sum(nums)
    if s % 2:
        return False
    reach = 1
    for x in nums:
        reach |= reach << x
    return bool(reach >> (s // 2) & 1)


def wordBreak(s, words):
    ws = set(words)
    dp = [True] + [False] * len(s)
    for i in range(1, len(s) + 1):
        dp[i] = any(dp[j] and s[j:i] in ws for j in range(i))
    return dp[-1]


def minPathSum(grid):
    R, C = len(grid), len(grid[0])
    dp = [[0] * C for _ in range(R)]
    for i in range(R):
        for j in range(C):
            best = 0 if i == j == 0 else min(dp[i - 1][j] if i else 10 ** 18, dp[i][j - 1] if j else 10 ** 18)
            dp[i][j] = grid[i][j] + best
    return dp[-1][-1]


def numDecodings(s):
    if not s or s[0] == '0':
        return 0
    a, b = 1, 1
    for i in range(1, len(s)):
        c = 0
        if s[i] != '0':
            c += b
        if 10 <= int(s[i - 1:i + 1]) <= 26:
            c += a
        a, b = b, c
    return b


def maxProductSubarray(nums):
    hi = lo = best = nums[0]
    for x in nums[1:]:
        hi, lo = max(x, hi * x, lo * x), min(x, hi * x, lo * x)
        best = max(best, hi)
    return best


def knapsack(weights, values, capacity):
    dp = [0] * (capacity + 1)
    for w, v in zip(weights, values):
        for c in range(capacity, w - 1, -1):
            dp[c] = max(dp[c], dp[c - w] + v)
    return dp[capacity]


DP = [
    P('climbing-stairs-ways', 'Climbing Stairs', 'Dynamic Programming', 'easy', 'climbStairs', [('n', 'int')], 'int',
      'You climb a staircase of n steps, taking 1 or 2 steps at a time. In how many distinct ways can you reach the top?',
      '1 <= n <= 45',
      ['To stand on step n you came from step n-1 or n-2.', 'ways(n) = ways(n-1) + ways(n-2).'],
      'The last move was either 1 or 2 steps, so ways(n) = ways(n-1) + ways(n-2) — the Fibonacci recurrence. Keep only the last two values for constant memory.',
      'O(n)', 'O(1)', climbStairs,
      [{'n': 2}, {'n': 5}], [{'n': 1}, {'n': 3}, {'n': 45}, {'n': 10}],
      lambda r: {'n': r.randint(1, 40)}),
    P('house-robber-max', 'House Robber', 'Dynamic Programming', 'medium', 'rob', [('nums', 'int[]')], 'int',
      'nums[i] is the money in house i along a street. You cannot rob two adjacent houses. Return the most money you can rob.',
      '0 <= nums.length <= 100\n0 <= nums[i] <= 400',
      ['At each house you either rob it (and skipped the previous one) or skip it.', 'Track the best total if the previous house was robbed and if it was skipped.'],
      'Two running values: take (best total with the current house robbed) and skip (best total without it). Robbing needs the previous "skip"; skipping takes the larger of the previous two. The answer is the larger at the end.',
      'O(n)', 'O(1)', rob,
      [{'nums': [1, 2, 3, 1]}, {'nums': [2, 7, 9, 3, 1]}],
      [{'nums': []}, {'nums': [5]}, {'nums': [2, 1, 1, 2]}],
      lambda r: {'nums': ri(r, r.randint(1, 10), 0, 20)}),
    P('coin-change-min', 'Coin Change', 'Dynamic Programming', 'medium', 'coinChange', [('coins', 'int[]'), ('amount', 'int')], 'int',
      'You have unlimited coins of each denomination in coins. Return the fewest coins needed to make exactly amount, or -1 if it cannot be made.',
      '1 <= coins.length <= 12\n1 <= coins[i] <= 2^31 - 1 (distinct)\n0 <= amount <= 10^4',
      ['Define dp[a] = fewest coins for amount a.', 'dp[a] = 1 + min(dp[a - c]) over coins c <= a.'],
      'Bottom-up table of the fewest coins for every amount from 0 to amount. Each amount tries every coin as the last one. Amounts that stay at infinity are unreachable.',
      'O(amount x coins)', 'O(amount)', coinChange,
      [{'coins': [1, 2, 5], 'amount': 11}, {'coins': [2], 'amount': 3}],
      [{'coins': [1], 'amount': 0}, {'coins': [186, 419, 83, 408], 'amount': 6249}, {'coins': [2, 5, 10, 1], 'amount': 27}],
      lambda r: {'coins': r.sample(range(1, 12), r.randint(1, 4)), 'amount': r.randint(0, 40)}),
    P('longest-increasing-subsequence', 'Longest Increasing Subsequence', 'Dynamic Programming', 'medium', 'lengthOfLIS', [('nums', 'int[]')], 'int',
      'Return the length of the longest strictly increasing subsequence of nums (elements need not be adjacent).',
      '1 <= nums.length <= 2500\n-10^4 <= nums[i] <= 10^4',
      ['A simple dp[i] = longest ending at i is O(n^2).', 'Keep, for each length, the smallest possible tail value — it stays sorted, so binary search it.'],
      'Patience-sorting idea: tails[k] is the smallest tail of an increasing subsequence of length k+1. For each number, find the first tail >= it by binary search and replace it (or append if none). The final length of tails is the answer.',
      'O(n log n)', 'O(n)', lengthOfLIS,
      [{'nums': [10, 9, 2, 5, 3, 7, 101, 18]}, {'nums': [0, 1, 0, 3, 2, 3]}],
      [{'nums': [7, 7, 7, 7]}, {'nums': [1]}, {'nums': [5, 4, 3, 2, 1]}],
      lambda r: {'nums': ri(r, r.randint(1, 12), -5, 15)}),
    P('unique-paths-grid', 'Unique Paths', 'Dynamic Programming', 'medium', 'uniquePaths', [('m', 'int'), ('n', 'int')], 'int',
      'A robot starts at the top-left of an m x n grid and can only move right or down. How many different paths lead to the bottom-right corner?',
      '1 <= m, n <= 100\nThe answer fits in a 64-bit integer.',
      ['Paths to a cell = paths from above + paths from the left.', 'The first row and column each have exactly one path.'],
      'dp[i][j] = dp[i-1][j] + dp[i][j-1]. One row of memory is enough: update it in place left to right. (It equals the binomial coefficient C(m+n-2, m-1).)',
      'O(m x n)', 'O(n)', uniquePaths,
      [{'m': 3, 'n': 7}, {'m': 3, 'n': 2}],
      [{'m': 1, 'n': 1}, {'m': 1, 'n': 9}, {'m': 10, 'n': 10}],
      lambda r: {'m': r.randint(1, 12), 'n': r.randint(1, 12)}),
    P('edit-distance', 'Edit Distance', 'Dynamic Programming', 'hard', 'minDistance', [('a', 'str'), ('b', 'str')], 'int',
      'Return the minimum number of operations to turn string a into string b. An operation inserts a character, deletes a character, or replaces a character.',
      '0 <= a.length, b.length <= 500\nLowercase English letters.',
      ['dp[i][j] is the distance between the first i letters of a and the first j letters of b.', 'If the last letters match, copy dp[i-1][j-1]; otherwise take 1 + the smallest of insert, delete, replace.'],
      'Classic table. When a[i-1] == b[j-1] the cost is dp[i-1][j-1]; otherwise 1 + min(dp[i-1][j] (delete), dp[i][j-1] (insert), dp[i-1][j-1] (replace)). Only the previous row is needed.',
      'O(|a| x |b|)', 'O(|b|)', minDistance,
      [{'a': 'horse', 'b': 'ros'}, {'a': 'intention', 'b': 'execution'}],
      [{'a': '', 'b': ''}, {'a': 'abc', 'b': ''}, {'a': '', 'b': 'abc'}, {'a': 'same', 'b': 'same'}],
      lambda r: {'a': word(r, r.randint(0, 6), 'abc'), 'b': word(r, r.randint(0, 6), 'abc')}),
    P('longest-common-subsequence', 'Longest Common Subsequence', 'Dynamic Programming', 'medium', 'longestCommonSubsequence', [('a', 'str'), ('b', 'str')], 'int',
      'Return the length of the longest subsequence that appears in both strings (characters in order, not necessarily adjacent), or 0 if there is none.',
      '1 <= a.length, b.length <= 1000\nLowercase English letters.',
      ['dp[i][j] = LCS of the first i letters of a and first j of b.', 'Matching last letters extend the LCS by one; otherwise take the better of dropping a letter from either string.'],
      'If a[i-1] == b[j-1] then dp[i][j] = dp[i-1][j-1] + 1, else max(dp[i-1][j], dp[i][j-1]). The bottom-right cell is the answer; two rolling rows keep memory small.',
      'O(|a| x |b|)', 'O(|b|)', longestCommonSubsequence,
      [{'a': 'abcde', 'b': 'ace'}, {'a': 'abc', 'b': 'def'}],
      [{'a': 'abc', 'b': 'abc'}, {'a': 'a', 'b': 'a'}, {'a': 'bsbininm', 'b': 'jmjkbkjkv'}],
      lambda r: {'a': word(r, r.randint(1, 8), 'abc'), 'b': word(r, r.randint(1, 8), 'abc')}),
    P('partition-equal-subset-sum', 'Partition Equal Subset Sum', 'Dynamic Programming', 'medium', 'canPartition', [('nums', 'int[]')], 'bool',
      'Return true if the positive integers in nums can be split into two groups with equal sums.',
      '1 <= nums.length <= 200\n1 <= nums[i] <= 100',
      ['If the total is odd the answer is no.', 'Otherwise can some subset reach total/2? That is a subset-sum question.'],
      'Subset-sum DP: keep the set of reachable sums (here as a bitmask). Adding a number x ORs the set shifted by x into itself. The answer is whether total/2 is reachable.',
      'O(n x sum)', 'O(sum)', canPartition,
      [{'nums': [1, 5, 11, 5]}, {'nums': [1, 2, 3, 5]}],
      [{'nums': [2]}, {'nums': [1, 1]}, {'nums': [100, 100, 100, 100, 99, 1]}],
      lambda r: {'nums': ri(r, r.randint(1, 8), 1, 9)}),
    P('word-break-possible', 'Word Break', 'Dynamic Programming', 'medium', 'wordBreak', [('s', 'str'), ('words', 'str[]')], 'bool',
      'Return true if s can be split into a sequence of one or more words from the dictionary words (words may be reused).',
      '1 <= s.length <= 300\n1 <= words.length <= 1000\nLowercase English letters.',
      ['dp[i] means the first i letters can be segmented.', 'dp[i] is true if some j < i has dp[j] true and s[j:i] is a word.'],
      'Prefix table: dp[0] is true; dp[i] is true when there is a split point j with dp[j] true and s[j:i] in the dictionary. A hash set makes the lookup constant time.',
      'O(n^2) lookups', 'O(n)', wordBreak,
      [{'s': 'leetcode', 'words': ['leet', 'code']}, {'s': 'catsandog', 'words': ['cats', 'dog', 'sand', 'and', 'cat']}],
      [{'s': 'a', 'words': ['a']}, {'s': 'aaaa', 'words': ['aa', 'aaa']}, {'s': 'ab', 'words': ['a']}],
      lambda r: {'s': word(r, r.randint(1, 8), 'ab'), 'words': r.sample(['a', 'b', 'ab', 'ba', 'aab', 'bb'], r.randint(1, 4))}),
    P('minimum-path-sum', 'Minimum Path Sum', 'Dynamic Programming', 'medium', 'minPathSum', [('grid', 'int[][]')], 'int',
      'Each cell of a grid holds a non-negative number. Moving only right or down from the top-left to the bottom-right, return the smallest possible sum along a path.',
      '1 <= rows, cols <= 200\n0 <= grid[i][j] <= 200',
      ['Each cell can only be entered from above or from the left.', 'cost(cell) = value + min(cost(above), cost(left)).'],
      'Fill a table of the cheapest cost to reach each cell. The first row and column have only one way in. The bottom-right value is the answer.',
      'O(m x n)', 'O(m x n)', minPathSum,
      [{'grid': [[1, 3, 1], [1, 5, 1], [4, 2, 1]]}, {'grid': [[1, 2, 3], [4, 5, 6]]}],
      [{'grid': [[7]]}, {'grid': [[1, 2, 3]]}, {'grid': [[1], [2], [3]]}],
      lambda r: {'grid': grid(r, r.randint(1, 4), r.randint(1, 4), 0, 9)}),
    P('decode-ways', 'Decode Ways', 'Dynamic Programming', 'medium', 'numDecodings', [('s', 'str')], 'int',
      'A message of digits is decoded using A=1, B=2, ..., Z=26. Return how many different ways the digit string s can be decoded (0 if it cannot be decoded at all).',
      '1 <= s.length <= 100\ns contains only digits and may start with 0.',
      ['A single digit 1-9 is a letter; a leading 0 alone is not.', 'Two digits form a letter if the pair is between 10 and 26.'],
      'ways(i) = (ways(i-1) if the last digit is non-zero) + (ways(i-2) if the last two digits are 10..26). Keep two rolling values. A string starting with 0 has no decoding.',
      'O(n)', 'O(1)', numDecodings,
      [{'s': '12'}, {'s': '226'}],
      [{'s': '06'}, {'s': '0'}, {'s': '10'}, {'s': '2101'}, {'s': '27'}],
      lambda r: {'s': ''.join(str(r.randint(0, 3)) for _ in range(r.randint(1, 8)))}),
    P('maximum-product-subarray', 'Maximum Product Subarray', 'Dynamic Programming', 'medium', 'maxProductSubarray', [('nums', 'int[]')], 'int',
      'Return the largest product of any contiguous non-empty subarray of nums.',
      '1 <= nums.length <= 2 x 10^4\n-10 <= nums[i] <= 10\nThe product always fits in a 32-bit integer.',
      ['A negative number can turn the smallest product into the largest.', 'Track both the maximum and the minimum product ending at each position.'],
      'Keep hi and lo, the largest and smallest product of a subarray ending here. A new element x gives candidates x, hi*x and lo*x (a negative flips them). The answer is the biggest hi seen.',
      'O(n)', 'O(1)', maxProductSubarray,
      [{'nums': [2, 3, -2, 4]}, {'nums': [-2, 0, -1]}],
      [{'nums': [-3]}, {'nums': [-2, 3, -4]}, {'nums': [0, 2]}],
      lambda r: {'nums': ri(r, r.randint(1, 8), -4, 4)}),
    P('zero-one-knapsack', '0/1 Knapsack', 'Dynamic Programming', 'medium', 'knapsack', [('weights', 'int[]'), ('values', 'int[]'), ('capacity', 'int')], 'int',
      'Item i has weight weights[i] and value values[i]. You can take each item at most once. Return the largest total value whose total weight does not exceed capacity.',
      '1 <= weights.length == values.length <= 100\n1 <= weights[i], values[i] <= 100\n0 <= capacity <= 1000',
      ['dp[c] = best value with capacity c.', 'Process items one at a time and loop capacity downwards so an item is used once.'],
      'One-dimensional DP: for each item, for c from capacity down to its weight, dp[c] = max(dp[c], dp[c - w] + v). Iterating downward prevents reusing the same item twice.',
      'O(n x capacity)', 'O(capacity)', knapsack,
      [{'weights': [1, 3, 4, 5], 'values': [1, 4, 5, 7], 'capacity': 7}, {'weights': [2, 3], 'values': [3, 4], 'capacity': 1}],
      [{'weights': [5], 'values': [10], 'capacity': 5}, {'weights': [1, 1, 1], 'values': [5, 5, 5], 'capacity': 2}, {'weights': [4], 'values': [9], 'capacity': 0}],
      lambda r: (lambda n: {'weights': ri(r, n, 1, 8), 'values': ri(r, n, 1, 20), 'capacity': r.randint(0, 20)})(r.randint(1, 6))),
]


# ───────────────────── Greedy / intervals / math / bits ─────────────────────
def mergeIntervals(intervals):
    out = []
    for s, e in sorted(intervals):
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out


def eraseOverlapIntervals(intervals):
    cnt, end = 0, float('-inf')
    for s, e in sorted(intervals, key=lambda x: x[1]):
        if s >= end:
            end = e
        else:
            cnt += 1
    return cnt


def minMeetingRooms(intervals):
    ev = sorted([(s, 1) for s, e in intervals] + [(e, -1) for s, e in intervals])
    cur = best = 0
    for _, d in ev:
        cur += d
        best = max(best, cur)
    return best


def canCompleteCircuit(gas, cost):
    if sum(gas) < sum(cost):
        return -1
    tank = start = 0
    for i in range(len(gas)):
        tank += gas[i] - cost[i]
        if tank < 0:
            tank, start = 0, i + 1
    return start


def countPrimes(n):
    if n < 3:
        return 0
    sieve = [True] * n
    sieve[0] = sieve[1] = False
    for i in range(2, int(n ** 0.5) + 1):
        if sieve[i]:
            for j in range(i * i, n, i):
                sieve[j] = False
    return sum(sieve)


def isPowerOfTwo(n):
    return n > 0 and n & (n - 1) == 0


def hammingWeight(n):
    c = 0
    while n:
        n &= n - 1
        c += 1
    return c


def isHappy(n):
    seen = set()
    while n != 1 and n not in seen:
        seen.add(n)
        n = sum(int(d) ** 2 for d in str(n))
    return n == 1


def pascalRow(rowIndex):
    row = [1]
    for _ in range(rowIndex):
        row = [1] + [row[i] + row[i + 1] for i in range(len(row) - 1)] + [1]
    return row


def gcdOfTwo(a, b):
    while b:
        a, b = b, a % b
    return a


def countBits(n):
    return [bin(i).count('1') for i in range(n + 1)]


def trailingZeroes(n):
    c = 0
    while n:
        n //= 5
        c += n
    return c


def intervals_gen(r):
    return {'intervals': [sorted([r.randint(0, 10), r.randint(0, 10)]) for _ in range(r.randint(1, 6))]}


MORE = [
    P('merge-intervals-list', 'Merge Intervals', 'Intervals', 'medium', 'mergeIntervals', [('intervals', 'int[][]')], 'int[][]',
      'Each interval is [start, end]. Merge all overlapping intervals (touching at a shared endpoint counts as overlapping) and return the result sorted by start.',
      '1 <= intervals.length <= 10^4\n0 <= start <= end <= 10^4',
      ['Sort by start so overlapping intervals become neighbours.', 'Extend the last merged interval while the next one starts inside it.'],
      'Sort by start. Keep an output list; if the next interval starts at or before the end of the last output interval, extend that end, otherwise start a new interval.',
      'O(n log n)', 'O(n)', mergeIntervals,
      [{'intervals': [[1, 3], [2, 6], [8, 10], [15, 18]]}, {'intervals': [[1, 4], [4, 5]]}],
      [{'intervals': [[1, 4]]}, {'intervals': [[5, 6], [1, 2]]}, {'intervals': [[1, 10], [2, 3], [4, 5]]}],
      intervals_gen),
    P('non-overlapping-intervals', 'Non-overlapping Intervals', 'Greedy', 'medium', 'eraseOverlapIntervals', [('intervals', 'int[][]')], 'int',
      'Return the minimum number of intervals to remove so that the rest do not overlap. Intervals that only touch at an endpoint do not overlap.',
      '1 <= intervals.length <= 10^5\n-5 x 10^4 <= start < end <= 5 x 10^4',
      ['Keeping the most intervals is the same as removing the fewest.', 'Among intervals, always keep the one that finishes earliest.'],
      'Activity-selection greedy: sort by end time and keep an interval whenever it starts at or after the last kept end. Every interval that cannot be kept is a removal.',
      'O(n log n)', 'O(1)', eraseOverlapIntervals,
      [{'intervals': [[1, 2], [2, 3], [3, 4], [1, 3]]}, {'intervals': [[1, 2], [1, 2], [1, 2]]}],
      [{'intervals': [[1, 2], [2, 3]]}, {'intervals': [[1, 5]]}, {'intervals': [[0, 2], [1, 3], [2, 4], [3, 5], [4, 6]]}],
      lambda r: {'intervals': [[(a := r.randint(0, 8)), a + r.randint(1, 4)] for _ in range(r.randint(1, 6))]}),
    P('meeting-rooms-required', 'Meeting Rooms', 'Intervals', 'medium', 'minMeetingRooms', [('intervals', 'int[][]')], 'int',
      'Each meeting is [start, end). Return the minimum number of rooms needed so that no two overlapping meetings share a room. A meeting may start exactly when another ends.',
      '1 <= intervals.length <= 10^4\n0 <= start < end <= 10^6',
      ['Think of people entering and leaving rooms over time.', 'Sort start and end events; count how many are open at once.'],
      'Turn each meeting into a +1 event at its start and a -1 event at its end; sort events (an end sorts before a start at the same time because -1 < 1). The maximum running total is the room count.',
      'O(n log n)', 'O(n)', minMeetingRooms,
      [{'intervals': [[0, 30], [5, 10], [15, 20]]}, {'intervals': [[7, 10], [2, 4]]}],
      [{'intervals': [[1, 5]]}, {'intervals': [[1, 2], [2, 3]]}, {'intervals': [[1, 4], [2, 5], [3, 6]]}],
      lambda r: {'intervals': [[(a := r.randint(0, 8)), a + r.randint(1, 5)] for _ in range(r.randint(1, 6))]}),
    P('gas-station-circuit', 'Gas Station', 'Greedy', 'medium', 'canCompleteCircuit', [('gas', 'int[]'), ('cost', 'int[]')], 'int',
      'There are stations on a circular route. Station i gives gas[i] fuel and the trip to the next station costs cost[i]. Starting with an empty tank, return the index of the station from which you can drive all the way round, or -1 if that is impossible. If a solution exists it is unique.',
      '1 <= gas.length == cost.length <= 10^5\n0 <= gas[i], cost[i] <= 10^4',
      ['If total gas is less than total cost the trip is impossible.', 'If you run dry between stations a and b, no station between them can be the start.'],
      'First check that total gas covers total cost. Then sweep once keeping the tank; whenever it goes negative, restart from the next station. The final candidate start is the answer.',
      'O(n)', 'O(1)', canCompleteCircuit,
      [{'gas': [1, 2, 3, 4, 5], 'cost': [3, 4, 5, 1, 2]}, {'gas': [2, 3, 4], 'cost': [3, 4, 3]}],
      [{'gas': [5], 'cost': [4]}, {'gas': [1], 'cost': [2]}, {'gas': [5, 1, 2, 3, 4], 'cost': [4, 4, 1, 5, 1]}],
      lambda r: (lambda n: {'gas': ri(r, n, 0, 6), 'cost': ri(r, n, 0, 6)})(r.randint(1, 6))),
    P('count-primes-below', 'Count Primes', 'Math', 'medium', 'countPrimes', [('n', 'int')], 'int',
      'Return the number of prime numbers strictly less than n.',
      '0 <= n <= 5 x 10^6',
      ['Testing every number for primality is slow.', 'Cross out multiples of each prime instead.'],
      'Sieve of Eratosthenes: mark 0 and 1 as not prime; for each prime p up to sqrt(n) mark p*p, p*p+p, ... as composite. The unmarked numbers are the primes.',
      'O(n log log n)', 'O(n)', countPrimes,
      [{'n': 10}, {'n': 0}],
      [{'n': 1}, {'n': 2}, {'n': 3}, {'n': 100}, {'n': 5000}],
      lambda r: {'n': r.randint(0, 2000)}),
    P('power-of-two-check', 'Power of Two', 'Bit Manipulation', 'easy', 'isPowerOfTwo', [('n', 'int')], 'bool',
      'Return true if the integer n is a power of two (1, 2, 4, 8, ...).',
      '-2^31 <= n <= 2^31 - 1',
      ['A power of two has exactly one bit set.', 'n & (n - 1) clears the lowest set bit.'],
      'For positive n, n & (n-1) removes the lowest set bit, so the result is 0 exactly when only one bit was set. Zero and negatives are not powers of two.',
      'O(1)', 'O(1)', isPowerOfTwo,
      [{'n': 16}, {'n': 3}],
      [{'n': 1}, {'n': 0}, {'n': -16}, {'n': 1073741824}, {'n': 6}],
      lambda r: {'n': r.randint(-5, 70)}),
    P('number-of-one-bits', 'Number of 1 Bits', 'Bit Manipulation', 'easy', 'hammingWeight', [('n', 'int')], 'int',
      'Return the number of 1 bits in the binary representation of the non-negative integer n.',
      '0 <= n <= 2^31 - 1',
      ['Check the lowest bit, then shift.', 'Or clear the lowest set bit each time with n & (n - 1).'],
      'Each n & (n-1) removes exactly one set bit, so counting the iterations until n becomes zero gives the population count in time proportional to the number of set bits.',
      'O(bits set)', 'O(1)', hammingWeight,
      [{'n': 11}, {'n': 128}],
      [{'n': 0}, {'n': 2147483647}, {'n': 1}],
      lambda r: {'n': r.randint(0, 10 ** 6)}),
    P('happy-number', 'Happy Number', 'Math', 'easy', 'isHappy', [('n', 'int')], 'bool',
      'Replace n by the sum of the squares of its digits, and repeat. n is happy if this process reaches 1; otherwise it loops forever in a cycle that does not include 1. Return true if n is happy.',
      '1 <= n <= 2^31 - 1',
      ['The sequence either hits 1 or repeats a value.', 'Remember the values you have seen.'],
      'Simulate the process while recording seen values. Reaching 1 means happy; seeing a repeated value means a cycle, so not happy. (Floyd cycle detection gives O(1) memory.)',
      'O(log n) per step', 'O(log n)', isHappy,
      [{'n': 19}, {'n': 2}],
      [{'n': 1}, {'n': 7}, {'n': 4}, {'n': 100}],
      lambda r: {'n': r.randint(1, 500)}),
    P('pascal-triangle-row', "Pascal's Triangle Row", 'Math', 'easy', 'pascalRow', [('rowIndex', 'int')], 'int[]',
      "Return row rowIndex (0-indexed) of Pascal's triangle, where each number is the sum of the two numbers above it.",
      '0 <= rowIndex <= 33',
      ['Each row starts and ends with 1.', 'Build the next row from the previous one.'],
      'Start from [1] and repeatedly build the next row: 1, then sums of adjacent pairs, then 1. After rowIndex iterations the row is ready.',
      'O(rowIndex^2)', 'O(rowIndex)', pascalRow,
      [{'rowIndex': 3}, {'rowIndex': 0}],
      [{'rowIndex': 1}, {'rowIndex': 5}, {'rowIndex': 20}],
      lambda r: {'rowIndex': r.randint(0, 25)}),
    P('greatest-common-divisor', 'Greatest Common Divisor', 'Math', 'easy', 'gcdOfTwo', [('a', 'int'), ('b', 'int')], 'int',
      'Return the greatest common divisor of two non-negative integers a and b (not both zero).',
      '0 <= a, b <= 10^9\nNot both zero.',
      ['gcd(a, b) = gcd(b, a mod b).', 'When b becomes 0, a is the answer.'],
      "Euclid's algorithm: replace (a, b) by (b, a mod b) until b is 0. The remainder shrinks at least as fast as Fibonacci numbers grow, so it takes O(log min(a, b)) steps.",
      'O(log min(a, b))', 'O(1)', gcdOfTwo,
      [{'a': 12, 'b': 18}, {'a': 7, 'b': 13}],
      [{'a': 0, 'b': 5}, {'a': 5, 'b': 0}, {'a': 1000000000, 'b': 500000000}],
      lambda r: {'a': r.randint(0, 200), 'b': r.randint(1, 200)}),
    P('counting-bits', 'Counting Bits', 'Bit Manipulation', 'easy', 'countBits', [('n', 'int')], 'int[]',
      'Return an array ans of length n + 1 where ans[i] is the number of 1 bits in i.',
      '0 <= n <= 10^5',
      ['The bits of i are the bits of i shifted right by one, plus the last bit.', 'ans[i] = ans[i >> 1] + (i & 1).'],
      'Dynamic programming on bits: i has the same 1-bits as i >> 1 plus one more if i is odd. One pass fills the whole array.',
      'O(n)', 'O(n)', countBits,
      [{'n': 2}, {'n': 5}], [{'n': 0}, {'n': 1}, {'n': 16}],
      lambda r: {'n': r.randint(0, 40)}),
    P('factorial-trailing-zeroes', 'Factorial Trailing Zeroes', 'Math', 'medium', 'trailingZeroes', [('n', 'int')], 'int',
      'Return the number of trailing zeroes in n! (n factorial).',
      '0 <= n <= 10^4',
      ['Each trailing zero comes from a factor 10 = 2 x 5.', 'There are always more 2s than 5s, so count the 5s.'],
      'Count factors of 5 in 1..n: n/5 + n/25 + n/125 + ... Multiples of 25 contribute an extra 5, and so on. Never compute the factorial itself.',
      'O(log n)', 'O(1)', trailingZeroes,
      [{'n': 3}, {'n': 5}], [{'n': 0}, {'n': 25}, {'n': 100}, {'n': 10000}],
      lambda r: {'n': r.randint(0, 500)}),
]


# ───────────────────────── Matrix / graph ─────────────────────────
def rotateImage(matrix):
    return [list(r) for r in zip(*matrix[::-1])]


def spiralOrder(matrix):
    out = []
    m = [r[:] for r in matrix]
    while m:
        out += m.pop(0)
        m = [list(r) for r in zip(*m)][::-1]
    return out


def setZeroes(matrix):
    R, C = len(matrix), len(matrix[0])
    rows = {i for i in range(R) for j in range(C) if matrix[i][j] == 0}
    cols = {j for i in range(R) for j in range(C) if matrix[i][j] == 0}
    return [[0 if i in rows or j in cols else matrix[i][j] for j in range(C)] for i in range(R)]


def searchMatrix(matrix, target):
    R, C = len(matrix), len(matrix[0])
    l, r = 0, R * C - 1
    while l <= r:
        m = (l + r) // 2
        v = matrix[m // C][m % C]
        if v == target:
            return True
        if v < target:
            l = m + 1
        else:
            r = m - 1
    return False


def numIslands(grid):
    R, C = len(grid), len(grid[0])
    seen, count = set(), 0
    for i in range(R):
        for j in range(C):
            if grid[i][j] == 1 and (i, j) not in seen:
                count += 1
                st = [(i, j)]
                seen.add((i, j))
                while st:
                    x, y = st.pop()
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        a, b = x + dx, y + dy
                        if 0 <= a < R and 0 <= b < C and grid[a][b] == 1 and (a, b) not in seen:
                            seen.add((a, b))
                            st.append((a, b))
    return count


def canFinish(numCourses, prerequisites):
    from collections import deque
    adj = [[] for _ in range(numCourses)]
    indeg = [0] * numCourses
    for a, b in prerequisites:
        adj[b].append(a)
        indeg[a] += 1
    q = deque(i for i in range(numCourses) if indeg[i] == 0)
    done = 0
    while q:
        u = q.popleft()
        done += 1
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return done == numCourses


def orangesRotting(grid):
    from collections import deque
    R, C = len(grid), len(grid[0])
    g = [r[:] for r in grid]
    q = deque((i, j) for i in range(R) for j in range(C) if g[i][j] == 2)
    fresh = sum(v == 1 for r in g for v in r)
    t = 0
    while q and fresh:
        for _ in range(len(q)):
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, b = x + dx, y + dy
                if 0 <= a < R and 0 <= b < C and g[a][b] == 1:
                    g[a][b] = 2
                    fresh -= 1
                    q.append((a, b))
        t += 1
    return t if fresh == 0 else -1


def shortestPathBinaryMatrix(grid):
    from collections import deque
    n = len(grid)
    if grid[0][0] or grid[-1][-1]:
        return -1
    q, seen = deque([(0, 0, 1)]), {(0, 0)}
    while q:
        x, y, d = q.popleft()
        if (x, y) == (n - 1, n - 1):
            return d
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                a, b = x + dx, y + dy
                if 0 <= a < n and 0 <= b < n and not grid[a][b] and (a, b) not in seen:
                    seen.add((a, b))
                    q.append((a, b, d + 1))
    return -1


def square(r, n):
    return [ri(r, n, 0, 9) for _ in range(n)]


def sorted_matrix(r):
    R, C = r.randint(1, 4), r.randint(1, 4)
    vals = sorted(r.sample(range(0, 60), R * C))
    return [vals[i * C:(i + 1) * C] for i in range(R)], vals


def course_gen(r):
    n = r.randint(1, 6)
    pre = []
    for _ in range(r.randint(0, 6)):
        a, b = r.randint(0, n - 1), r.randint(0, n - 1)
        if a != b:
            pre.append([a, b])
    return {'numCourses': n, 'prerequisites': pre}


def sm_gen(r):
    m, vals = sorted_matrix(r)
    return {'matrix': m, 'target': r.choice(vals + [100])}


MATRIX = [
    P('rotate-image-matrix', 'Rotate Image', 'Matrix', 'medium', 'rotateImage', [('matrix', 'int[][]')], 'int[][]',
      'Return an n x n matrix rotated 90 degrees clockwise.',
      'n == matrix.length == matrix[i].length\n1 <= n <= 20\n-1000 <= matrix[i][j] <= 1000',
      ['The first row becomes the last column.', 'Transpose, then reverse every row — or equivalently, reverse the rows then transpose.'],
      'A 90-degree clockwise rotation equals reversing the order of the rows and then transposing. The in-place variant transposes then reverses each row.',
      'O(n^2)', 'O(n^2) (O(1) in place)', rotateImage,
      [{'matrix': [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}, {'matrix': [[5, 1, 9, 11], [2, 4, 8, 10], [13, 3, 6, 7], [15, 14, 12, 16]]}],
      [{'matrix': [[1]]}, {'matrix': [[1, 2], [3, 4]]}],
      lambda r: {'matrix': square(r, r.randint(1, 5))}),
    P('spiral-matrix-order', 'Spiral Matrix', 'Matrix', 'medium', 'spiralOrder', [('matrix', 'int[][]')], 'int[]',
      'Return all elements of an m x n matrix in clockwise spiral order, starting from the top-left.',
      '1 <= m, n <= 10\n-100 <= matrix[i][j] <= 100',
      ['Take the top row, then turn the remaining matrix.', 'Peel layers: top, right, bottom, left — shrinking the bounds each time.'],
      'Repeatedly remove the top row and append it, then rotate the remaining rows counter-clockwise so the next edge becomes the top row. Each element is handled once.',
      'O(m x n)', 'O(m x n)', spiralOrder,
      [{'matrix': [[1, 2, 3], [4, 5, 6], [7, 8, 9]]}, {'matrix': [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]}],
      [{'matrix': [[7]]}, {'matrix': [[1, 2, 3]]}, {'matrix': [[1], [2], [3]]}],
      lambda r: {'matrix': grid(r, r.randint(1, 5), r.randint(1, 5), -9, 9)}),
    P('set-matrix-zeroes', 'Set Matrix Zeroes', 'Matrix', 'medium', 'setZeroes', [('matrix', 'int[][]')], 'int[][]',
      'If an element of the matrix is 0, set its entire row and column to 0. Return the resulting matrix.',
      '1 <= m, n <= 200\n-2^31 <= matrix[i][j] <= 2^31 - 1',
      ['Do not zero things while scanning, or you will create new zeros.', 'First record which rows and columns contain a zero.'],
      'Two passes: collect the rows and columns that hold a zero, then zero every cell whose row or column was collected. (The O(1)-space version stores the flags in the first row and column.)',
      'O(m x n)', 'O(m + n)', setZeroes,
      [{'matrix': [[1, 1, 1], [1, 0, 1], [1, 1, 1]]}, {'matrix': [[0, 1, 2, 0], [3, 4, 5, 2], [1, 3, 1, 5]]}],
      [{'matrix': [[1]]}, {'matrix': [[0]]}, {'matrix': [[1, 2], [3, 4]]}],
      lambda r: {'matrix': grid(r, r.randint(1, 4), r.randint(1, 4), 0, 3)}),
    P('search-sorted-2d-matrix', 'Search a Sorted Matrix', 'Binary Search', 'medium', 'searchMatrix', [('matrix', 'int[][]'), ('target', 'int')], 'bool',
      'Each row of the matrix is sorted ascending, and the first number of each row is greater than the last number of the previous row. Return true if target is in the matrix. Aim for O(log(m x n)).',
      '1 <= m, n <= 100',
      ['Read the matrix as one long sorted list.', 'Index k maps to row k // n and column k % n.'],
      'Treat the matrix as a flat sorted array of m x n values and binary search it, converting the middle index to (row, column) with division and modulo.',
      'O(log(m x n))', 'O(1)', searchMatrix,
      [{'matrix': [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 'target': 3}, {'matrix': [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], 'target': 13}],
      [{'matrix': [[1]], 'target': 1}, {'matrix': [[1]], 'target': 2}, {'matrix': [[1, 3]], 'target': 3}],
      sm_gen),
    P('number-of-islands-count', 'Number of Islands', 'Graphs', 'medium', 'numIslands', [('grid', 'int[][]')], 'int',
      'A grid contains 1 (land) and 0 (water). An island is a group of land cells connected horizontally or vertically. Return the number of islands.',
      '1 <= rows, cols <= 300\ngrid[i][j] is 0 or 1',
      ['When you find unvisited land, a whole island is discovered.', 'Flood-fill it (DFS or BFS) so you do not count it again.'],
      'Scan every cell. At an unvisited land cell, increment the island count and flood-fill all connected land with an explicit stack, marking cells visited. Each cell is visited once.',
      'O(rows x cols)', 'O(rows x cols)', numIslands,
      [{'grid': [[1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]}, {'grid': [[1, 0, 1], [0, 1, 0], [1, 0, 1]]}],
      [{'grid': [[0]]}, {'grid': [[1]]}, {'grid': [[1, 1, 1]]}],
      lambda r: {'grid': grid(r, r.randint(1, 5), r.randint(1, 5), 0, 1)}),
    P('course-schedule-possible', 'Course Schedule', 'Graphs', 'medium', 'canFinish', [('numCourses', 'int'), ('prerequisites', 'int[][]')], 'bool',
      'There are numCourses courses labelled 0..numCourses-1. Each pair [a, b] means you must take course b before course a. Return true if you can finish all courses.',
      '1 <= numCourses <= 2000\n0 <= prerequisites.length <= 5000\nAll pairs are distinct.',
      ['This is asking whether the prerequisite graph has a cycle.', 'Repeatedly take courses that have no remaining prerequisites.'],
      "Kahn's topological sort: compute in-degrees, queue the courses with none, and repeatedly remove one, lowering its dependents' in-degrees. If all courses get removed there is no cycle.",
      'O(V + E)', 'O(V + E)', canFinish,
      [{'numCourses': 2, 'prerequisites': [[1, 0]]}, {'numCourses': 2, 'prerequisites': [[1, 0], [0, 1]]}],
      [{'numCourses': 1, 'prerequisites': []}, {'numCourses': 3, 'prerequisites': [[1, 0], [2, 1]]}, {'numCourses': 3, 'prerequisites': [[0, 1], [1, 2], [2, 0]]}],
      course_gen),
    P('rotting-oranges-time', 'Rotting Oranges', 'Graphs', 'medium', 'orangesRotting', [('grid', 'int[][]')], 'int',
      'In a grid, 0 is empty, 1 is a fresh orange and 2 is a rotten orange. Every minute, each fresh orange next to (up, down, left, right) a rotten one becomes rotten. Return the minutes until no fresh orange remains, or -1 if that never happens.',
      '1 <= rows, cols <= 10\ngrid[i][j] is 0, 1 or 2',
      ['All rotten oranges spread at the same time — think of a multi-source BFS.', 'Process the queue one minute (one level) at a time.'],
      'Multi-source BFS: start with every rotten orange in the queue and expand level by level, each level being one minute. If fresh oranges remain when the queue empties, the answer is -1.',
      'O(rows x cols)', 'O(rows x cols)', orangesRotting,
      [{'grid': [[2, 1, 1], [1, 1, 0], [0, 1, 1]]}, {'grid': [[2, 1, 1], [0, 1, 1], [1, 0, 1]]}],
      [{'grid': [[0]]}, {'grid': [[1]]}, {'grid': [[2]]}, {'grid': [[0, 2]]}],
      lambda r: {'grid': grid(r, r.randint(1, 4), r.randint(1, 4), 0, 2)}),
    P('shortest-path-binary-matrix', 'Shortest Path in a Binary Matrix', 'Graphs', 'medium', 'shortestPathBinaryMatrix', [('grid', 'int[][]')], 'int',
      'In an n x n grid of 0s (open) and 1s (blocked), find the length of the shortest path from the top-left to the bottom-right moving through open cells in any of 8 directions. The length counts the cells visited. Return -1 if no path exists.',
      'n == grid.length == grid[i].length\n1 <= n <= 100\ngrid[i][j] is 0 or 1',
      ['Every move costs the same, so a plain BFS finds the shortest path.', 'Remember to check that the start and end cells are open.'],
      'Breadth-first search from the start, expanding in 8 directions and recording the distance. The first time the target is dequeued the distance is minimal because BFS explores by increasing path length.',
      'O(n^2)', 'O(n^2)', shortestPathBinaryMatrix,
      [{'grid': [[0, 1], [1, 0]]}, {'grid': [[0, 0, 0], [1, 1, 0], [1, 1, 0]]}],
      [{'grid': [[0]]}, {'grid': [[1]]}, {'grid': [[1, 0], [0, 0]]}, {'grid': [[0, 0, 0], [1, 1, 1], [0, 0, 0]]}],
      lambda r: (lambda n: {'grid': [[r.choice([0, 0, 1]) for _ in range(n)] for _ in range(n)]})(r.randint(1, 5))),
]


# ───────────────────────── Backtracking ─────────────────────────
def subsets(nums):
    out = [[]]
    for x in nums:
        out += [s + [x] for s in out]
    return out


def permute(nums):
    from itertools import permutations
    return [list(p) for p in permutations(nums)]


def combinationSum(candidates, target):
    out = []

    def go(i, rem, cur):
        if rem == 0:
            out.append(cur[:]); return
        if rem < 0 or i == len(candidates):
            return
        cur.append(candidates[i]); go(i, rem - candidates[i], cur); cur.pop()
        go(i + 1, rem, cur)
    go(0, target, [])
    return out


BACK = [
    P('subsets-power-set', 'Subsets', 'Backtracking', 'medium', 'subsets', [('nums', 'int[]')], 'lists',
      'Given an array of distinct integers, return every possible subset (the power set), including the empty subset. The order of subsets and of elements inside them does not matter.',
      '0 <= nums.length <= 10\n-10 <= nums[i] <= 10\nAll values are distinct.',
      ['Each element is either in a subset or not: 2^n choices.', 'Start from [[]] and, for each number, add a copy of every existing subset with that number included.'],
      'Iterative doubling: begin with the empty subset; for each number x, append x to a copy of every subset built so far. After n numbers there are 2^n subsets.',
      'O(n x 2^n)', 'O(n x 2^n)', subsets,
      [{'nums': [1, 2, 3]}, {'nums': [0]}],
      [{'nums': []}, {'nums': [1, 2]}, {'nums': [-1, 0, 5, 7]}],
      lambda r: {'nums': r.sample(range(-5, 6), r.randint(0, 5))}, n_random=3, compare='unordered_deep'),
    P('permutations-all', 'Permutations', 'Backtracking', 'medium', 'permute', [('nums', 'int[]')], 'lists',
      'Return all possible orderings of an array of distinct integers, in any order.',
      '1 <= nums.length <= 6\nAll values are distinct.',
      ['Choose the first element, then permute the rest.', 'Track which elements are already used.'],
      'Backtracking: at each position try every unused number, recurse, then undo the choice. There are n! complete permutations.',
      'O(n x n!)', 'O(n)', permute,
      [{'nums': [1, 2, 3]}, {'nums': [0, 1]}],
      [{'nums': [1]}, {'nums': [1, 2, 3, 4]}, {'nums': [-1, 0, 1]}],
      lambda r: {'nums': r.sample(range(-5, 6), r.randint(1, 5))}, n_random=2, compare='unordered_deep'),
    P('combination-sum-all', 'Combination Sum', 'Backtracking', 'medium', 'combinationSum', [('candidates', 'int[]'), ('target', 'int')], 'lists',
      'Given distinct positive integers candidates and a target, return all unique combinations of candidates that sum to target. A number may be used any number of times. Order does not matter.',
      '1 <= candidates.length <= 30\n2 <= candidates[i] <= 40, distinct\n1 <= target <= 40',
      ['Decide for each candidate: use it again, or move on.', 'Stop when the remaining total hits 0 (record) or goes negative (abandon).'],
      'Backtracking over candidate positions. At position i, either take candidates[i] (staying at i so it can repeat) or skip to i+1. A path with remaining 0 is a solution, and moving forward only avoids duplicate orderings.',
      'O(2^target) worst case', 'O(target)', combinationSum,
      [{'candidates': [2, 3, 6, 7], 'target': 7}, {'candidates': [2, 3, 5], 'target': 8}],
      [{'candidates': [2], 'target': 1}, {'candidates': [3, 5], 'target': 15}, {'candidates': [7, 3, 2], 'target': 18}],
      lambda r: {'candidates': r.sample(range(2, 9), r.randint(1, 3)), 'target': r.randint(2, 14)}, compare='unordered_deep'),
]

PROBLEMS = DP + MORE + MATRIX + BACK
