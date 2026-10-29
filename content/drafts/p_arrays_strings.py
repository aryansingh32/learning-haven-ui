from lib import P


def ri(rng, n, lo, hi):
    return [rng.randint(lo, hi) for _ in range(n)]


def word(rng, n, alpha='abc'):
    return ''.join(rng.choice(alpha) for _ in range(n))


# ───────────────────────── Arrays ─────────────────────────
def maxSubarraySum(nums):
    best = cur = nums[0]
    for x in nums[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best


def maxProfit(prices):
    lo, best = prices[0], 0
    for p in prices[1:]:
        best = max(best, p - lo)
        lo = min(lo, p)
    return best


def productExceptSelf(nums):
    n = len(nums)
    out = [1] * n
    for i in range(1, n):
        out[i] = out[i - 1] * nums[i - 1]
    r = 1
    for i in range(n - 1, -1, -1):
        out[i] *= r
        r *= nums[i]
    return out


def rotateRight(nums, k):
    if not nums:
        return nums
    k %= len(nums)
    return nums[len(nums) - k:] + nums[:len(nums) - k] if k else nums[:]


def moveZeroes(nums):
    nz = [x for x in nums if x != 0]
    return nz + [0] * (len(nums) - len(nz))


def missingNumber(nums):
    n = len(nums)
    return n * (n + 1) // 2 - sum(nums)


def singleNumber(nums):
    r = 0
    for x in nums:
        r ^= x
    return r


def majorityElement(nums):
    cand, cnt = None, 0
    for x in nums:
        if cnt == 0:
            cand = x
        cnt += 1 if x == cand else -1
    return cand


def mergeSorted(a, b):
    i = j = 0
    out = []
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i]); i += 1
        else:
            out.append(b[j]); j += 1
    return out + a[i:] + b[j:]


def findDuplicates(nums):
    seen, dup = set(), set()
    for x in nums:
        (dup if x in seen else seen).add(x)
    return sorted(dup)


def subarraySum(nums, k):
    count, pref, seen = 0, 0, {0: 1}
    for x in nums:
        pref += x
        count += seen.get(pref - k, 0)
        seen[pref] = seen.get(pref, 0) + 1
    return count


def sortColors(nums):
    lo, mid, hi = 0, 0, len(nums) - 1
    a = nums[:]
    while mid <= hi:
        if a[mid] == 0:
            a[lo], a[mid] = a[mid], a[lo]; lo += 1; mid += 1
        elif a[mid] == 1:
            mid += 1
        else:
            a[mid], a[hi] = a[hi], a[mid]; hi -= 1
    return a


def jump(nums):
    reach = 0
    for i, x in enumerate(nums):
        if i > reach:
            return False
        reach = max(reach, i + x)
    return True


