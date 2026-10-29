"""Aptitude Mastery course. Worked examples are computed here (f-strings), and each chapter's quiz is
drawn by build_courses.py from the verified question bank by topic, so the numbers can't drift.
Original text.
"""
from fractions import Fraction
import math

COURSE = dict(
    slug='aptitude-mastery-for-placements',
    title='Aptitude Mastery for Placements',
    description='The quantitative, reasoning and verbal topics every campus placement test uses: formulas, shortcuts, worked examples and practice quizzes.',
    difficulty='beginner',
)

# (title, topic_tag, difficulty, hook, minutes, lesson_md, bank_topics)
CH = []


def ch(*a):
    CH.append(a)


p1 = 40 * 250 // 100
ch('Percentages', 'percentages', 'BEGINNER',
   'A phone costs Rs 20,000 and is "20% off, then 10% off". Is that 30% off? Seeing why not is the heart of percentages.', 40,
   f"""## The core idea
"Percent" means "per hundred". **x% of y = x/100 x y.**

Convert freely between the three forms: 25% = 25/100 = 0.25 = 1/4. Knowing the common ones by heart saves minutes:

| % | fraction | | % | fraction |
|---|---|---|---|---|
| 50 | 1/2 | | 12.5 | 1/8 |
| 25 | 1/4 | | 20 | 1/5 |
| 33.33 | 1/3 | | 10 | 1/10 |
| 66.67 | 2/3 | | 5 | 1/20 |

## Percentage change
**Change % = (new - old) / old x 100.** Always divide by the **old** value.

## Successive changes
An increase of a% followed by a change of b% gives a net change of **a + b + ab/100** (use a negative number for a decrease).

> Worked example: price up 20% then down 20%. Net = 20 - 20 - (20 x 20)/100 = **{20 - 20 - 20 * 20 / 100:g}%**. Going up and down by the same percentage never gets you back to the start.

## Population and growth
Growing r% a year for n years multiplies by (1 + r/100)^n.

> Worked example: 40,000 growing 10% a year for 2 years = 40,000 x 1.1 x 1.1 = **{40000 * 121 // 100:,}**.

## Quick method for "x% of y"
Compute 10% (move the decimal), then build: 15% = 10% + half of 10%. Example: 15% of 240 = 24 + 12 = **{15 * 240 // 100}**.

## Common traps
- Confusing "20% more than" (x 1.2) with "20% of" (x 0.2).
- Adding successive percentages instead of using the combined formula.
- Dividing by the new value rather than the old one when finding percentage change.
""", ['Percentages'])

ch('Profit, Loss and Discount', 'profit-loss', 'BEGINNER',
   'A shopkeeper marks a shirt up by 40% and then offers 20% off. Does he gain, break even, or lose?', 40,
   f"""## Definitions
- **Cost price (CP)**: what the seller paid. **Selling price (SP)**: what the buyer pays.
- **Profit = SP - CP**, **Loss = CP - SP**.
- **Profit % = profit / CP x 100**, **Loss % = loss / CP x 100**. Both are on the **cost price**.

## Direct formulas
- SP = CP x (100 + profit%) / 100
- SP = CP x (100 - loss%) / 100
- CP = SP x 100 / (100 + profit%)  (or 100 - loss%)

> Worked example: CP = Rs 1,200, profit 15%. SP = 1,200 x 115/100 = **Rs {1200 * 115 // 100:,}**.

## Marked price and discount
- **Discount is on the marked price (MP)**: SP = MP x (100 - d)/100.
- Two successive discounts of d1% and d2% are **not** d1 + d2: multiply the factors.

> Worked example: MP = Rs 1,000, discounts 20% and 10%: 1,000 x 0.8 x 0.9 = **Rs {1000 * 80 * 90 // 10000}**, an overall discount of {100 - 72}%, not 30%.

## Marking up then discounting
Marked 40% above cost and sold at 20% off: SP = CP x 1.4 x 0.8 = 1.12 CP, a **12% profit**.

## Shortcut
If two articles are sold at the same price, one at x% profit and one at x% loss, the overall result is always a **loss of x^2/100 %**.

## Common traps
- Computing profit % on the selling price.
- Applying the second discount to the original marked price instead of the already reduced price.
""", ['Profit and Loss'])

