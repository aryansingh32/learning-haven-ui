"""Independent brute-force checks of the reference solutions (catches wrong references,
which the judge round-trip cannot). python3 crosscheck.py"""
import random, itertools, sys
sys.path.insert(0, '.')
import p_arrays_strings as A, p_pointers_stack_search as B, p_dp_graph_more as C
rng = random.Random(7)
ri = lambda n, lo, hi: [rng.randint(lo, hi) for _ in range(n)]
w = lambda n, al='abc': ''.join(rng.choice(al) for _ in range(n))
N = 300
def check(name, ref, brute, gen):
    for _ in range(N):
        a = gen()
        r, b = ref(**a), brute(**a)
        assert r == b, (name, a, r, b)
    print('ok', name)

check('maxSubarray', A.maxSubarraySum, lambda nums: max(sum(nums[i:j]) for i in range(len(nums)) for j in range(i+1, len(nums)+1)), lambda: {'nums': ri(rng.randint(1,8), -6, 6)})
check('subarraySum', A.subarraySum, lambda nums, k: sum(sum(nums[i:j]) == k for i in range(len(nums)) for j in range(i+1, len(nums)+1)), lambda: {'nums': ri(rng.randint(1,8), -3, 3), 'k': rng.randint(-3,4)})
check('productExceptSelf', A.productExceptSelf, lambda nums: [eval('*'.join(str(x) for j,x in enumerate(nums) if j!=i)) for i in range(len(nums))], lambda: {'nums': ri(rng.randint(2,6), -4, 4)})
check('longestPalLen', A.longestPalindromeLength, lambda s: max(len(s[i:j]) for i in range(len(s)) for j in range(i+1,len(s)+1) if s[i:j]==s[i:j][::-1]), lambda: {'s': w(rng.randint(1,9),'ab')})
check('longestNoRepeat', A.lengthOfLongestSubstring, lambda s: max([len(s[i:j]) for i in range(len(s)) for j in range(i,len(s)+1) if len(set(s[i:j]))==j-i] or [0]), lambda: {'s': w(rng.randint(0,9),'abcd')})
check('jump', A.jump, lambda nums: (lambda n: (lambda f: f(f,0))(lambda f,i: i>=n-1 or any(f(f,i+s) for s in range(1,nums[i]+1))))(len(nums)), lambda: {'nums': ri(rng.randint(1,8),0,3)})
check('threeSum', lambda nums: sorted(map(list, {tuple(sorted(t)) for t in B.threeSum(nums)})), lambda nums: sorted(map(list, {tuple(sorted(t)) for t in itertools.combinations(nums,3) if sum(t)==0})), lambda: {'nums': ri(rng.randint(0,8),-4,4)})
check('minSubArrayLen', B.minSubArrayLen, lambda target, nums: min([j-i for i in range(len(nums)) for j in range(i+1,len(nums)+1) if sum(nums[i:j])>=target] or [0]), lambda: {'target': rng.randint(1,15), 'nums': ri(rng.randint(1,8),1,6)})
check('charReplace', B.characterReplacement, lambda s,k: max(j-i for i in range(len(s)) for j in range(i+1,len(s)+1) if (j-i)-max(s[i:j].count(c) for c in set(s[i:j]))<=k), lambda: {'s': w(rng.randint(1,9),'ABC'), 'k': rng.randint(0,4)})
check('slidingMax', B.maxSlidingWindow, lambda nums,k: [max(nums[i:i+k]) for i in range(len(nums)-k+1)], lambda: (lambda n:{'nums':ri(n,-9,9),'k':rng.randint(1,n)})(rng.randint(1,10)))
check('largestRect', B.largestRectangle, lambda heights: max(min(heights[i:j])*(j-i) for i in range(len(heights)) for j in range(i+1,len(heights)+1)), lambda: {'heights': ri(rng.randint(1,8),0,7)})
check('searchRotated', B.searchRotated, lambda nums,target: nums.index(target) if target in nums else -1, lambda: (lambda a:{'nums':a,'target':rng.choice(a+[99])})(B.rotated(rng, rng.randint(1,9))))
check('koko', B.minEatingSpeed, lambda piles,h: next(k for k in range(1,max(piles)+1) if sum(-(-p//k) for p in piles)<=h), lambda: (lambda p:{'piles':p,'h':rng.randint(len(p),len(p)+8)})(ri(rng.randint(1,5),1,20)))
check('ship', B.shipWithinDays, lambda weights,days: next(c for c in range(max(weights),sum(weights)+1) if (lambda cap:(lambda f:f(f,0,0))(lambda f,i,d: d if i==len(weights) else f(f,i,d+1) if False else 0))(c) is not None and (lambda c:(lambda w,days:(lambda cnt:cnt)(0))(weights,days))(c) is not None and __import__('functools').reduce(lambda st,x:(st[0]+1,x) if st[1]+x>c else (st[0],st[1]+x),weights,(1,0))[0]<=days), lambda: (lambda w:{'weights':w,'days':rng.randint(1,len(w))})(ri(rng.randint(1,7),1,9)))
check('coinChange', C.coinChange, lambda coins,amount: (lambda b: -1 if b is None else b)(min([n for n in range(0,amount+1) if any(sum(c)==amount for c in itertools.combinations_with_replacement(coins,n))] or [None]) if amount<=14 else None) , lambda: {'coins': rng.sample(range(1,8),rng.randint(1,3)), 'amount': rng.randint(0,14)})
check('LIS', C.lengthOfLIS, lambda nums: max(len(c) for n in range(len(nums)+1) for c in itertools.combinations(nums,n) if all(c[i]<c[i+1] for i in range(len(c)-1))), lambda: {'nums': ri(rng.randint(1,9),-4,8)})
check('LCS', C.longestCommonSubsequence, lambda a,b: max(len(c) for n in range(len(a)+1) for c in itertools.combinations(a,n) if (lambda it:all(ch in it for ch in c))(iter(b))), lambda: {'a': w(rng.randint(1,7)), 'b': w(rng.randint(1,7))})
def ed(a,b,i=0,j=0,m={}):
    from functools import lru_cache
    @lru_cache(None)
    def f(i,j):
        if i==len(a): return len(b)-j
        if j==len(b): return len(a)-i
        if a[i]==b[j]: return f(i+1,j+1)
        return 1+min(f(i+1,j),f(i,j+1),f(i+1,j+1))
    return f(0,0)
check('editDistance', C.minDistance, ed, lambda: {'a': w(rng.randint(0,6)), 'b': w(rng.randint(0,6))})
check('partition', C.canPartition, lambda nums: any(sum(c)*2==sum(nums) for n in range(len(nums)+1) for c in itertools.combinations(nums,n)), lambda: {'nums': ri(rng.randint(1,8),1,9)})
check('maxProduct', C.maxProductSubarray, lambda nums: max(eval('*'.join(map(str,nums[i:j]))) for i in range(len(nums)) for j in range(i+1,len(nums)+1)), lambda: {'nums': ri(rng.randint(1,7),-4,4)})
check('knapsack', C.knapsack, lambda weights,values,capacity: max(sum(values[i] for i in c) for n in range(len(weights)+1) for c in itertools.combinations(range(len(weights)),n) if sum(weights[i] for i in c)<=capacity), lambda: (lambda n:{'weights':ri(n,1,8),'values':ri(n,1,20),'capacity':rng.randint(0,20)})(rng.randint(1,6)))
check('decode', C.numDecodings, lambda s: (lambda f: f(f,0))(lambda f,i: 1 if i==len(s) else 0 if s[i]=='0' else f(f,i+1)+(f(f,i+2) if i+1<len(s) and int(s[i:i+2])<=26 else 0)), lambda: {'s': ''.join(str(rng.randint(0,3)) for _ in range(rng.randint(1,8)))})
check('primes', C.countPrimes, lambda n: sum(all(k%d for d in range(2,k)) and k>1 for k in range(n)), lambda: {'n': rng.randint(0,200)})
check('gas', C.canCompleteCircuit, lambda gas,cost: next((s for s in range(len(gas)) if all(sum(gas[(s+k)%len(gas)]-cost[(s+k)%len(gas)] for k in range(m+1))>=0 for m in range(len(gas)))), -1), lambda: (lambda n:{'gas':ri(n,0,6),'cost':ri(n,0,6)})(rng.randint(1,6)))
check('meeting', C.minMeetingRooms, lambda intervals: max(sum(s<=t<e for s,e in intervals) for t in range(0,30)), lambda: {'intervals': [[(a:=rng.randint(0,8)), a+rng.randint(1,5)] for _ in range(rng.randint(1,6))]})
check('eraseOverlap', C.eraseOverlapIntervals, lambda intervals: len(intervals)-max(len(c) for n in range(len(intervals)+1) for c in itertools.combinations(intervals,n) if all(a[1]<=b[0] or b[1]<=a[0] for a,b in itertools.combinations(c,2))), lambda: {'intervals': [[(a:=rng.randint(0,8)), a+rng.randint(1,4)] for _ in range(rng.randint(1,6))]})
check('mergeIntervals', C.mergeIntervals, lambda intervals: (lambda pts: [[a,b] for a,b in pts])((lambda cov: [(lo,hi) for lo,hi in __import__('functools').reduce(lambda acc,x: acc, [], [])] )(None) or sorted(__import__('functools').reduce(lambda acc,iv: (acc[:-1]+[[acc[-1][0],max(acc[-1][1],iv[1])]]) if acc and iv[0]<=acc[-1][1] else acc+[iv[:]], sorted(intervals), []))), lambda: C.intervals_gen(rng))
print('ALL CROSS-CHECKS PASSED')
