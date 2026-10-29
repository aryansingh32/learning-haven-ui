"""Aptitude question generators. Every numeric answer is computed here, never typed by hand.
Each generator takes an RNG and returns dict(topic, section, difficulty, body, correct, wrong[3], explanation).
"""
import datetime
import math
from fractions import Fraction
from itertools import combinations


def money(n):
    return f'Rs {n:,}'


class Inexact(Exception):
    pass


def ex(num, den):
    """Exact integer division; a non-integer result means this draw would print a wrong answer."""
    if num % den:
        raise Inexact
    return num // den


def q(topic, section, diff, body, correct, wrong, why):
    return dict(topic=topic, section=section, difficulty=diff, body=body, correct=str(correct),
                wrong=[str(w) for w in wrong], explanation=why)


def near(rng, ans, k=3, lo=None, step=None):
    """Plausible wrong integers around ans (never equal to ans, never duplicates)."""
    step = step or max(1, abs(ans) // 10 or 1)
    out = []
    for d in (step, -step, 2 * step, -2 * step, 3 * step, -3 * step, 4 * step):
        v = ans + d
        if v != ans and v not in out and (lo is None or v >= lo):
            out.append(v)
    rng.shuffle(out)
    return out[:k]


# ───────────────────────────── Quantitative ─────────────────────────────
def g_percent_of(rng):
    p = rng.choice([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75])
    base = rng.choice([80, 120, 160, 200, 240, 360, 400, 480, 600, 800, 1200, 2000])
    ans = ex(base * p, 100)
    return q('Percentages', 'Quantitative', 'easy', f'What is {p}% of {base}?', ans,
             near(rng, ans, step=max(2, ans // 10)), f'{p}% of {base} = {p}/100 x {base} = {ans}.')


def g_pct_successive(rng):
    a, b = rng.choice([10, 20, 25, 30, 40, 50]), rng.choice([10, 20, 25, 30, 40])
    net = a - b - a * b / 100
    ans = f'{net:g}%'
    wrong = [f'{a - b:g}%', f'{net + 2:g}%', f'{net - 3:g}%']
    return q('Percentages', 'Quantitative', 'medium',
             f'The price of an item is increased by {a}% and then decreased by {b}%. What is the net change in price? (Positive = increase, negative = decrease.)',
             ans, wrong, f'Net change = {a} - {b} - ({a} x {b})/100 = {net:g}%.')


def g_profit(rng):
    cp = rng.choice([400, 500, 800, 1000, 1200, 1500, 2000, 2400, 3000, 4000])
    pr = rng.choice([10, 15, 20, 25, 30, 40])
    sp = ex(cp * (100 + pr), 100)
    return q('Profit and Loss', 'Quantitative', 'easy',
             f'A shopkeeper buys an article for {money(cp)} and sells it at a profit of {pr}%. What is the selling price?',
             money(sp), [money(sp + cp // 10), money(cp + pr), money(sp - cp // 10)],
             f'SP = CP x (100 + {pr})/100 = {cp} x {100 + pr}/100 = {sp}.')


def g_loss_find_cp(rng):
    sp = rng.choice([720, 900, 1080, 1350, 1800, 2160, 2700, 3600])
    loss = rng.choice([10, 20, 25])
    cp = sp * 100 // (100 - loss)
    if cp * (100 - loss) != sp * 100:
        return g_loss_find_cp(rng)
    return q('Profit and Loss', 'Quantitative', 'medium',
             f'An article is sold for {money(sp)} at a loss of {loss}%. What was its cost price?',
             money(cp), [money(sp + sp * loss // 100), money(cp + 100), money(cp - 100)],
             f'SP = {100 - loss}% of CP, so CP = {sp} x 100/{100 - loss} = {cp}.')


def g_discount(rng):
    mp = rng.choice([1000, 1500, 2000, 2500, 4000, 5000])
    d1, d2 = rng.choice([10, 20, 25]), rng.choice([10, 20])
    price = ex(mp * (100 - d1) * (100 - d2), 10000)
    return q('Profit and Loss', 'Quantitative', 'medium',
             f'The marked price of a jacket is {money(mp)}. Two successive discounts of {d1}% and {d2}% are given. What is the final price?',
             money(price), [money(mp * (100 - d1 - d2) // 100), money(price + 50), money(price - 50)],
             f'Price = {mp} x {100 - d1}/100 x {100 - d2}/100 = {price}. (Not {d1 + d2}% off: discounts apply one after the other.)')


def g_si(rng):
    p = rng.choice([2000, 3000, 5000, 6000, 8000, 10000, 12000])
    r, t = rng.choice([5, 6, 8, 10, 12]), rng.choice([2, 3, 4, 5])
    si = ex(p * r * t, 100)
    return q('Simple and Compound Interest', 'Quantitative', 'easy',
             f'Find the simple interest on {money(p)} at {r}% per annum for {t} years.',
             money(si), [money(si + p // 20), money(si - p // 20), money(si * 2)],
             f'SI = P x R x T / 100 = {p} x {r} x {t} / 100 = {si}.')


def g_ci(rng):
    p = rng.choice([1000, 2000, 4000, 5000, 8000, 10000])
    r = rng.choice([10, 20])
    ci = ex(p * ((100 + r) ** 2 - 10000), 10000)
    si = ex(p * r * 2, 100)
    return q('Simple and Compound Interest', 'Quantitative', 'medium',
             f'What is the compound interest on {money(p)} for 2 years at {r}% per annum, compounded yearly?',
             money(ci), [money(si), money(ci + p // 50), money(ci - p // 50)],
             f'Amount = {p} x ({100 + r}/100)^2 = {p + ci}. CI = {p + ci} - {p} = {ci}.')


def g_ratio_share(rng):
    a, b, c = rng.choice([(2, 3, 5), (1, 2, 3), (3, 4, 5), (2, 5, 3), (1, 3, 4), (4, 5, 6)])
    k = rng.choice([40, 50, 60, 80, 120, 150, 200])
    total = (a + b + c) * k
    who = rng.choice([0, 1, 2])
    share = (a, b, c)[who] * k
    name = 'ABC'[who]
    return q('Ratio and Proportion', 'Quantitative', 'easy',
             f'{money(total)} is divided among A, B and C in the ratio {a}:{b}:{c}. How much does {name} get?',
             money(share), [money(share + k), money(share - k), money(share + 2 * k)],
             f'One part = {total}/{a + b + c} = {k}. {name} gets {(a, b, c)[who]} parts = {share}.')


def g_work(rng):
    x, y, t = rng.choice([(12, 12, 6), (10, 15, 6), (20, 30, 12), (12, 24, 8), (15, 30, 10), (6, 3, 2), (30, 45, 18), (20, 20, 10), (24, 8, 6), (9, 18, 6)])
    return q('Time and Work', 'Quantitative', 'medium',
             f'A can complete a job in {x} days and B can complete it in {y} days. Working together, in how many days will they finish it?',
             f'{t} days', [f'{t + 1} days', f'{t + 2} days', f'{max(1, t - 1)} days'],
             f'Rates add: 1/{x} + 1/{y} = {x + y}/{x * y} per day, so the job takes {x * y}/{x + y} = {t} days.')


def g_work_left(rng):
    x = rng.choice([12, 15, 20, 24, 30])
    d = rng.choice([2, 3, 4, 5])
    left = x - d
    return q('Time and Work', 'Quantitative', 'medium',
             f'A worker can finish a task alone in {x} days. After working for {d} days, he leaves. A second worker, who is equally fast, finishes the rest. How many more days does the second worker need?',
             f'{left} days', [f'{left + 2} days', f'{left - 1} days', f'{d} days'],
             f'In {d} days {d}/{x} of the work is done; the rest ({left}/{x}) needs {left} days at the same pace.')


def g_train(rng):
    v = rng.choice([10, 15, 20, 25, 30])
    t = rng.choice([6, 8, 10, 12, 15])
    kmph = ex(v * 18, 5)
    return q('Speed, Time and Distance', 'Quantitative', 'medium',
             f'A train running at {kmph} km/h crosses a pole in {t} seconds. What is the length of the train?',
             f'{v * t} m', [f'{v * t + 50} m', f'{v * t - 50} m', f'{kmph * t} m'],
             f'{kmph} km/h = {kmph} x 5/18 = {v} m/s. Length = speed x time = {v} x {t} = {v * t} m.')


def g_meet(rng):
    a, b, d = rng.choice([(40, 60, 300), (30, 45, 450), (50, 70, 360), (45, 55, 500), (60, 90, 600)])
    t = d / (a + b)
    ans = f'{t:g} hours'
    return q('Speed, Time and Distance', 'Quantitative', 'medium',
             f'Two cities are {d} km apart. Two cars start towards each other at the same time from the two cities at {a} km/h and {b} km/h. After how long do they meet?',
             ans, [f'{d / abs(a - b):g} hours', f'{t + 0.5:g} hours', f'{max(0.5, t - 0.5):g} hours'],
             f'They close the gap at {a} + {b} = {a + b} km/h, so time = {d}/{a + b} = {t:g} hours.')


def g_boat(rng):
    u, v = rng.choice([(10, 2), (12, 3), (15, 5), (18, 6), (20, 4), (14, 2)])
    d = (u + v) * (u - v) // math.gcd(u + v, u - v) * rng.choice([1, 2])
    down = Fraction(d, u + v)
    up = Fraction(d, u - v)
    total = down + up
    ans = f'{float(total):g} hours'
    return q('Speed, Time and Distance', 'Quantitative', 'hard',
             f'A boat goes {u} km/h in still water and the stream flows at {v} km/h. How long does it take to go {d} km downstream and come back?',
             ans, [f'{float(total) + 1:g} hours', f'{float(2 * Fraction(d, u)):g} hours', f'{float(total) - 0.5:g} hours'],
             f'Downstream speed {u + v}, upstream speed {u - v}. Time = {d}/{u + v} + {d}/{u - v} = {float(total):g} hours.')


def g_average_missing(rng):
    n = rng.choice([4, 5, 6])
    nums = [rng.randint(10, 60) for _ in range(n - 1)]
    avg = rng.randint(25, 50)
    missing = avg * n - sum(nums)
    if missing < 1:
        return g_average_missing(rng)
    return q('Averages', 'Quantitative', 'easy',
             f'The average of {n} numbers is {avg}. Five of them are {", ".join(map(str, nums))}'.replace('Five', {4: 'Three', 5: 'Four', 6: 'Five'}[n]) + '. What is the remaining number?',
             missing, near(rng, missing, step=3, lo=1), f'Total = {avg} x {n} = {avg * n}. Remaining = {avg * n} - {sum(nums)} = {missing}.')


def g_average_new(rng):
    n = rng.choice([5, 8, 10, 12])
    avg = rng.choice([20, 24, 30, 35, 40])
    new = rng.randint(avg + 5, avg + 40)
    new_avg = Fraction(avg * n + new, n + 1)
    if new_avg.denominator != 1:
        return g_average_new(rng)
    return q('Averages', 'Quantitative', 'medium',
             f'The average age of {n} students is {avg} years. A teacher aged {new} joins them. What is the new average age?',
             int(new_avg), near(rng, int(new_avg), step=1, lo=1), f'Total = {avg * n} + {new} = {avg * n + new}. New average = {avg * n + new}/{n + 1} = {int(new_avg)}.')


def g_ages(rng):
    s = rng.randint(24, 60)
    d = rng.choice([4, 6, 8, 10, 12])
    if (s + d) % 2:
        s += 1
    a = (s + d) // 2
    return q('Ages', 'Quantitative', 'easy',
             f'The sum of the ages of Asha and Bina is {s} years, and Asha is {d} years older than Bina. How old is Asha?',
             f'{a} years', [f'{a - d // 2} years', f'{a + 2} years', f'{a - 3} years'],
             f'Asha = (sum + difference)/2 = ({s} + {d})/2 = {a}.')


def g_ages_future(rng):
    son = rng.randint(8, 18)
    k = rng.choice([2, 3, 4])
    n = rng.choice([4, 5, 6, 8])
    ans = k * son + n
    return q('Ages', 'Quantitative', 'medium',
             f'A father is {k} times as old as his son, who is {son} years old now. How old will the father be after {n} years?',
             f'{ans} years', [f'{ans - n} years', f'{ans + son} years', f'{ans + 2} years'],
             f'Father now = {k} x {son} = {k * son}. After {n} years: {k * son} + {n} = {ans}.')


def g_lcm(rng):
    a, b, c = rng.sample([4, 6, 8, 9, 10, 12, 14, 15, 18, 20], 3)
    l = math.lcm(a, b, c)
    return q('Number System', 'Quantitative', 'medium',
             f'What is the smallest number that is exactly divisible by {a}, {b} and {c}?',
             l, near(rng, l, step=max(2, l // 8), lo=1) + [], f'The answer is LCM({a}, {b}, {c}) = {l}.')


def g_hcf(rng):
    g = rng.choice([4, 6, 7, 9, 12, 15])
    a, b = g * rng.choice([2, 3, 4, 5, 6]), g * rng.choice([7, 8, 9, 10, 11])
    h = math.gcd(a, b)
    return q('Number System', 'Quantitative', 'easy', f'Find the HCF (greatest common divisor) of {a} and {b}.',
             h, [x for x in {h * 2, h + 1, max(1, h - 1), h * 3} if x != h][:3], f'Common prime factors give HCF({a}, {b}) = {h}.')


def g_remainder(rng):
    b = rng.choice([2, 3, 4, 7, 8, 9])
    e = rng.randint(10, 60)
    m = rng.choice([5, 6, 7, 10])
    r = pow(b, e, m)
    return q('Number System', 'Quantitative', 'hard', f'What is the remainder when {b}^{e} is divided by {m}?',
             r, [x for x in range(m) if x != r][:3], f'Powers of {b} modulo {m} repeat in a cycle, and {b}^{e} mod {m} = {r}.')


def g_pnc_committee(rng):
    n, r = rng.choice([(6, 3), (7, 3), (8, 2), (8, 3), (9, 4), (10, 3), (10, 2)])
    c = math.comb(n, r)
    return q('Permutations and Combinations', 'Quantitative', 'medium',
             f'In how many ways can a committee of {r} people be chosen from {n} people?',
             c, [math.perm(n, r), c + n, c - 1], f'C({n},{r}) = {n}!/({r}! x {n - r}!) = {c}.')


def g_pnc_arrange(rng):
    w = rng.choice(['LEVEL', 'APPLE', 'BANANA', 'MISSISSIPPI', 'TOOTH', 'BOOK', 'LETTER', 'SEEDS'])
    from collections import Counter
    cnt = Counter(w)
    ways = math.factorial(len(w))
    for v in cnt.values():
        ways //= math.factorial(v)
    return q('Permutations and Combinations', 'Quantitative', 'hard',
             f'How many distinct arrangements can be made from all the letters of the word {w}?',
             ways, [math.factorial(len(w)), ways + len(w), max(1, ways - len(w))],
             f'{len(w)}! divided by the factorials of repeated letters ({", ".join(f"{k}x{v}" for k, v in cnt.items() if v > 1) or "none"}) = {ways}.')


def g_prob_dice(rng):
    s = rng.choice([4, 5, 6, 7, 8, 9, 10])
    fav = sum(1 for a in range(1, 7) for b in range(1, 7) if a + b == s)
    f = Fraction(fav, 36)
    return q('Probability', 'Quantitative', 'medium',
             f'Two fair dice are rolled once. What is the probability that the sum of the numbers is {s}?',
             f'{f.numerator}/{f.denominator}', [f'{f.numerator + 1}/{f.denominator}', f'{f.numerator}/{f.denominator * 2}', f'{f.numerator + 2}/{f.denominator + 1}'],
             f'{fav} of the 36 equally likely outcomes give {s}, so P = {fav}/36 = {f.numerator}/{f.denominator}.')


def g_prob_balls(rng):
    r, b = rng.choice([(4, 3), (5, 3), (6, 4), (5, 5), (7, 3)])
    n = r + b
    f = Fraction(r * (r - 1), n * (n - 1))
    wrong = [Fraction(r * r, n * n), Fraction(r, n), Fraction(r * (r - 1), n * n)]
    return q('Probability', 'Quantitative', 'hard',
             f'A bag has {r} red and {b} blue balls. Two balls are drawn one after another without replacement. What is the probability that both are red?',
             f'{f.numerator}/{f.denominator}', [f'{w.numerator}/{w.denominator}' for w in wrong if w != f][:3],
             f'P = {r}/{n} x {r - 1}/{n - 1} = {f.numerator}/{f.denominator}.')


def g_mixture(rng):
    a, b, x = rng.choice([(3, 2, 50), (2, 1, 60), (4, 1, 100), (3, 1, 80), (5, 3, 80)])
    c = a + b + rng.choice([1, 2, 3])
    milk = Fraction(x * a, a + b)
    if milk.denominator != 1:
        return g_mixture(rng)
    water = x - milk
    newwater = milk * c / a
    add = newwater - water
    if add.denominator != 1 or add <= 0:
        return g_mixture(rng)
    return q('Mixtures', 'Quantitative', 'hard',
             f'A {x}-litre mixture contains milk and water in the ratio {a}:{b}. How many litres of water must be added to make the ratio of milk to water {a}:{c}?',
             f'{int(add)} litres', [f'{int(add) + 5} litres', f'{max(1, int(add) - 5)} litres', f'{int(add) + 10} litres'],
             f'Milk = {int(milk)} L, water = {int(water)} L. For {a}:{c}, water must be {int(milk)} x {c}/{a} = {int(newwater)} L, so add {int(add)} L.')


def g_population(rng):
    p = rng.choice([10000, 20000, 40000, 50000, 80000])
    r = rng.choice([10, 20])
    ans = ex(p * (100 + r) ** 2, 10000)
    return q('Percentages', 'Quantitative', 'medium',
             f'The population of a town is {p:,}. It grows by {r}% every year. What will it be after 2 years?',
             f'{ans:,}', [f'{p * (100 + 2 * r) // 100:,}', f'{ans + p // 20:,}', f'{ans - p // 20:,}'],
             f'{p:,} x {(100 + r)}/100 x {(100 + r)}/100 = {ans:,}.')


def g_two_numbers(rng):
    a, b = rng.randint(30, 90), rng.randint(5, 29)
    return q('Algebra', 'Quantitative', 'easy',
             f'The sum of two numbers is {a + b} and their difference is {a - b}. What is the larger number?',
             a, near(rng, a, step=2, lo=1), f'Larger = (sum + difference)/2 = ({a + b} + {a - b})/2 = {a}.')


def g_pythag(rng):
    a, b, c = rng.choice([(3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25), (20, 21, 29), (6, 8, 10), (9, 12, 15)])
    k = rng.choice([1, 2, 3])
    a, b, c = a * k, b * k, c * k
    return q('Mensuration', 'Quantitative', 'medium',
             f'The diagonal of a rectangle is {c} cm and one side is {a} cm. What is its area?',
             f'{a * b} sq cm', [f'{a * c} sq cm', f'{(a + b) * 2} sq cm', f'{a * b + a} sq cm'],
             f'Other side = sqrt({c}^2 - {a}^2) = {b} cm. Area = {a} x {b} = {a * b} sq cm.')


def g_circle(rng):
    r = rng.choice([7, 14, 21, 28, 35])
    area = ex(22 * r * r, 7)
    return q('Mensuration', 'Quantitative', 'easy', f'Find the area of a circle of radius {r} cm. (Use pi = 22/7.)',
             f'{area} sq cm', [f'{2 * 22 * r // 7} sq cm', f'{area + r} sq cm', f'{area - r} sq cm'],
             f'Area = pi r^2 = 22/7 x {r} x {r} = {area} sq cm.')


QUANT = [g_percent_of, g_pct_successive, g_profit, g_loss_find_cp, g_discount, g_si, g_ci, g_ratio_share, g_work, g_work_left,
         g_train, g_meet, g_boat, g_average_missing, g_average_new, g_ages, g_ages_future, g_lcm, g_hcf, g_remainder,
         g_pnc_committee, g_pnc_arrange, g_prob_dice, g_prob_balls, g_mixture, g_population, g_two_numbers, g_pythag, g_circle]


# ───────────────────────────── Logical reasoning ─────────────────────────────
def g_series_ap(rng):
    a, d = rng.randint(2, 20), rng.randint(2, 9)
    s = [a + i * d for i in range(5)]
    return q('Number Series', 'Logical Reasoning', 'easy', f'Find the next number: {", ".join(map(str, s[:4]))}, ?',
             s[4], near(rng, s[4], step=1), f'The difference is always {d}, so the next term is {s[3]} + {d} = {s[4]}.')


def g_series_gp(rng):
    a, r = rng.randint(1, 5), rng.choice([2, 3])
    s = [a * r ** i for i in range(5)]
    return q('Number Series', 'Logical Reasoning', 'medium', f'Find the next number: {", ".join(map(str, s[:4]))}, ?',
             s[4], [s[4] + r, s[3] + s[2], s[4] - a], f'Each term is multiplied by {r}: {s[3]} x {r} = {s[4]}.')


def g_series_squares(rng):
    k = rng.randint(2, 9)
    add = rng.choice([0, 1, -1, 2])
    s = [(k + i) ** 2 + add for i in range(5)]
    return q('Number Series', 'Logical Reasoning', 'medium', f'Find the next number: {", ".join(map(str, s[:4]))}, ?',
             s[4], near(rng, s[4], step=2), f'The terms are ({k})^2, ({k + 1})^2, ... {"plus " + str(add) if add > 0 else "minus " + str(-add) if add < 0 else ""}; next is ({k + 4})^2{(" + " + str(add)) if add > 0 else (" - " + str(-add)) if add < 0 else ""} = {s[4]}.'.replace('...', '…'))


def g_series_alt(rng):
    a, b = rng.randint(2, 10), rng.randint(2, 6)
    c, d = rng.randint(50, 80), rng.randint(3, 9)
    s = [a, c, a + b, c - d, a + 2 * b, c - 2 * d]
    nxt = a + 3 * b
    return q('Number Series', 'Logical Reasoning', 'hard', f'Find the next number: {", ".join(map(str, s))}, ?',
             nxt, [nxt + b, c - 3 * d, nxt - 1], f'Two interleaved series: one rises by {b} ({a}, {a + b}, {a + 2 * b}, ...) and one falls by {d}. The next term belongs to the rising one: {nxt}.')


def g_series_diff(rng):
    a, d, e = rng.randint(1, 8), rng.randint(1, 4), rng.randint(1, 3)
    s, cur, step = [a], a, d
    for _ in range(4):
        cur += step
        s.append(cur)
        step += e
    return q('Number Series', 'Logical Reasoning', 'medium', f'Find the next number: {", ".join(map(str, s[:5]))}, ?',
             s[5] if len(s) > 5 else cur + step, near(rng, cur + step, step=1),
             f'The differences ({", ".join(str(s[i + 1] - s[i]) for i in range(4))}) increase by {e} each time, so the next difference is {step} and the next term is {cur + step}.')


def shift(word, k):
    return ''.join(chr((ord(c) - 65 + k) % 26 + 65) for c in word)


def g_coding(rng):
    k = rng.choice([1, 2, 3, 4, -1, -2])
    w1, w2 = rng.sample(['CAT', 'DOG', 'SUN', 'MAP', 'PEN', 'BOX', 'FAN', 'JAR', 'KEY', 'LION', 'FISH', 'BIRD', 'TREE'], 2)
    ans = shift(w2, k)
    wrong = [shift(w2, k + 1), shift(w2, k - 1), shift(w2, -k)]
    wrong = [x for x in dict.fromkeys(wrong) if x != ans]
    while len(wrong) < 3:
        wrong.append(shift(w2, k + 2 + len(wrong)))
    d = 'forward' if k > 0 else 'backward'
    return q('Coding-Decoding', 'Logical Reasoning', 'medium',
             f'In a certain code, {w1} is written as {shift(w1, k)}. How is {w2} written in that code?', ans, wrong[:3],
             f'Each letter moves {abs(k)} place(s) {d} in the alphabet: {w1} -> {shift(w1, k)}, so {w2} -> {ans}.')


def g_direction_dist(rng):
    a, b, c = rng.choice([(3, 4, 5), (5, 12, 13), (6, 8, 10), (8, 15, 17), (9, 12, 15)])
    d1, d2 = rng.choice([('north', 'east'), ('south', 'west'), ('north', 'west'), ('south', 'east')])
    return q('Direction Sense', 'Logical Reasoning', 'medium',
             f'Ravi walks {a} km {d1}, then turns and walks {b} km {d2}. How far is he from his starting point?',
             f'{c} km', [f'{a + b} km', f'{abs(b - a)} km', f'{c + 1} km'],
             f'The two legs are at right angles, so distance = sqrt({a}^2 + {b}^2) = {c} km.')


def g_direction_face(rng):
    dirs = ['North', 'East', 'South', 'West']
    start = rng.randrange(4)
    turns = [rng.choice(['left', 'right']) for _ in range(rng.randint(2, 4))]
    cur = start
    for t in turns:
        cur = (cur + (1 if t == 'right' else -1)) % 4
    wrong = [d for d in dirs if d != dirs[cur]]
    return q('Direction Sense', 'Logical Reasoning', 'easy',
             f'A man faces {dirs[start]}. He turns {", then ".join(turns)} (each a 90-degree turn). Which direction is he facing now?',
             dirs[cur], wrong, f'Each right turn moves clockwise (N-E-S-W) and each left turn anticlockwise; the end direction is {dirs[cur]}.')


def g_rank_total(rng):
    p, qq = rng.randint(4, 20), rng.randint(4, 20)
    n = p + qq - 1
    return q('Ranking', 'Logical Reasoning', 'easy',
             f'In a row of students, Meena is {p}th from the left end and {qq}th from the right end. How many students are in the row?',
             n, [n + 1, n - 1, n + 2], f'Total = {p} + {qq} - 1 = {n} (Meena is counted from both ends).')


def g_rank_bottom(rng):
    n = rng.randint(30, 60)
    r = rng.randint(5, 25)
    return q('Ranking', 'Logical Reasoning', 'easy',
             f'Arun ranks {r}th from the top in a class of {n} students. What is his rank from the bottom?',
             n - r + 1, [n - r, n - r + 2, n - r - 1], f'Rank from bottom = {n} - {r} + 1 = {n - r + 1}.')


def g_calendar(rng):
    base = datetime.date(2024, 1, 1) + datetime.timedelta(days=rng.randint(0, 600))
    k = rng.randint(10, 90)
    t = base + datetime.timedelta(days=k)
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    ans = days[t.weekday()]
    wrong = [d for d in days if d != ans]
    rng.shuffle(wrong)
    return q('Calendar', 'Logical Reasoning', 'medium',
             f'{base.day} {base.strftime("%B %Y")} falls on a {days[base.weekday()]}. What day of the week will it be {k} days later?',
             ans, wrong[:3], f'{k} = {k // 7} weeks + {k % 7} days, so the day moves forward by {k % 7}: {days[base.weekday()]} -> {ans}.')


def g_clock(rng):
    h, m = rng.randint(1, 12), rng.choice([0, 10, 15, 20, 30, 40, 45, 50])
    ang = abs(30 * (h % 12) - 5.5 * m)
    ang = min(ang, 360 - ang)
    ans = f'{ang:g} degrees'
    return q('Clocks', 'Logical Reasoning', 'hard',
             f'What is the smaller angle between the hour hand and the minute hand of a clock at {h}:{m:02d}?',
             ans, [f'{ang + 15:g} degrees', f'{abs(ang - 15):g} degrees', f'{360 - ang:g} degrees' if 360 - ang != ang else f'{ang + 30:g} degrees'],
             f'Angle = |30 x {h % 12} - 5.5 x {m}| = {ang:g} degrees (taking the smaller of the two angles).')


def g_odd_squares(rng):
    k = rng.randint(2, 12)
    squares = [(k + i) ** 2 for i in range(3)]
    odd = rng.choice([x for x in range(30, 200) if int(x ** .5) ** 2 != x])
    opts = squares + [odd]
    rng.shuffle(opts)
    return q('Odd One Out', 'Logical Reasoning', 'easy', f'Find the odd one out: {", ".join(map(str, opts))}.',
             odd, squares, f'{", ".join(map(str, squares))} are perfect squares; {odd} is not.')


def g_analogy_power(rng):
    a, b = rng.randint(2, 6), rng.randint(2, 9)
    e = rng.choice([2, 3])
    return q('Analogies', 'Logical Reasoning', 'medium', f'{a} : {a ** e} :: {b} : ?', b ** e, [b ** e + b, b ** (5 - e), b * e],
             f'The second number is the first raised to the power {e}, so {b} -> {b ** e}.')


def g_letter_pos(rng):
    k = rng.randint(2, 7)
    start = rng.randint(0, 25 - k)
    ans = start + k
    cands = [i for i in (ans + 1, ans - 1, start - k, ans + 2, ans - 2, ans - 3) if 0 <= i <= 25 and i != ans]
    return q('Alphabets', 'Logical Reasoning', 'easy', f'Which letter is {k} places to the right of {chr(65 + start)} in the English alphabet?',
             chr(65 + ans), [chr(65 + i) for i in cands[:3]],
             f'{chr(65 + start)} is letter {start + 1}; {start + 1} + {k} = {start + 1 + k}, which is {chr(65 + ans)}.')


REASONING = [g_series_ap, g_series_gp, g_series_squares, g_series_alt, g_series_diff, g_coding, g_direction_dist, g_direction_face,
             g_rank_total, g_rank_bottom, g_calendar, g_clock, g_odd_squares, g_analogy_power, g_letter_pos]