ch('Simple and Compound Interest', 'interest', 'BEGINNER',
   'Two banks both offer 10%. One pays interest on your original deposit only; the other pays interest on the interest too. After 10 years the gap is large.', 40,
   f"""## Simple interest (SI)
**SI = P x R x T / 100**, and the total amount is P + SI. Interest is always on the original principal.

> Worked example: P = 5,000, R = 8%, T = 3 years -> SI = 5,000 x 8 x 3 / 100 = **Rs {5000 * 8 * 3 // 100:,}**.

## Compound interest (CI)
Interest is added to the principal each period. **Amount = P x (1 + R/100)^T**, and **CI = Amount - P**.

> Worked example: P = 10,000, R = 10%, T = 2 -> Amount = 10,000 x 1.1^2 = {10000 * 121 // 100:,}; CI = **Rs {10000 * 121 // 100 - 10000:,}**. The SI would have been Rs {10000 * 10 * 2 // 100:,}; the extra Rs {10000 * 121 // 100 - 10000 - 10000 * 10 * 2 // 100} is interest on interest.

## Handy results
- For 2 years, CI - SI = P x (R/100)^2.
- Half-yearly compounding: use rate R/2 and 2T periods. Quarterly: R/4 and 4T.
- Doubling time (rule of 72): at R% compound interest, money doubles in about 72/R years.

## Quick multipliers for 2 years
10% -> 1.21, 20% -> 1.44, 5% -> 1.1025.

## Common traps
- Using the simple-interest formula when the problem says "compounded".
- Forgetting to subtract the principal when asked for the interest rather than the amount.
""", ['Simple and Compound Interest'])

ch('Ratio, Proportion and Mixtures', 'ratio-mixtures', 'BEGINNER',
   'A recipe says 3 parts flour to 2 parts sugar. You have 500 g of mix: how much sugar? Ratios turn a story into division.', 40,
   f"""## Ratios
a:b means "a parts for every b parts". To share an amount in a ratio a:b:c, one part = amount / (a + b + c).

> Worked example: Rs 6,000 split 2:3:5 -> one part = 6,000/10 = 600, so the shares are **Rs {2 * 600:,}, Rs {3 * 600:,}, Rs {5 * 600:,}**.

## Proportion
If a:b = c:d then a x d = b x c ("product of extremes = product of means"). Direct proportion: more of one gives more of the other. Inverse proportion: more workers, fewer days (workers x days is constant).

## Mixtures
In a mixture of milk and water in ratio a:b, milk is a/(a+b) of the whole.

> Worked example: 50 L of milk and water in ratio 3:2. Milk = 30 L, water = 20 L. To make the ratio 3:3, water must be 30 L, so add **10 L** of water. (Milk stays at 30 L; only the water changes.)

## Alligation (mixing two prices)
To mix two items of price p1 < p2 to get a mean price m, the quantities are in the ratio **(p2 - m) : (m - p1)**.

> Worked example: tea at Rs 100 and Rs 200 a kg to make a Rs 140 mix: ratio = (200-140):(140-100) = 60:40 = **3:2**.

## Common traps
- Treating a ratio as an amount (3:2 is parts, not 3 and 2 units).
- Forgetting that the *unchanged* part of a mixture is the anchor when you add something.
""", ['Ratio and Proportion', 'Mixtures'])

