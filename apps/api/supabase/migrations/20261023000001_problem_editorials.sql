-- =============================================================================
-- Editorials for the practice problems (slice W2-P1)
--
-- The Solution tab on /problems/:slug already shows `solution_explanation`
-- (markdown) above the official code; every live problem had code but no
-- written editorial. These are first drafts for the content team to review.
-- Only fills empty editorials, so a reviewed one is never overwritten.
--
-- Data only. Checked by supabase/tests/practice.sql.
-- =============================================================================

update public.problems p set solution_explanation = e.body, updated_at = now()
from (values
('two-sum', $md$
## Approach: one pass with a hash map

For each number `x`, the partner we need is `target - x`. Walk the array once and keep a map from **value → index** of everything seen so far.

1. Compute `need = target - nums[i]`.
2. If `need` is already in the map, the answer is `[map[need], i]`.
3. Otherwise store `nums[i] → i` and move on.

Checking *before* inserting means an element is never paired with itself.

**Why not two loops?** Trying every pair is O(n²). The map turns "have I seen the partner?" into an O(1) lookup.

| | Time | Space |
|---|---|---|
| Brute force | O(n²) | O(1) |
| Hash map | **O(n)** | O(n) |
$md$),
('valid-anagram', $md$
## Approach: count the letters

Two strings are anagrams exactly when every character appears the same number of times in both.

1. If the lengths differ, return `false`.
2. Count each character of `s`.
3. Walk `t`, decrementing; if a count is missing or already zero, return `false`.

Sorting both strings and comparing also works (O(n log n)), and is the shortest code, but counting is linear. With a fixed alphabet (26 letters) the counter is O(1) space.
$md$),
('contains-duplicate', $md$
## Approach: a set remembers what you've seen

Add numbers to a set as you go; the first time a number is already there, you've found a duplicate. The one-liner version compares the set's size with the array's length: if any value repeated, the set is smaller.

- Sorting first and checking neighbours is O(n log n) time and O(1) extra space — useful when memory is tight.
- The set approach is O(n) time, O(n) space.
$md$),
('group-anagrams', $md$
## Approach: a canonical key per group

Anagrams look identical once their letters are sorted: `"eat"`, `"tea"` and `"ate"` all become `"aet"`. Use that sorted string as a key in a map from **key → list of words**, then return the map's values.

- Sorting each word costs O(k log k) for a word of length k, so the total is **O(n · k log k)**.
- A faster key is a 26-slot letter count (e.g. `"1#0#0#…"`), giving O(n · k).
$md$),
('top-k-frequent', $md$
## Approach: count, then pick the k largest

1. Count how often each number appears with a hash map.
2. Sort the (number, count) pairs by count, descending, and take the first `k`.

That is O(n log n). Two ways to do better:

- **Heap of size k** — keep the k most frequent seen so far: O(n log k).
- **Bucket sort** — make buckets indexed by frequency (0…n) and read them from the top until you have k numbers: **O(n)**.
$md$),
('longest-consecutive', $md$
## Approach: only start counting at the start of a run

Put every number in a set. A number `x` begins a run only if `x - 1` is **not** in the set. From each such start, count upward (`x + 1`, `x + 2`, …) while the set contains the next value, and keep the longest length.

Each number is visited at most twice — once in the outer loop and once while extending a run — so the whole thing is **O(n)**, even though it looks like a nested loop. Sorting would be O(n log n).
$md$),
('median-two-sorted', $md$
## Approach: binary-search the partition

Cut both arrays so the left halves together hold `⌊(m + n + 1) / 2⌋` elements. The cut is correct when every element on the left is ≤ every element on the right:

`maxLeft1 ≤ minRight2` and `maxLeft2 ≤ minRight1`.

Binary-search the cut position `i` in the **shorter** array (`j` in the other array follows from it):

- if `maxLeft1 > minRight2`, move `i` left;
- if `maxLeft2 > minRight1`, move `i` right.

Once the cut is right, the median is `max(maxLeft1, maxLeft2)` for an odd total, or the average of that and `min(minRight1, minRight2)` for an even one. Use −∞/+∞ for empty sides.

Time **O(log(min(m, n)))**, space O(1). Merging the arrays would be O(m + n).
$md$),
('trapping-rain-water', $md$
## Approach: two pointers

Water above bar `i` is `min(maxLeft, maxRight) - height[i]`. Instead of precomputing both maxima arrays (O(n) space), move two pointers inward:

- If `height[left] < height[right]`, the left side is the bottleneck: either raise `leftMax`, or add `leftMax - height[left]` water. Move `left` right.
- Otherwise do the same from the right.

The side with the smaller bar is always limited by its own running maximum, because a taller wall is known to exist on the other side. Time **O(n)**, space **O(1)**.
$md$)
) as e(slug, body)
where p.slug = e.slug and (p.solution_explanation is null or length(trim(p.solution_explanation)) = 0);
