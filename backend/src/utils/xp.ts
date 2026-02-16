export const XP_VALUES = {
    easy: 10,
    medium: 25,
    hard: 50,
    first_solve: 5, // Bonus for first solve
    streak_bonus: 2, // Per day of streak
} as const;

export const LEVELS = [
    { level: 1, min_xp: 0, max_xp: 100 },
    { level: 2, min_xp: 100, max_xp: 250 },
    { level: 3, min_xp: 250, max_xp: 500 },
    { level: 4, min_xp: 500, max_xp: 850 },
    { level: 5, min_xp: 850, max_xp: 1300 },
    { level: 6, min_xp: 1300, max_xp: 1850 },
    { level: 7, min_xp: 1850, max_xp: 2500 },
    { level: 8, min_xp: 2500, max_xp: 3250 },
    { level: 9, min_xp: 3250, max_xp: 4100 },
    { level: 10, min_xp: 4100, max_xp: 5050 },
    { level: 11, min_xp: 5050, max_xp: 6100 },
    { level: 12, min_xp: 6100, max_xp: 7250 },
    { level: 13, min_xp: 7250, max_xp: 8500 },
    { level: 14, min_xp: 8500, max_xp: 9850 },
    { level: 15, min_xp: 9850, max_xp: Infinity },
];

/**
 * Calculate XP for solving a problem
 */
export function calculateXP(difficulty: 'easy' | 'medium' | 'hard', isFirstSolve: boolean = false): number {
    let xp = XP_VALUES[difficulty];

    if (isFirstSolve) {
        xp += XP_VALUES.first_solve;
    }

    return xp;
}

/**
 * Calculate level from XP
 */
export function calculateLevel(xp: number): number {
    const level = LEVELS.find(l => xp >= l.min_xp && xp < l.max_xp);
    return level?.level || 15;
}

/**
 * Calculate XP needed for next level
 */
export function xpToNextLevel(current_xp: number): { current_level: number; next_level: number; xp_needed: number; progress: number } {
    const current_level = calculateLevel(current_xp);
    const current_level_data = LEVELS.find(l => l.level === current_level);
    const next_level_data = LEVELS.find(l => l.level === current_level + 1);

    if (!current_level_data || !next_level_data) {
        return {
            current_level,
            next_level: current_level,
            xp_needed: 0,
            progress: 100,
        };
    }

    const xp_in_level = current_xp - current_level_data.min_xp;
    const xp_for_level = next_level_data.min_xp - current_level_data.min_xp;
    const progress = Math.floor((xp_in_level / xp_for_level) * 100);

    return {
        current_level,
        next_level: next_level_data.level,
        xp_needed: next_level_data.min_xp - current_xp,
        progress,
    };
}

/**
 * Calculate streak bonus XP
 */
export function calculateStreakBonus(streak_days: number): number {
    return Math.min(streak_days * XP_VALUES.streak_bonus, 50); // Max 50 XP bonus
}