ch('Time and Work', 'time-work', 'INTERMEDIATE',
   'One painter takes 12 days, another 24. Together? Not 18 — rates add, not days.', 40,
   f"""## The core idea
Think in **rates**. If A finishes a job in x days, A does **1/x of the job per day**. Rates of people working together add up.

**Together: time = xy / (x + y)** for two people.

> Worked example: A takes 12 days, B takes 24 days. Together: 12 x 24 / 36 = **{12 * 24 // 36} days**.

## Work done and work left
If A works d days of an x-day job, the fraction done is d/x and the fraction left is 1 - d/x.

## Pipes and cisterns
Same idea: a filling pipe is positive work, an emptying pipe is negative. Net rate = fill rate - empty rate.

> Worked example: a tap fills a tank in 6 h, a leak empties it in 12 h. Net = 1/6 - 1/12 = 1/12 per hour, so it fills in **12 hours**.

## Workers and days (man-days)
**Total work = workers x days x hours.** If the work is fixed: workers1 x days1 = workers2 x days2. 8 workers need 15 days -> 12 workers need 8 x 15/12 = **10 days**.

## Efficiency view
If A is twice as efficient as B, A takes half the time. If together they finish in 12 days and A is twice as fast, then B alone takes 36 days and A alone takes 18 days (rates 1/18 + 1/36 = 1/12).

## Common traps
- Averaging the days (12 and 24 does not give 18).
- Forgetting that a worker who leaves early still contributed the part he did.
""", ['Time and Work'])

ch('Speed, Time and Distance', 'speed-distance', 'INTERMEDIATE',
   'A train enters a tunnel — how long until the last coach leaves? The trick is to ask what distance the train must actually cover.', 45,
   f"""## The triangle
**Distance = Speed x Time.** Keep units consistent.

Convert km/h to m/s by multiplying by 5/18; m/s to km/h by 18/5. (54 km/h = 15 m/s.)

## Average speed
For the **same distance** at speeds a and b: average = **2ab/(a + b)**, not (a + b)/2.

> Worked example: 60 km/h one way and 40 km/h back -> 2 x 60 x 40 / 100 = **{2 * 60 * 40 // 100} km/h**.

## Relative speed
- Towards each other: speeds **add**. Same direction: speeds **subtract**.

> Worked example: cities 300 km apart, cars at 40 and 60 km/h start towards each other. Time = 300 / 100 = **{300 // 100} hours**.

## Trains
- Crossing a pole or person: distance = train length.
- Crossing a platform/bridge: distance = train length + platform length.
- Two trains crossing: relative speed, and distance = sum of lengths.

> Worked example: a 150 m train at 54 km/h (15 m/s) crosses a 150 m platform in (150 + 150)/15 = **{(150 + 150) // 15} s**.

## Boats and streams
Downstream speed = u + v, upstream = u - v (u = boat in still water, v = stream). Still-water speed = (down + up)/2; stream speed = (down - up)/2.

## Common traps
- Forgetting the platform's length for trains.
- Using the arithmetic mean for average speed over equal distances.
""", ['Speed, Time and Distance'])

ch('Averages and Ages', 'averages-ages', 'BEGINNER',
   'Your marks in five tests average 70. What do you need in the sixth to reach 75? Averages are sums in disguise.', 35,
   f"""## Averages
**Average = sum / count**, so **sum = average x count**. Almost every average problem is solved by switching to sums.

> Worked example: average of 5 numbers is 30 and four of them add to 110. The fifth = 30 x 5 - 110 = **{30 * 5 - 110}**.

## Changing an average
When a new value joins a group of n with average A, the new average = (n x A + new)/(n + 1).

> Worked example: 10 students average 20 years; a 31-year-old teacher joins. New average = (200 + 31)/11 = **{(200 + 31) // 11}** years.

## Weighted average
When groups have different sizes, weight each average by its size: (n1 A1 + n2 A2)/(n1 + n2).

## Ages
- Write present ages with one variable (x and x + d).
- "After n years" adds n to **each** person.
- The difference between two people's ages never changes.

> Worked example: a father is 4 times his son's age; the son is 15. In 4 years the father is 4 x 15 + 4 = **{4 * 15 + 4}**.

## Common traps
- Adding n years to only one person.
- Averaging two averages without weighting by group size.
""", ['Averages', 'Ages'])

