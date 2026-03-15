export type MissionStep = {
  id: string;
  title: string;
  description: string;
  type: "concept" | "visual" | "practice" | "challenge" | "reflection";
};

export type Mission = {
  id: string;
  order: number;
  title: string;
  concept: string;
  watch: string;
  practiceCount: number;
  challenge: string;
  timeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  completedSteps: number;
  totalSteps: number;
  locked: boolean;
  mentorNote: string;
  realWorld: string[];
  reward: {
    xp: number;
    badge: string;
  };
  steps: MissionStep[];
};

export type Phase = {
  id: string;
  title: string;
  subtitle: string;
  progressPercent: number;
  missionsCompleted: number;
  missionsTotal: number;
  problemsSolved: number;
  currentStreak: number;
  nextGoal: string;
  missions: Mission[];
};

export const phaseOne: Phase = {
  id: "phase-1",
  title: "Programming Foundations",
  subtitle: "Step-by-step missions built for real momentum and clarity.",
  progressPercent: 40,
  missionsCompleted: 4,
  missionsTotal: 10,
  problemsSolved: 32,
  currentStreak: 6,
  nextGoal: "Arrays Mastery",
  missions: [
    {
      id: "intro-to-problem-solving",
      order: 1,
      title: "Mission 1 - Problem Solving Mindset",
      concept: "How to break a problem into small steps",
      watch: "Problem Breakdown (7 min)",
      practiceCount: 4,
      challenge: "Solve \"Sum of Two Numbers\"",
      timeMinutes: 35,
      difficulty: "easy",
      completedSteps: 5,
      totalSteps: 5,
      locked: false,
      mentorNote: "Slow is smooth. Smooth is fast. Focus on clarity before speed.",
      realWorld: ["Debugging", "APIs", "System design"],
      reward: { xp: 40, badge: "Mindset Starter" },
      steps: [
        { id: "concept", title: "Concept", description: "Understand how to read and reframe a problem", type: "concept" },
        { id: "visual", title: "Visualization", description: "Turn the statement into steps", type: "visual" },
        { id: "practice", title: "Practice", description: "Solve 4 warm-up tasks", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Complete the first timed challenge", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Write the steps you followed", type: "reflection" }
      ]
    },
    {
      id: "complexity-basics",
      order: 2,
      title: "Mission 2 - Time & Space Basics",
      concept: "Big-O with real code examples",
      watch: "Complexity in 10 minutes",
      practiceCount: 5,
      challenge: "Analyze 3 loop patterns",
      timeMinutes: 40,
      difficulty: "easy",
      completedSteps: 5,
      totalSteps: 5,
      locked: false,
      mentorNote: "If you can predict growth, you can design better solutions.",
      realWorld: ["Mobile battery", "Query speed", "Cost control"],
      reward: { xp: 45, badge: "Complexity Rookie" },
      steps: [
        { id: "concept", title: "Concept", description: "Learn the meaning of O(1), O(n), O(n^2)", type: "concept" },
        { id: "visual", title: "Visualization", description: "Plot growth with small inputs", type: "visual" },
        { id: "practice", title: "Practice", description: "Estimate 5 code snippets", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Pick best approach for 3 cases", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Write why Big-O matters", type: "reflection" }
      ]
    },
    {
      id: "arrays-bootcamp",
      order: 3,
      title: "Mission 3 - Arrays Bootcamp",
      concept: "How arrays store data in memory",
      watch: "Arrays Explained (8 min)",
      practiceCount: 5,
      challenge: "Solve \"Second Largest Element\"",
      timeMinutes: 45,
      difficulty: "easy",
      completedSteps: 3,
      totalSteps: 5,
      locked: false,
      mentorNote: "Arrays are the backbone of DSA. Master them and 30% of problems get easier.",
      realWorld: ["Databases", "Game engines", "Memory buffers", "Network packets"],
      reward: { xp: 50, badge: "Arrays Beginner" },
      steps: [
        { id: "concept", title: "Concept", description: "Understand array layout and indexing", type: "concept" },
        { id: "visual", title: "Visualization", description: "Use an array pointer visualizer", type: "visual" },
        { id: "practice", title: "Practice", description: "Solve 3 array warmups", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Second Largest Element", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Explain traversal in 2 sentences", type: "reflection" }
      ]
    },
    {
      id: "strings-and-patterns",
      order: 4,
      title: "Mission 4 - Strings & Patterns",
      concept: "Matching, searching, and sliding windows",
      watch: "Strings in Interviews (9 min)",
      practiceCount: 5,
      challenge: "Longest Substring Without Repeat",
      timeMinutes: 50,
      difficulty: "easy",
      completedSteps: 2,
      totalSteps: 5,
      locked: false,
      mentorNote: "Strings are everywhere. Make them your strength.",
      realWorld: ["Search", "Logs", "Chat moderation"],
      reward: { xp: 55, badge: "String Runner" },
      steps: [
        { id: "concept", title: "Concept", description: "Core string patterns", type: "concept" },
        { id: "visual", title: "Visualization", description: "Sliding window walkthrough", type: "visual" },
        { id: "practice", title: "Practice", description: "Solve 5 string tasks", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Longest substring challenge", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Write your window rules", type: "reflection" }
      ]
    },
    {
      id: "patterns-easy",
      order: 5,
      title: "Mission 5 - Pattern Recognition",
      concept: "Common loops, nested logic, and visuals",
      watch: "Patterns Made Simple",
      practiceCount: 6,
      challenge: "Print the pyramid pattern",
      timeMinutes: 45,
      difficulty: "easy",
      completedSteps: 0,
      totalSteps: 5,
      locked: true,
      mentorNote: "Patterns train your logic flow and confidence.",
      realWorld: ["UI grids", "Reports", "Print formats"],
      reward: { xp: 45, badge: "Pattern Builder" },
      steps: [
        { id: "concept", title: "Concept", description: "Learn core pattern families", type: "concept" },
        { id: "visual", title: "Visualization", description: "See pattern layers build", type: "visual" },
        { id: "practice", title: "Practice", description: "Solve 6 pattern tasks", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Triangle and pyramid mastery", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Write one insight", type: "reflection" }
      ]
    },
    {
      id: "two-pointer",
      order: 6,
      title: "Mission 6 - Two Pointer Training",
      concept: "Shrink search space with two pointers",
      watch: "Two Pointer Basics",
      practiceCount: 5,
      challenge: "Pair Sum on sorted array",
      timeMinutes: 45,
      difficulty: "medium",
      completedSteps: 0,
      totalSteps: 5,
      locked: true,
      mentorNote: "Two pointers = faster decisions.",
      realWorld: ["Streaming", "Sorting", "Allocators"],
      reward: { xp: 60, badge: "Pointer Pilot" },
      steps: [
        { id: "concept", title: "Concept", description: "Understand pointer movement", type: "concept" },
        { id: "visual", title: "Visualization", description: "Pointer dance animation", type: "visual" },
        { id: "practice", title: "Practice", description: "Solve 5 two-pointer tasks", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Pair sum challenge", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Explain why it works", type: "reflection" }
      ]
    },
    {
      id: "sliding-window",
      order: 7,
      title: "Mission 7 - Sliding Window",
      concept: "Find the best window with speed",
      watch: "Sliding Window Starter",
      practiceCount: 6,
      challenge: "Max Sum Subarray",
      timeMinutes: 50,
      difficulty: "medium",
      completedSteps: 0,
      totalSteps: 5,
      locked: true,
      mentorNote: "This trick unlocks many interview wins.",
      realWorld: ["Analytics", "Monitoring", "Batch processing"],
      reward: { xp: 65, badge: "Window Rider" },
      steps: [
        { id: "concept", title: "Concept", description: "Window rules", type: "concept" },
        { id: "visual", title: "Visualization", description: "Move the window", type: "visual" },
        { id: "practice", title: "Practice", description: "Solve 6 window tasks", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Max sum subarray", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Explain the invariant", type: "reflection" }
      ]
    },
    {
      id: "recursion-core",
      order: 8,
      title: "Mission 8 - Recursion Core",
      concept: "Solve problems by reducing size",
      watch: "Recursion in 12 minutes",
      practiceCount: 5,
      challenge: "Climb Stairs",
      timeMinutes: 55,
      difficulty: "medium",
      completedSteps: 0,
      totalSteps: 5,
      locked: true,
      mentorNote: "Think in layers. One call at a time.",
      realWorld: ["File systems", "Parsing", "Tree data"],
      reward: { xp: 70, badge: "Recursion Starter" },
      steps: [
        { id: "concept", title: "Concept", description: "Base case and recursion step", type: "concept" },
        { id: "visual", title: "Visualization", description: "Call stack walkthrough", type: "visual" },
        { id: "practice", title: "Practice", description: "Solve 5 recursion tasks", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Climb stairs challenge", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Explain stack flow", type: "reflection" }
      ]
    },
    {
      id: "searching",
      order: 9,
      title: "Mission 9 - Searching Basics",
      concept: "Linear and binary search",
      watch: "Search Algorithms",
      practiceCount: 4,
      challenge: "Binary Search in Sorted Array",
      timeMinutes: 40,
      difficulty: "medium",
      completedSteps: 0,
      totalSteps: 5,
      locked: true,
      mentorNote: "Searching is the base of optimization.",
      realWorld: ["Databases", "Autocomplete", "APIs"],
      reward: { xp: 60, badge: "Search Scout" },
      steps: [
        { id: "concept", title: "Concept", description: "Linear vs binary search", type: "concept" },
        { id: "visual", title: "Visualization", description: "Binary search animation", type: "visual" },
        { id: "practice", title: "Practice", description: "Solve 4 search tasks", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Binary search challenge", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Write the invariant", type: "reflection" }
      ]
    },
    {
      id: "sorting",
      order: 10,
      title: "Mission 10 - Sorting Foundations",
      concept: "Bubble, selection, and insertion",
      watch: "Sorting for Beginners",
      practiceCount: 5,
      challenge: "Sort an array by parity",
      timeMinutes: 50,
      difficulty: "medium",
      completedSteps: 0,
      totalSteps: 5,
      locked: true,
      mentorNote: "Sorting teaches algorithm flow.",
      realWorld: ["Leaderboards", "Catalogs", "Scheduling"],
      reward: { xp: 70, badge: "Sorting Starter" },
      steps: [
        { id: "concept", title: "Concept", description: "Sorting basics", type: "concept" },
        { id: "visual", title: "Visualization", description: "Sorting animation", type: "visual" },
        { id: "practice", title: "Practice", description: "Solve 5 sorting tasks", type: "practice" },
        { id: "challenge", title: "Challenge", description: "Parity sort challenge", type: "challenge" },
        { id: "reflection", title: "Reflection", description: "Write the tradeoff", type: "reflection" }
      ]
    }
  ]
};

export const getMissionById = (missionId: string) =>
  phaseOne.missions.find((mission) => mission.id === missionId);

export const getNextMission = (missionId: string) => {
  const index = phaseOne.missions.findIndex((mission) => mission.id === missionId);
  if (index === -1) return phaseOne.missions[0];
  return phaseOne.missions[index + 1] || null;
};