ARRAYS = [
    P('maximum-subarray-sum', 'Maximum Subarray Sum', 'Arrays', 'medium', 'maxSubarraySum', [('nums', 'int[]')], 'int',
      'Given an integer array nums, find the contiguous non-empty subarray with the largest sum and return that sum.',
      '1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
      ['A subarray ending at index i either extends the best subarray ending at i-1 or starts fresh at i.',
       'You only need the best sum ending at the previous index, not the whole table.'],
      'Kadane\'s algorithm. Keep cur, the best sum of a subarray that ends at the current element: cur = max(x, cur + x). A negative running sum can only hurt the next element, so it is dropped. The answer is the maximum cur seen. One pass, constant memory.',
      'O(n)', 'O(1)', maxSubarraySum,
      [{'nums': [-2, 1, -3, 4, -1, 2, 1, -5, 4]}, {'nums': [5, 4, -1, 7, 8]}],
      [{'nums': [-3]}, {'nums': [-5, -2, -9]}, {'nums': [0, 0, 0]}],
      lambda r: {'nums': ri(r, r.randint(1, 12), -10, 10)}),
    P('best-time-to-buy-and-sell', 'Best Time to Buy and Sell Stock', 'Arrays', 'easy', 'maxProfit', [('prices', 'int[]')], 'int',
      'prices[i] is the price of a stock on day i. Pick one day to buy and a later day to sell. Return the maximum profit you can make, or 0 if no profit is possible.',
      '1 <= prices.length <= 10^5\n0 <= prices[i] <= 10^4',
      ['For a fixed selling day, the best buying day is the cheapest day before it.', 'Track the lowest price seen so far while scanning once.'],
      'Scan left to right keeping the lowest price so far. At each day the best profit if you sell today is price - lowest. Take the maximum over all days. Because you only look back at one running minimum, a single pass is enough.',
      'O(n)', 'O(1)', maxProfit,
      [{'prices': [7, 1, 5, 3, 6, 4]}, {'prices': [7, 6, 4, 3, 1]}],
      [{'prices': [5]}, {'prices': [1, 2]}, {'prices': [2, 4, 1]}],
      lambda r: {'prices': ri(r, r.randint(1, 12), 0, 30)}),
    P('product-of-array-except-self', 'Product of Array Except Self', 'Arrays', 'medium', 'productExceptSelf', [('nums', 'int[]')], 'int[]',
      'Return an array answer where answer[i] is the product of every element of nums except nums[i]. Do not use division.',
      '2 <= nums.length <= 10^4\n-30 <= nums[i] <= 30\nEvery prefix and suffix product fits in a 32-bit integer.',
      ['answer[i] = (product of everything left of i) x (product of everything right of i).', 'Build the left products in one pass and multiply the right products in a second pass.'],
      'Fill answer with prefix products (answer[i] holds the product of nums[0..i-1]). Then walk from the right with a running suffix product and multiply it into answer[i]. No division, so zeros need no special case.',
      'O(n)', 'O(1) extra', productExceptSelf,
      [{'nums': [1, 2, 3, 4]}, {'nums': [-1, 1, 0, -3, 3]}],
      [{'nums': [2, 3]}, {'nums': [0, 0, 5]}, {'nums': [1, 1, 1, 1]}],
      lambda r: {'nums': ri(r, r.randint(2, 8), -4, 4)}),
    P('rotate-array-right', 'Rotate Array Right', 'Arrays', 'medium', 'rotateRight', [('nums', 'int[]'), ('k', 'int')], 'int[]',
      'Return a new array that is nums rotated to the right by k steps. Rotating by one step moves the last element to the front.',
      '0 <= nums.length <= 10^5\n0 <= k <= 10^9',
      ['Rotating by the array length changes nothing, so reduce k first.', 'The last k elements move to the front, in order.'],
      'Reduce k modulo the length. The answer is the last k elements followed by the first n-k. The in-place variant reverses the whole array, then reverses the first k and the last n-k elements.',
      'O(n)', 'O(n) (O(1) with the reversal trick)', rotateRight,
      [{'nums': [1, 2, 3, 4, 5, 6, 7], 'k': 3}, {'nums': [-1, -100, 3, 99], 'k': 2}],
      [{'nums': [], 'k': 5}, {'nums': [1], 'k': 100}, {'nums': [1, 2, 3], 'k': 3}, {'nums': [1, 2, 3], 'k': 0}],
      lambda r: {'nums': ri(r, r.randint(1, 9), -9, 9), 'k': r.randint(0, 25)}),
    P('move-zeroes-to-end', 'Move Zeroes to the End', 'Arrays', 'easy', 'moveZeroes', [('nums', 'int[]')], 'int[]',
      'Return the array with all zeros moved to the end while the non-zero elements keep their original relative order.',
      '0 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9',
      ['Keep a write pointer for the next non-zero slot.', 'After copying the non-zeros forward, fill the rest with zeros.'],
      'Walk the array once; every non-zero value is written at the write pointer, which then advances. Everything from the pointer to the end becomes zero. Order of non-zeros is preserved because we never reorder them.',
      'O(n)', 'O(1) in place', moveZeroes,
      [{'nums': [0, 1, 0, 3, 12]}, {'nums': [0]}],
      [{'nums': []}, {'nums': [1, 2, 3]}, {'nums': [0, 0, 1]}],
      lambda r: {'nums': ri(r, r.randint(0, 10), 0, 3)}),
    P('missing-number', 'Missing Number', 'Arrays', 'easy', 'missingNumber', [('nums', 'int[]')], 'int',
      'nums holds n distinct numbers taken from the range 0 to n. Return the one number in that range that is missing.',
      '1 <= nums.length <= 10^4\n0 <= nums[i] <= n, all distinct',
      ['The sum of 0..n is known.', 'Compare it with the sum of the array.'],
      'The numbers 0..n sum to n(n+1)/2. Subtract the actual sum of the array; what is left is the missing value. An XOR of all indices and values works too and cannot overflow.',
      'O(n)', 'O(1)', missingNumber,
      [{'nums': [3, 0, 1]}, {'nums': [9, 6, 4, 2, 3, 5, 7, 0, 1]}],
      [{'nums': [0]}, {'nums': [1]}, {'nums': [0, 1]}],
      lambda r: (lambda n: (lambda full, m: {'nums': [x for x in full if x != m]})(r.sample(range(n + 1), n + 1), r.randint(0, n)))(r.randint(2, 12))),
    P('single-number', 'Single Number', 'Arrays', 'easy', 'singleNumber', [('nums', 'int[]')], 'int',
      'Every element of nums appears exactly twice except one, which appears once. Return that single element.',
      '1 <= nums.length <= 3 x 10^4 and nums.length is odd\n-3 x 10^4 <= nums[i] <= 3 x 10^4',
      ['What happens when you XOR a number with itself?', 'XOR is order-independent.'],
      'x ^ x = 0 and x ^ 0 = x. XOR-ing the whole array cancels every pair and leaves the single value, in one pass and no extra memory.',
      'O(n)', 'O(1)', singleNumber,
      [{'nums': [2, 2, 1]}, {'nums': [4, 1, 2, 1, 2]}],
      [{'nums': [7]}, {'nums': [-1, -1, -2]}],
      lambda r: (lambda base, s: {'nums': r.sample(base * 2 + [s], len(base) * 2 + 1)})(r.sample(range(-20, 20), 5), 99)),
    P('majority-element', 'Majority Element', 'Arrays', 'easy', 'majorityElement', [('nums', 'int[]')], 'int',
      'Return the element that appears more than n/2 times in nums, where n is the length. A majority element always exists.',
      '1 <= nums.length <= 5 x 10^4\n-10^9 <= nums[i] <= 10^9\nA majority element is guaranteed.',
      ['Could you cancel pairs of different elements?', 'A true majority survives all the cancellations.'],
      'Boyer-Moore voting: keep a candidate and a count. Equal element increments, a different one decrements, and at zero the next element becomes the candidate. A value occupying more than half the slots cannot be cancelled out, so it is the last candidate standing.',
      'O(n)', 'O(1)', majorityElement,
      [{'nums': [3, 2, 3]}, {'nums': [2, 2, 1, 1, 1, 2, 2]}],
      [{'nums': [5]}, {'nums': [1, 1, 2]}],
      lambda r: (lambda m, n: {'nums': r.sample([m] * (n // 2 + 1) + ri(r, n - n // 2 - 1, -3, 3), n)})(r.randint(5, 9), r.randint(3, 11))),
    P('merge-two-sorted-arrays', 'Merge Two Sorted Arrays', 'Arrays', 'easy', 'mergeSorted', [('a', 'int[]'), ('b', 'int[]')], 'int[]',
      'Given two arrays sorted in non-decreasing order, return one sorted array containing all their elements.',
      '0 <= a.length, b.length <= 10^4\n-10^9 <= a[i], b[i] <= 10^9',
      ['Compare the front elements of both arrays and take the smaller one.', 'When one array runs out, append the rest of the other.'],
      'Two pointers, one per array. Repeatedly take the smaller front element. Each element is moved once, so the merge is linear — the same step merge sort relies on.',
      'O(n + m)', 'O(n + m)', mergeSorted,
      [{'a': [1, 3, 5], 'b': [2, 4, 6]}, {'a': [], 'b': [1]}],
      [{'a': [], 'b': []}, {'a': [1, 1], 'b': [1]}, {'a': [5, 6], 'b': [1, 2]}],
      lambda r: {'a': sorted(ri(r, r.randint(0, 6), -9, 9)), 'b': sorted(ri(r, r.randint(0, 6), -9, 9))}),
    P('find-duplicates', 'Find All Duplicates', 'Arrays', 'medium', 'findDuplicates', [('nums', 'int[]')], 'int[]',
      'Return, in ascending order, every value that appears two or more times in nums. Each duplicated value is listed once.',
      '0 <= nums.length <= 10^5\n-10^5 <= nums[i] <= 10^5',
      ['A hash set remembers what you have already seen.', 'Collect repeats in another set so each is reported once, then sort.'],
      'Walk the array with a "seen" set; a value met a second time goes into a "duplicates" set. Sorting the duplicates at the end gives the required order.',
      'O(n log n)', 'O(n)', findDuplicates,
      [{'nums': [4, 3, 2, 7, 8, 2, 3, 1]}, {'nums': [1, 2, 3]}],
      [{'nums': []}, {'nums': [5, 5, 5, 5]}, {'nums': [-1, -1, 2, 2, 3]}],
      lambda r: {'nums': ri(r, r.randint(2, 12), -5, 5)}),
    P('subarray-sum-equals-k', 'Subarray Sum Equals K', 'Hashing', 'medium', 'subarraySum', [('nums', 'int[]'), ('k', 'int')], 'int',
      'Count the contiguous subarrays of nums whose elements add up to exactly k.',
      '1 <= nums.length <= 2 x 10^4\n-1000 <= nums[i] <= 1000\n-10^7 <= k <= 10^7',
      ['The sum of nums[i..j] equals prefix[j+1] - prefix[i].', 'For each prefix, how many earlier prefixes equal prefix - k?'],
      'Keep a running prefix sum and a map from prefix value to how many times it occurred. A subarray ending here sums to k exactly when an earlier prefix equals (current - k), so add that count. Negative numbers are fine because we never shrink a window.',
      'O(n)', 'O(n)', subarraySum,
      [{'nums': [1, 1, 1], 'k': 2}, {'nums': [1, 2, 3], 'k': 3}],
      [{'nums': [0, 0, 0], 'k': 0}, {'nums': [-1, -1, 1], 'k': 0}, {'nums': [5], 'k': 5}],
      lambda r: {'nums': ri(r, r.randint(1, 10), -3, 3), 'k': r.randint(-3, 5)}),
    P('sort-colors', 'Sort Colors', 'Sorting', 'medium', 'sortColors', [('nums', 'int[]')], 'int[]',
      'nums contains only 0, 1 and 2 (think of three colours). Return it sorted in ascending order without calling a library sort.',
      '1 <= nums.length <= 300\nnums[i] is 0, 1 or 2',
      ['Counting the three values and rewriting works in two passes.', 'Can you do it in one pass with three regions: 0s, 1s and unknown, 2s?'],
      'Dutch national flag. Keep pointers lo, mid, hi. Swap 0s behind lo, leave 1s, swap 2s past hi. The region between mid and hi is the unsorted part and shrinks every step.',
      'O(n)', 'O(1)', sortColors,
      [{'nums': [2, 0, 2, 1, 1, 0]}, {'nums': [2, 0, 1]}],
      [{'nums': [0]}, {'nums': [1, 1, 1]}, {'nums': [2, 2, 0, 0]}],
      lambda r: {'nums': ri(r, r.randint(1, 12), 0, 2)}),
    P('jump-game', 'Jump Game', 'Greedy', 'medium', 'jump', [('nums', 'int[]')], 'bool',
      'You start at index 0. nums[i] is the maximum number of steps you can jump forward from index i. Return true if you can reach the last index.',
      '1 <= nums.length <= 10^4\n0 <= nums[i] <= 10^5',
      ['What is the furthest index you can reach so far?', 'If you are standing past the furthest reachable index, you are stuck.'],
      'Greedy reach. Walk the array tracking the furthest reachable index. If the current index exceeds it, the path is blocked; otherwise extend the reach with i + nums[i]. If the scan finishes, the end is reachable.',
      'O(n)', 'O(1)', jump,
      [{'nums': [2, 3, 1, 1, 4]}, {'nums': [3, 2, 1, 0, 4]}],
      [{'nums': [0]}, {'nums': [1, 0, 0]}, {'nums': [2, 0, 0]}],
      lambda r: {'nums': ri(r, r.randint(1, 9), 0, 3)}),
]


# ───────────────────────── Strings ─────────────────────────
def isPalindrome(s):
    t = [c.lower() for c in s if c.isalnum()]
    return t == t[::-1]


def longestCommonPrefix(strs):
    if not strs:
        return ''
    p = strs[0]
    for s in strs[1:]:
        while not s.startswith(p):
            p = p[:-1]
    return p


def reverseWords(s):
    return ' '.join(s.split()[::-1])


def isSubsequence(s, t):
    i = 0
    for c in t:
        if i < len(s) and s[i] == c:
            i += 1
    return i == len(s)


def isIsomorphic(s, t):
    if len(s) != len(t):
        return False
    a, b = {}, {}
    for x, y in zip(s, t):
        if a.setdefault(x, y) != y or b.setdefault(y, x) != x:
            return False
    return True


def firstUniqueChar(s):
    from collections import Counter
    c = Counter(s)
    for i, ch in enumerate(s):
        if c[ch] == 1:
            return i
    return -1


def canConstruct(note, magazine):
    from collections import Counter
    need, have = Counter(note), Counter(magazine)
    return all(have[c] >= n for c, n in need.items())


def longestPalindromeLength(s):
    best = 0
    for c in range(len(s)):
        for l, r in ((c, c), (c, c + 1)):
            while l >= 0 and r < len(s) and s[l] == s[r]:
                l -= 1; r += 1
            best = max(best, r - l - 1)
    return best


def lengthOfLongestSubstring(s):
    last, start, best = {}, 0, 0
    for i, ch in enumerate(s):
        if ch in last and last[ch] >= start:
            start = last[ch] + 1
        last[ch] = i
        best = max(best, i - start + 1)
    return best


def compressString(s):
    if not s:
        return ''
    out, run = [], 1
    for i in range(1, len(s) + 1):
        if i < len(s) and s[i] == s[i - 1]:
            run += 1
        else:
            out.append(s[i - 1] + (str(run) if run > 1 else ''))
            run = 1
    return ''.join(out)


def validParentheses(s):
    pair = {')': '(', ']': '[', '}': '{'}
    st = []
    for c in s:
        if c in pair:
            if not st or st.pop() != pair[c]:
                return False
        else:
            st.append(c)
    return not st


STRINGS = [
    P('valid-palindrome-phrase', 'Valid Palindrome', 'Strings', 'easy', 'isPalindrome', [('s', 'str')], 'bool',
      'A phrase is a palindrome if, after removing every character that is not a letter or digit and ignoring upper/lower case, it reads the same forwards and backwards. Return true if s is a palindrome.',
      '0 <= s.length <= 2 x 10^5\ns contains printable ASCII characters.',
      ['Two pointers moving inward, skipping characters that do not count.', 'Compare lower-cased characters.'],
      'Keep one pointer at each end. Skip anything that is not alphanumeric, compare the lower-cased characters, and move inward. A mismatch means not a palindrome; meeting in the middle means it is.',
      'O(n)', 'O(1)', isPalindrome,
      [{'s': 'A man, a plan, a canal: Panama'}, {'s': 'race a car'}],
      [{'s': ''}, {'s': ' '}, {'s': '0P'}, {'s': 'ab_a'}],
      lambda r: {'s': word(r, r.randint(0, 7), 'aAb ,')}),
    P('longest-common-prefix', 'Longest Common Prefix', 'Strings', 'easy', 'longestCommonPrefix', [('strs', 'str[]')], 'str',
      'Return the longest string that is a prefix of every string in strs, or an empty string if there is none.',
      '1 <= strs.length <= 200\n0 <= strs[i].length <= 200\nLowercase English letters only.',
      ['Start with the first word as the candidate prefix.', 'Shorten the candidate until each other word starts with it.'],
      'Take the first string as the prefix and, for every other string, chop characters off the end of the prefix until the string starts with it. The remaining prefix is common to all.',
      'O(total characters)', 'O(1)', longestCommonPrefix,
      [{'strs': ['flower', 'flow', 'flight']}, {'strs': ['dog', 'racecar', 'car']}],
      [{'strs': ['a']}, {'strs': ['', 'b']}, {'strs': ['same', 'same']}],
      lambda r: (lambda base: {'strs': [base + word(r, r.randint(0, 3)) for _ in range(r.randint(2, 4))]})(word(r, r.randint(0, 4)))),
    P('reverse-words-in-string', 'Reverse Words in a String', 'Strings', 'medium', 'reverseWords', [('s', 'str')], 'str',
      'Words are separated by one or more spaces. Return a string with the words in reverse order, joined by a single space, with no leading or trailing spaces.',
      '1 <= s.length <= 10^4\ns has at least one word.',
      ['Splitting on whitespace removes the extra spaces for you.', 'Reverse the list of words and join.'],
      'Split on runs of whitespace, reverse the list, join with one space. Splitting that way drops leading, trailing and repeated spaces automatically.',
      'O(n)', 'O(n)', reverseWords,
      [{'s': 'the sky is blue'}, {'s': '  hello world  '}],
      [{'s': 'a'}, {'s': 'a   b'}, {'s': '  x  '}],
      lambda r: {'s': ' '.join(word(r, r.randint(1, 4)) for _ in range(r.randint(1, 5)))}),
    P('is-subsequence', 'Is Subsequence', 'Two Pointers', 'easy', 'isSubsequence', [('s', 'str'), ('t', 'str')], 'bool',
      's is a subsequence of t if you can delete some (possibly none) characters from t, without reordering the rest, and get s. Return true if it is.',
      '0 <= s.length <= 100\n0 <= t.length <= 10^4',
      ['Walk through t once.', 'Advance a pointer in s only when the characters match.'],
      'Greedy matching: scan t, and every time t[j] equals s[i] move i forward. If i reaches the end of s, every character was matched in order.',
      'O(|t|)', 'O(1)', isSubsequence,
      [{'s': 'abc', 't': 'ahbgdc'}, {'s': 'axc', 't': 'ahbgdc'}],
      [{'s': '', 't': 'abc'}, {'s': 'a', 't': ''}, {'s': 'aaa', 't': 'aa'}],
      lambda r: {'s': word(r, r.randint(0, 3)), 't': word(r, r.randint(0, 8))}),
    P('isomorphic-strings', 'Isomorphic Strings', 'Hashing', 'easy', 'isIsomorphic', [('s', 'str'), ('t', 'str')], 'bool',
      'Two strings are isomorphic if the characters of s can be replaced to get t, with every occurrence of a character replaced by the same one and no two different characters mapping to the same one. Return true if they are isomorphic.',
      '1 <= s.length <= 5 x 10^4\nt.length == s.length',
      ['You need the mapping to work in both directions.', 'Two dictionaries, or compare "first occurrence" patterns.'],
      'Maintain a map s->t and a map t->s. If a character is already mapped to something different in either direction the strings are not isomorphic. Both maps are needed: "ab" and "aa" must be rejected.',
      'O(n)', 'O(1) for a fixed alphabet', isIsomorphic,
      [{'s': 'egg', 't': 'add'}, {'s': 'foo', 't': 'bar'}],
      [{'s': 'ab', 't': 'aa'}, {'s': 'a', 't': 'b'}, {'s': 'paper', 't': 'title'}],
      lambda r: (lambda n: {'s': word(r, n), 't': word(r, n)})(r.randint(1, 6))),
    P('first-unique-character', 'First Unique Character', 'Hashing', 'easy', 'firstUniqueChar', [('s', 'str')], 'int',
      'Return the index of the first character in s that appears exactly once, or -1 if there is none.',
      '1 <= s.length <= 10^5\nLowercase English letters.',
      ['Count every character first.', 'Then scan again for the first one whose count is 1.'],
      'Two passes: build a frequency table, then walk the string again and return the first index whose count is 1. The second pass keeps the original order.',
      'O(n)', 'O(1) (26 letters)', firstUniqueChar,
      [{'s': 'leetcode'}, {'s': 'aabb'}],
      [{'s': 'z'}, {'s': 'loveleetcode'}, {'s': 'aadadaad'}],
      lambda r: {'s': word(r, r.randint(1, 9), 'abcd')}),
    P('ransom-note', 'Ransom Note', 'Hashing', 'easy', 'canConstruct', [('note', 'str'), ('magazine', 'str')], 'bool',
      'Return true if note can be built from the letters of magazine, using each magazine letter at most once.',
      '1 <= note.length, magazine.length <= 10^5\nLowercase English letters.',
      ['Count the letters available.', 'Every letter of the note must be available at least as many times as needed.'],
      'Count letters in the magazine and in the note. The note can be built exactly when, for each letter, the magazine count is at least the note count.',
      'O(n + m)', 'O(1)', canConstruct,
      [{'note': 'a', 'magazine': 'b'}, {'note': 'aa', 'magazine': 'aab'}],
      [{'note': 'aa', 'magazine': 'ab'}, {'note': 'abc', 'magazine': 'cba'}],
      lambda r: {'note': word(r, r.randint(1, 5)), 'magazine': word(r, r.randint(1, 9))}),
    P('longest-palindromic-substring-length', 'Longest Palindromic Substring (Length)', 'Strings', 'medium', 'longestPalindromeLength', [('s', 'str')], 'int',
      'Return the length of the longest substring of s that is a palindrome.',
      '1 <= s.length <= 1000',
      ['Every palindrome has a centre — a character or a gap between two.', 'Expand outward from each centre while both ends match.'],
      'Try all 2n-1 centres and expand while the characters on both sides are equal; track the longest span. It is quadratic but simple and fast enough for n up to 1000. (Manacher\'s algorithm makes it linear.)',
      'O(n^2)', 'O(1)', longestPalindromeLength,
      [{'s': 'babad'}, {'s': 'cbbd'}],
      [{'s': 'a'}, {'s': 'abcd'}, {'s': 'aaaa'}],
      lambda r: {'s': word(r, r.randint(1, 10), 'ab')}),
    P('longest-substring-without-repeating', 'Longest Substring Without Repeating Characters', 'Sliding Window', 'medium', 'lengthOfLongestSubstring', [('s', 'str')], 'int',
      'Return the length of the longest substring of s in which no character appears twice.',
      '0 <= s.length <= 5 x 10^4',
      ['Keep a window [start, i] with all distinct characters.', 'When a repeat appears, jump start just past its previous position.'],
      'Sliding window with a map of the last index of each character. When s[i] was last seen inside the current window, move the window start to one past that index. The window length at each step is a candidate answer.',
      'O(n)', 'O(min(n, alphabet))', lengthOfLongestSubstring,
      [{'s': 'abcabcbb'}, {'s': 'bbbbb'}],
      [{'s': ''}, {'s': 'pwwkew'}, {'s': 'abba'}],
      lambda r: {'s': word(r, r.randint(0, 12), 'abcd')}),
    P('string-compression', 'String Compression', 'Strings', 'medium', 'compressString', [('s', 'str')], 'str',
      'Compress s by replacing each run of the same character with the character followed by the run length. A run of length 1 stays as just the character. Return the compressed string.',
      '0 <= s.length <= 10^4\nLowercase English letters.',
      ['Walk the string tracking the length of the current run.', 'Write the count only when it is greater than 1.'],
      'Scan once, counting how long the current character repeats. When the run ends, append the character and, if the run is longer than one, its length.',
      'O(n)', 'O(n)', compressString,
      [{'s': 'aabcccccaaa'}, {'s': 'abc'}],
      [{'s': ''}, {'s': 'a'}, {'s': 'zzzzzzzzzzzz'}],
      lambda r: {'s': ''.join(r.choice('abc') * r.randint(1, 4) for _ in range(r.randint(1, 5)))}),
    P('valid-parentheses-brackets', 'Valid Brackets', 'Stack', 'easy', 'validParentheses', [('s', 'str')], 'bool',
      's contains only the characters ( ) [ ] { }. Return true if every opening bracket is closed by the same type of bracket, in the correct order.',
      '0 <= s.length <= 10^4',
      ['The most recent unclosed bracket must be closed first.', 'That is last-in, first-out.'],
      'Push opening brackets on a stack. A closing bracket must match the top of the stack, which is popped. The string is valid if no mismatch happens and the stack is empty at the end.',
      'O(n)', 'O(n)', validParentheses,
      [{'s': '()[]{}'}, {'s': '(]'}],
      [{'s': ''}, {'s': '('}, {'s': '([)]'}, {'s': '{[]}'}],
      lambda r: {'s': word(r, r.randint(0, 8), '()[]{}')}),
]

PROBLEMS = ARRAYS + STRINGS