ch('Number System: HCF, LCM and Remainders', 'number-system', 'INTERMEDIATE',
   'Two buses leave a stop every 12 and 18 minutes. When do they leave together again? The least common multiple answers it.', 45,
   f"""## HCF and LCM
- **HCF (GCD)**: the largest number dividing both. **LCM**: the smallest number both divide.
- For two numbers: **HCF x LCM = product of the numbers**.
- Use prime factorisation: HCF takes the **smallest** power of each prime, LCM the **largest**.

> Worked example: 12 = 2^2 x 3 and 18 = 2 x 3^2. HCF = 2 x 3 = **{math.gcd(12, 18)}**; LCM = 2^2 x 3^2 = **{math.lcm(12, 18)}**. Check: 6 x 36 = 216 = 12 x 18.

## Word-problem forms
- "Meet again after" or "ring together" -> LCM.
- "Largest equal groups / longest tile that fits" -> HCF.

## Divisibility rules
2: last digit even. 3: digit sum divisible by 3. 4: last two digits. 5: ends in 0 or 5. 9: digit sum divisible by 9. 11: alternating digit sum divisible by 11.

## Remainders
(a + b) mod m = ((a mod m) + (b mod m)) mod m, and the same for products. For powers, find the repeating cycle of remainders.

> Worked example: last digit of 7^k cycles 7, 9, 3, 1. 7^10: 10 mod 4 = 2, so the last digit is **9**; and 2^10 mod 5 = **{pow(2, 10, 5)}**.

## Common traps
- Mixing up when to use LCM (meeting again) and HCF (splitting equally).
- Computing huge powers directly instead of using cycles.
""", ['Number System'])

ch('Permutations, Combinations and Probability', 'pnc-probability', 'INTERMEDIATE',
   'How many different 4-person committees can a class of 10 form? Counting methodically beats listing.', 50,
   f"""## Counting rules
- **Multiplication rule**: independent stages multiply (3 shirts x 4 trousers = 12 outfits).
- **Addition rule**: mutually exclusive choices add.

## Permutations (order matters)
n! = n x (n-1) x ... x 1. Arranging r of n items: **P(n, r) = n!/(n - r)!**. With repeated letters divide by the factorial of each repeat count.

> Worked example: arrangements of LETTER (6 letters, E twice, T twice): 6!/(2! x 2!) = **{math.factorial(6) // 4}**.

## Combinations (order does not matter)
**C(n, r) = n! / (r! (n - r)!)**, and C(n, r) = C(n, n - r).

> Worked example: choosing 4 from 10: C(10, 4) = **{math.comb(10, 4)}**.

## Probability
**P(event) = favourable outcomes / total outcomes.** For independent events multiply; for "either, not both" add.

> Worked example: two dice, sum 7: 6 of 36 outcomes -> **1/6**.

Without replacement the second draw changes: 4 red and 3 blue, both red = 4/7 x 3/6 = **{Fraction(4 * 3, 7 * 6)}**.

## Complement trick
"At least one" = 1 - P(none).

## Common traps
- Using permutations where order does not matter (or the reverse).
- Treating draws without replacement as independent.
""", ['Permutations and Combinations', 'Probability'])

ch('Number Series, Coding and Analogies', 'series-coding', 'INTERMEDIATE',
   'The brain loves patterns, and a test setter hides them in numbers and letters. Learn the short list of patterns they reuse.', 40,
   f"""## Number series: check in this order
1. **Constant difference** (arithmetic): 4, 7, 10, 13 -> +3.
2. **Constant ratio**: 3, 6, 12, 24 -> x2.
3. **Differences that grow**: 1, 2, 4, 7, 11 -> differences 1, 2, 3, 4.
4. **Squares / cubes** (maybe plus or minus a constant): 5, 10, 17, 26 -> n^2 + 1.
5. **Two interleaved series**: 5, 40, 8, 37, 11, 34 -> +3 on the odd places, -3 on the even.

## Coding-decoding
Look for a **uniform letter shift**: if CAT -> DBU, each letter moves one place forward, so DOG -> EPH. Also check reversals, position values (A=1 ... Z=26) and swapped pairs.

## Analogies
Find the relationship first: 3 : 27 :: 4 : ? -> cube, so **{4 ** 3}**.

## Odd one out
Find the property that three share (perfect squares, primes, vowels) and the one that breaks it.

## Alphabet positions
A=1, B=2 ... M=13, N=14 ... Z=26. Letter k places right of position p is p + k.

## Common traps
- Settling on the first pattern that fits two terms; make sure it fits **all** the given terms.
""", ['Number Series', 'Coding-Decoding', 'Analogies', 'Odd One Out', 'Alphabets'])

ch('Directions, Ranking, Calendar and Clocks', 'reasoning-puzzles', 'INTERMEDIATE',
   'You walk 3 km north and 4 km east. How far are you from home? A right triangle quietly answers a "reasoning" question.', 45,
   f"""## Direction sense
Draw it. Mark North up, East right. For perpendicular legs a and b the straight-line distance is sqrt(a^2 + b^2): legs 3 and 4 give **{int(math.hypot(3, 4))} km**. A right turn is clockwise (N -> E -> S -> W); a left turn is anticlockwise.

## Ranking
If a person is p-th from one end and q-th from the other, the line has **p + q - 1** people.

> Worked example: 8th from the left and 12th from the right -> 8 + 12 - 1 = **{8 + 12 - 1}** people.

Rank from the bottom = total - rank from the top + 1.

## Calendar
Days of the week repeat every 7 days, so only the remainder of the day difference mod 7 matters.

> Worked example: if today is Wednesday, 100 days later is 100 mod 7 = {100 % 7} days ahead -> **Friday**.

An ordinary year has 1 odd day (365 = 52 weeks + 1); a leap year has 2. A year is a leap year if divisible by 4, except century years not divisible by 400.

## Clocks
- Minute hand: 6 degrees per minute. Hour hand: 0.5 degrees per minute.
- Angle at h:m = |30h - 5.5m| (take 360 minus it if larger than 180).

> Worked example: at 3:00 -> |90 - 0| = **{abs(30 * 3 - 5.5 * 0):g} degrees**; at 4:30 -> |120 - 165| = **{abs(30 * 4 - 5.5 * 30):g} degrees**.

## Common traps
- Forgetting that the hour hand moves between numbers as the minutes pass.
- Mixing up left/right when the person is already facing south or west: always track the facing direction.
""", ['Direction Sense', 'Ranking', 'Calendar', 'Clocks'])

ch('Verbal Ability: Grammar, Vocabulary and Idioms', 'verbal', 'BEGINNER',
   'Most placement papers have a verbal section where a handful of rules earn most of the marks.', 40,
   """## Subject-verb agreement
- A singular subject takes a singular verb, whatever comes in between: *The teacher, along with her students, **is** going.*
- **Each, every, neither, either, one of** + singular verb: *Each of the players **was** given a medal.*
- Collective nouns acting as one take a singular verb: *The committee **has** decided.*

## Tenses that tests love
- **Present perfect** for an action continuing to now: *She has lived here since 2019.*
- **Past perfect** for an action before another past action: *By the time we reached, the train **had left**.*
- **Subjunctive / unreal conditional**: *If I **were** you, ...*, *She suggested that he **see** a doctor.*

## Prepositions and fixed phrases
good **at**, interested **in**, afraid **of**, depend **on**, look forward **to** + -ing, prefer X **to** Y.

## Vocabulary strategy
1. Read the sentence and predict the meaning before looking at the options.
2. Use word roots: *bene-* (good), *mal-* (bad), *poly-* (many), *anti-* (against).
3. For synonyms/antonyms, check whether the question asks for the **opposite**.
4. Connectors tell you direction: *although, despite, however* signal contrast; *therefore, so* signal result.

## One-word substitutes worth knowing
polyglot (many languages), democracy (rule by the people), atheist (does not believe in God), antidote (counteracts poison), etymology (origin of words).

## Common spelling traps
necessary, accommodation, occurrence, conscientious, definitely, separate.

## Strategy
Eliminate options that are clearly wrong first; read the full sentence with your chosen answer inserted to check it sounds natural.
""", ['Grammar', 'Synonyms', 'Antonyms', 'One-word Substitution', 'Idioms', 'Sentence Completion', 'Spelling'])
