export type StepType = 'story_hook' | 'video' | 'cheatsheet' | 'practice' | 'quiz' | 'task' | 'complete';

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type PracticeProblem = {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  link?: string;
  solved: boolean;
};

export type ChapterStep = {
  id: string;
  type: StepType;
  title: string;
  // Step-specific content
  storyContent?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoDuration?: string;
  videoNote?: string;
  cheatsheetContent?: string[];
  practiceProblems?: PracticeProblem[];
  quizQuestions?: QuizQuestion[];
  taskStatement?: string;
  taskSampleInput?: string;
  taskSampleOutput?: string;
};

export type Mission = {
  id: string;
  order: number;
  title: string;
  concept: string;
  icon: string;
  storyIntro: string;
  watch: string;
  practiceCount: number;
  challenge: string;
  timeMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  completedSteps: number;
  totalSteps: number;
  currentStep: number;
  locked: boolean;
  mentorNote: string;
  realWorld: string[];
  reward: {
    xp: number;
    badge: string;
  };
  steps: ChapterStep[];
};

export type Phase = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  progressPercent: number;
  missionsCompleted: number;
  missionsTotal: number;
  problemsSolved: number;
  currentStreak: number;
  nextGoal: string;
  missions: Mission[];
};

export const phaseOne: Phase = {
  id: 'phase-1',
  title: 'Programming Foundations',
  subtitle: 'Step-by-step missions built for real momentum and clarity.',
  description: 'Build your programming fundamentals from zero. Master arrays, strings, patterns, and core problem-solving before moving to advanced DSA.',
  progressPercent: 20,
  missionsCompleted: 2,
  missionsTotal: 10,
  problemsSolved: 32,
  currentStreak: 6,
  nextGoal: 'Arrays Mastery',
  missions: [
    {
      id: 'intro-to-problem-solving',
      order: 1,
      title: 'Problem Solving Mindset',
      concept: 'How to break a problem into small steps',
      icon: 'Brain',
      storyIntro: 'Every great programmer started exactly where you are right now — staring at a problem and thinking "I have no idea where to start." But here\'s the secret: breaking problems into tiny steps is a learnable skill, and once you get it, nothing feels impossible anymore.',
      watch: 'Problem Breakdown (7 min)',
      practiceCount: 4,
      challenge: 'Solve "Sum of Two Numbers"',
      timeMinutes: 35,
      difficulty: 'easy',
      completedSteps: 7,
      totalSteps: 7,
      currentStep: 7,
      locked: false,
      mentorNote: 'Slow is smooth. Smooth is fast. Focus on clarity before speed.',
      realWorld: ['Debugging', 'APIs', 'System Design'],
      reward: { xp: 40, badge: 'Mindset Starter' },
      steps: [
        {
          id: 'step-1-story',
          type: 'story_hook',
          title: 'Story Hook',
          storyContent: 'Imagine you\'re given a puzzle with 1000 pieces scattered on a table. Do you start randomly? No. You find the corners first, then the edges, then fill in the middle. Programming works exactly the same way. Today, you\'ll learn the art of breaking any problem into small, solvable pieces.',
        },
        {
          id: 'step-2-video',
          type: 'video',
          title: 'Curated Video',
          videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          videoTitle: 'Problem Solving for Beginners',
          videoDuration: '7 min',
          videoNote: 'Pay attention to how the instructor reads the problem statement 3 times before writing any code.',
        },
        {
          id: 'step-3-cheatsheet',
          type: 'cheatsheet',
          title: 'Cheatsheet',
          cheatsheetContent: [
            '**Step 1:** Read the problem statement completely. Don\'t skim.',
            '**Step 2:** Identify inputs and outputs clearly.',
            '**Step 3:** Think of the simplest possible case first.',
            '**Step 4:** Write pseudocode before real code.',
            '**Step 5:** Test with small examples manually.',
            '💡 **Memory Trick:** RITSW — Read, Identify, Think, Sketch, Write',
          ],
        },
        {
          id: 'step-4-practice',
          type: 'practice',
          title: 'Practice Problems',
          practiceProblems: [
            { id: 'ps-1', name: 'Sum of Two Numbers', difficulty: 'Easy', description: 'Given two integers, return their sum', solved: true },
            { id: 'ps-2', name: 'Swap Two Variables', difficulty: 'Easy', description: 'Swap values without a temp variable', solved: true },
            { id: 'ps-3', name: 'Check Even/Odd', difficulty: 'Easy', description: 'Determine if a number is even or odd', solved: true },
            { id: 'ps-4', name: 'Find Maximum of Three', difficulty: 'Easy', description: 'Return the largest of three numbers', solved: false },
          ],
        },
        {
          id: 'step-5-quiz',
          type: 'quiz',
          title: 'Mini Quiz',
          quizQuestions: [
            {
              question: 'What should you do FIRST when given a coding problem?',
              options: ['Start coding immediately', 'Read the problem completely', 'Look for YouTube solutions', 'Copy from Stack Overflow'],
              correctIndex: 1,
              explanation: 'Always read the problem fully before writing any code. Understanding the problem is 50% of solving it.',
            },
            {
              question: 'What is pseudocode?',
              options: ['Code written in Python', 'A fake programming language', 'A plain-English outline of your logic', 'Comments in your code'],
              correctIndex: 2,
              explanation: 'Pseudocode is writing your solution logic in plain English before translating it to actual code.',
            },
            {
              question: 'Why test with small examples first?',
              options: ['It\'s easier to cheat', 'You can verify your logic manually', 'Computers can\'t handle big inputs', 'Your teacher told you to'],
              correctIndex: 1,
              explanation: 'Small examples let you trace through your logic by hand and catch errors early.',
            },
          ],
        },
        {
          id: 'step-6-task',
          type: 'task',
          title: 'The Task',
          taskStatement: 'Write a function that takes an array of integers and returns the sum of all elements. Then, modify it to return the sum of only positive elements.',
          taskSampleInput: '[3, -1, 5, -2, 8]',
          taskSampleOutput: 'Total: 13, Positive Only: 16',
        },
        {
          id: 'step-7-complete',
          type: 'complete',
          title: 'Complete Chapter',
        },
      ],
    },
    {
      id: 'complexity-basics',
      order: 2,
      title: 'Time & Space Basics',
      concept: 'Big-O with real code examples',
      icon: 'Timer',
      storyIntro: 'Your code works. Great. But does it work FAST? When your app has 10 users, nobody notices. When it has 10 million, slow code crashes everything. Big-O notation is how engineers predict if their code will survive at scale.',
      watch: 'Complexity in 10 minutes',
      practiceCount: 5,
      challenge: 'Analyze 3 loop patterns',
      timeMinutes: 40,
      difficulty: 'easy',
      completedSteps: 7,
      totalSteps: 7,
      currentStep: 7,
      locked: false,
      mentorNote: 'If you can predict growth, you can design better solutions.',
      realWorld: ['Mobile Battery', 'Query Speed', 'Cost Control'],
      reward: { xp: 45, badge: 'Complexity Rookie' },
      steps: [
        { id: 'step-1-story', type: 'story_hook', title: 'Story Hook', storyContent: 'Netflix serves 200 million users. If their search algorithm was O(n²) instead of O(log n), searching for a movie would take 15 minutes instead of 0.5 seconds. That\'s the difference Big-O makes in real life.' },
        { id: 'step-2-video', type: 'video', title: 'Curated Video', videoUrl: 'https://youtube.com/embed/example', videoTitle: 'Big-O in 10 Minutes', videoDuration: '10 min', videoNote: 'Watch how each growth pattern is visualized on the graph.' },
        { id: 'step-3-cheatsheet', type: 'cheatsheet', title: 'Cheatsheet', cheatsheetContent: ['**O(1)** — Constant: Accessing array by index', '**O(log n)** — Logarithmic: Binary search', '**O(n)** — Linear: Single loop through array', '**O(n log n)** — Linearithmic: Merge sort', '**O(n²)** — Quadratic: Nested loops', '💡 **Rule of thumb:** If n = 10⁶, O(n²) = 10¹² operations ≈ 15+ minutes'] },
        { id: 'step-4-practice', type: 'practice', title: 'Practice Problems', practiceProblems: [
          { id: 'cx-1', name: 'Identify the Big-O', difficulty: 'Easy', description: 'Given 5 code snippets, identify their time complexity', solved: true },
          { id: 'cx-2', name: 'Optimize the Loop', difficulty: 'Easy', description: 'Convert an O(n²) solution to O(n)', solved: true },
          { id: 'cx-3', name: 'Space Complexity', difficulty: 'Medium', description: 'Calculate space used by recursive calls', solved: false },
        ] },
        { id: 'step-5-quiz', type: 'quiz', title: 'Mini Quiz', quizQuestions: [
          { question: 'What is the time complexity of accessing arr[5]?', options: ['O(n)', 'O(1)', 'O(log n)', 'O(n²)'], correctIndex: 1, explanation: 'Array access by index is O(1) — constant time regardless of array size.' },
          { question: 'A nested loop over the same array of size n is:', options: ['O(n)', 'O(2n)', 'O(n²)', 'O(n log n)'], correctIndex: 2, explanation: 'Two nested loops each iterating n times gives n × n = O(n²).' },
          { question: 'Binary search has which complexity?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], correctIndex: 1, explanation: 'Binary search halves the search space each time, giving O(log n).' },
        ] },
        { id: 'step-6-task', type: 'task', title: 'The Task', taskStatement: 'Given a sorted array, find if a target number exists. First solve it with linear search (O(n)), then optimize to binary search (O(log n)).', taskSampleInput: 'arr = [1, 3, 5, 7, 9, 11], target = 7', taskSampleOutput: 'Found at index 3' },
        { id: 'step-7-complete', type: 'complete', title: 'Complete Chapter' },
      ],
    },
    {
      id: 'arrays-bootcamp',
      order: 3,
      title: 'Arrays Bootcamp',
      concept: 'How arrays store data in memory',
      icon: 'Grid',
      storyIntro: 'Imagine you\'re building a search engine. Millions of pages need to be stored in memory efficiently. Arrays are the simplest structure that makes this possible — and understanding them unlocks 30% of all DSA problems.',
      watch: 'Arrays Explained (8 min)',
      practiceCount: 5,
      challenge: 'Solve "Second Largest Element"',
      timeMinutes: 45,
      difficulty: 'easy',
      completedSteps: 3,
      totalSteps: 7,
      currentStep: 4,
      locked: false,
      mentorNote: 'Arrays are the backbone of DSA. Master them and 30% of problems get easier.',
      realWorld: ['Databases', 'Game Engines', 'Memory Systems', 'Network Packets'],
      reward: { xp: 50, badge: 'Arrays Beginner' },
      steps: [
        { id: 'step-1-story', type: 'story_hook', title: 'Story Hook', storyContent: 'When you scroll through Instagram, each post in your feed is stored in an array. When Spotify plays your playlist, each song is an element in an array. Arrays are literally everywhere in the software you use daily.' },
        { id: 'step-2-video', type: 'video', title: 'Curated Video', videoUrl: 'https://youtube.com/embed/example2', videoTitle: 'Arrays Explained Visually', videoDuration: '8 min', videoNote: 'Pay attention to how the pointer moves through the array — this is the basis of traversal.' },
        { id: 'step-3-cheatsheet', type: 'cheatsheet', title: 'Cheatsheet', cheatsheetContent: ['**Declaration:** `int[] arr = new int[5];`', '**Access:** `arr[0]` → first element (0-indexed!)', '**Length:** `arr.length` gives the size', '**Traversal:** `for(int i=0; i<arr.length; i++)`', '**Key Point:** Arrays have fixed size in most languages', '💡 **Memory:** Elements are stored in contiguous memory locations'] },
        { id: 'step-4-practice', type: 'practice', title: 'Practice Problems', practiceProblems: [
          { id: 'ar-1', name: 'Find Maximum', difficulty: 'Easy', description: 'Find the largest element in an array', solved: true },
          { id: 'ar-2', name: 'Reverse Array', difficulty: 'Easy', description: 'Reverse the array in-place', solved: true },
          { id: 'ar-3', name: 'Second Largest', difficulty: 'Easy', description: 'Find the second largest element', solved: false },
          { id: 'ar-4', name: 'Rotate Array', difficulty: 'Medium', description: 'Rotate array by k positions', solved: false },
        ] },
        { id: 'step-5-quiz', type: 'quiz', title: 'Mini Quiz', quizQuestions: [
          { question: 'What is the index of the first element in an array?', options: ['1', '0', '-1', 'Depends on language'], correctIndex: 1, explanation: 'In most programming languages (Java, C++, Python), arrays are 0-indexed.' },
          { question: 'What happens when you access arr[arr.length]?', options: ['Returns the last element', 'Returns null', 'ArrayIndexOutOfBoundsException', 'Returns 0'], correctIndex: 2, explanation: 'The valid indices are 0 to arr.length-1. Accessing arr.length throws an error.' },
          { question: 'Time complexity of accessing arr[i] is:', options: ['O(n)', 'O(1)', 'O(log n)', 'O(n²)'], correctIndex: 1, explanation: 'Direct array access is O(1) because elements are stored contiguously in memory.' },
        ] },
        { id: 'step-6-task', type: 'task', title: 'The Task', taskStatement: 'Write a function that finds the second largest element in an array without sorting. Handle edge cases like duplicate maximums.', taskSampleInput: '[12, 35, 1, 10, 34, 1]', taskSampleOutput: '34' },
        { id: 'step-7-complete', type: 'complete', title: 'Complete Chapter' },
      ],
    },
    {
      id: 'strings-and-patterns',
      order: 4,
      title: 'Strings & Patterns',
      concept: 'Matching, searching, and sliding windows',
      icon: 'Type',
      storyIntro: 'Every search bar, every chat filter, every password validator uses string manipulation. When you type in Google, string algorithms decide which results to show you in milliseconds.',
      watch: 'Strings in Interviews (9 min)',
      practiceCount: 5,
      challenge: 'Longest Substring Without Repeat',
      timeMinutes: 50,
      difficulty: 'easy',
      completedSteps: 0,
      totalSteps: 7,
      currentStep: 1,
      locked: false,
      mentorNote: 'Strings are everywhere. Make them your strength.',
      realWorld: ['Search', 'Logs', 'Chat Moderation'],
      reward: { xp: 55, badge: 'String Runner' },
      steps: [
        { id: 'step-1-story', type: 'story_hook', title: 'Story Hook', storyContent: 'WhatsApp processes over 100 billion messages daily. Behind every emoji detection, link preview, and spam filter is a string algorithm working in microseconds.' },
        { id: 'step-2-video', type: 'video', title: 'Curated Video', videoUrl: 'https://youtube.com/embed/example3', videoTitle: 'String Manipulation Masterclass', videoDuration: '9 min', videoNote: 'Focus on the two-pointer approach for palindrome checking.' },
        { id: 'step-3-cheatsheet', type: 'cheatsheet', title: 'Cheatsheet', cheatsheetContent: ['**Immutable:** Strings can\'t be modified in-place in most languages', '**StringBuilder:** Use for efficient string building in loops', '**Common operations:** charAt(), substring(), indexOf()', '**Pattern:** Two pointers for palindrome checking', '💡 **Interview tip:** Always ask if the string is ASCII or Unicode'] },
        { id: 'step-4-practice', type: 'practice', title: 'Practice Problems', practiceProblems: [
          { id: 'st-1', name: 'Reverse a String', difficulty: 'Easy', description: 'Reverse the given string', solved: false },
          { id: 'st-2', name: 'Check Palindrome', difficulty: 'Easy', description: 'Check if a string reads the same forwards and backwards', solved: false },
          { id: 'st-3', name: 'Anagram Check', difficulty: 'Medium', description: 'Check if two strings are anagrams', solved: false },
          { id: 'st-4', name: 'Longest Substring', difficulty: 'Medium', description: 'Find longest substring without repeating characters', solved: false },
        ] },
        { id: 'step-5-quiz', type: 'quiz', title: 'Mini Quiz', quizQuestions: [
          { question: 'Are strings mutable in Java?', options: ['Yes', 'No', 'Sometimes', 'Only in arrays'], correctIndex: 1, explanation: 'Strings in Java are immutable. Once created, they cannot be changed.' },
          { question: 'Best data structure for checking anagrams?', options: ['Stack', 'HashMap/frequency array', 'Queue', 'Linked List'], correctIndex: 1, explanation: 'A frequency array/HashMap lets you compare character counts efficiently.' },
          { question: 'Time complexity of string concatenation in a loop?', options: ['O(n)', 'O(n²)', 'O(1)', 'O(log n)'], correctIndex: 1, explanation: 'Each concatenation creates a new string, so n concatenations is O(n²). Use StringBuilder instead.' },
        ] },
        { id: 'step-6-task', type: 'task', title: 'The Task', taskStatement: 'Implement a function that checks whether two strings are anagrams of each other. Use a frequency counting approach rather than sorting.', taskSampleInput: '"listen", "silent"', taskSampleOutput: 'true' },
        { id: 'step-7-complete', type: 'complete', title: 'Complete Chapter' },
      ],
    },
    {
      id: 'patterns-easy',
      order: 5,
      title: 'Pattern Recognition',
      concept: 'Common loops, nested logic, and visuals',
      icon: 'LayoutGrid',
      storyIntro: 'Before you solve complex problems, you need to master the art of controlled loops. Pattern printing is how every top coder trains their brain to think in rows, columns, and conditions.',
      watch: 'Patterns Made Simple',
      practiceCount: 6,
      challenge: 'Print the pyramid pattern',
      timeMinutes: 45,
      difficulty: 'easy',
      completedSteps: 0,
      totalSteps: 7,
      currentStep: 0,
      locked: true,
      mentorNote: 'Patterns train your logic flow and confidence.',
      realWorld: ['UI Grids', 'Reports', 'Print Formats'],
      reward: { xp: 45, badge: 'Pattern Builder' },
      steps: [
        { id: 'step-1-story', type: 'story_hook', title: 'Story Hook', storyContent: 'Patterns teach you to think in structured loops.' },
        { id: 'step-2-video', type: 'video', title: 'Curated Video', videoUrl: '', videoTitle: 'Patterns Made Easy', videoDuration: '8 min', videoNote: 'Watch how nested loops build layer by layer.' },
        { id: 'step-3-cheatsheet', type: 'cheatsheet', title: 'Cheatsheet', cheatsheetContent: ['Outer loop = rows', 'Inner loop = columns', 'Use conditions to decide what to print'] },
        { id: 'step-4-practice', type: 'practice', title: 'Practice Problems', practiceProblems: [] },
        { id: 'step-5-quiz', type: 'quiz', title: 'Mini Quiz', quizQuestions: [] },
        { id: 'step-6-task', type: 'task', title: 'The Task', taskStatement: 'Print a pyramid pattern of height n.', taskSampleInput: 'n = 5', taskSampleOutput: '    *\n   ***\n  *****\n *******\n*********' },
        { id: 'step-7-complete', type: 'complete', title: 'Complete Chapter' },
      ],
    },
    {
      id: 'two-pointer',
      order: 6,
      title: 'Two Pointer Training',
      concept: 'Shrink search space with two pointers',
      icon: 'GitMerge',
      storyIntro: 'What if you could solve problems twice as fast by using two fingers to scan instead of one? That\'s exactly what the two pointer technique does.',
      watch: 'Two Pointer Basics',
      practiceCount: 5,
      challenge: 'Pair Sum on sorted array',
      timeMinutes: 45,
      difficulty: 'medium',
      completedSteps: 0,
      totalSteps: 7,
      currentStep: 0,
      locked: true,
      mentorNote: 'Two pointers = faster decisions.',
      realWorld: ['Streaming', 'Sorting', 'Allocators'],
      reward: { xp: 60, badge: 'Pointer Pilot' },
      steps: [
        { id: 'step-1-story', type: 'story_hook', title: 'Story Hook', storyContent: 'Two pointers let you shrink the search space.' },
        { id: 'step-2-video', type: 'video', title: 'Curated Video', videoUrl: '', videoTitle: 'Two Pointer Explained', videoDuration: '10 min', videoNote: 'Watch how pointers converge.' },
        { id: 'step-3-cheatsheet', type: 'cheatsheet', title: 'Cheatsheet', cheatsheetContent: ['Start: left=0, right=n-1', 'Move based on condition', 'Works on sorted arrays'] },
        { id: 'step-4-practice', type: 'practice', title: 'Practice Problems', practiceProblems: [] },
        { id: 'step-5-quiz', type: 'quiz', title: 'Mini Quiz', quizQuestions: [] },
        { id: 'step-6-task', type: 'task', title: 'The Task', taskStatement: 'Find pair with given sum in sorted array.', taskSampleInput: '[1,2,3,4,5], target=6', taskSampleOutput: '(1,4) and (2,3)' },
        { id: 'step-7-complete', type: 'complete', title: 'Complete Chapter' },
      ],
    },
    {
      id: 'sliding-window',
      order: 7,
      title: 'Sliding Window',
      concept: 'Find the best window with speed',
      icon: 'Maximize2',
      storyIntro: 'YouTube analytics uses sliding windows to calculate "views in the last 7 days." This single technique unlocks dozens of interview questions.',
      watch: 'Sliding Window Starter',
      practiceCount: 6,
      challenge: 'Max Sum Subarray',
      timeMinutes: 50,
      difficulty: 'medium',
      completedSteps: 0,
      totalSteps: 7,
      currentStep: 0,
      locked: true,
      mentorNote: 'This trick unlocks many interview wins.',
      realWorld: ['Analytics', 'Monitoring', 'Batch Processing'],
      reward: { xp: 65, badge: 'Window Rider' },
      steps: [
        { id: 'step-1-story', type: 'story_hook', title: 'Story Hook', storyContent: 'Sliding windows let you process ranges efficiently.' },
        { id: 'step-2-video', type: 'video', title: 'Curated Video', videoUrl: '', videoTitle: 'Sliding Window', videoDuration: '12 min', videoNote: 'Focus on the expand-shrink pattern.' },
        { id: 'step-3-cheatsheet', type: 'cheatsheet', title: 'Cheatsheet', cheatsheetContent: ['Fixed window vs variable window', 'Expand right, shrink left', 'Track window state with a variable'] },
        { id: 'step-4-practice', type: 'practice', title: 'Practice Problems', practiceProblems: [] },
        { id: 'step-5-quiz', type: 'quiz', title: 'Mini Quiz', quizQuestions: [] },
        { id: 'step-6-task', type: 'task', title: 'The Task', taskStatement: 'Find maximum sum subarray of size k.', taskSampleInput: '[2,1,5,1,3,2], k=3', taskSampleOutput: '9' },
        { id: 'step-7-complete', type: 'complete', title: 'Complete Chapter' },
      ],
    },
    {
      id: 'recursion-core',
      order: 8,
      title: 'Recursion Core',
      concept: 'Solve problems by reducing size',
      icon: 'RefreshCw',
      storyIntro: 'Your file system is recursive — folders inside folders. To truly think like a programmer, you need to think recursively.',
      watch: 'Recursion in 12 minutes',
      practiceCount: 5,
      challenge: 'Climb Stairs',
      timeMinutes: 55,
      difficulty: 'medium',
      completedSteps: 0,
      totalSteps: 7,
      currentStep: 0,
      locked: true,
      mentorNote: 'Think in layers. One call at a time.',
      realWorld: ['File Systems', 'Parsing', 'Tree Data'],
      reward: { xp: 70, badge: 'Recursion Starter' },
      steps: [
        { id: 'step-1-story', type: 'story_hook', title: 'Story Hook', storyContent: 'Recursion is the art of solving big problems by solving smaller versions of the same problem.' },
        { id: 'step-2-video', type: 'video', title: 'Curated Video', videoUrl: '', videoTitle: 'Recursion Made Simple', videoDuration: '12 min', videoNote: 'Trace the call stack on paper as you watch.' },
        { id: 'step-3-cheatsheet', type: 'cheatsheet', title: 'Cheatsheet', cheatsheetContent: ['Every recursion needs a base case', 'Each call reduces the problem', 'Stack overflow = forgot base case'] },
        { id: 'step-4-practice', type: 'practice', title: 'Practice Problems', practiceProblems: [] },
        { id: 'step-5-quiz', type: 'quiz', title: 'Mini Quiz', quizQuestions: [] },
        { id: 'step-6-task', type: 'task', title: 'The Task', taskStatement: 'Count the number of ways to climb n stairs, taking 1 or 2 steps at a time.', taskSampleInput: 'n = 4', taskSampleOutput: '5' },
        { id: 'step-7-complete', type: 'complete', title: 'Complete Chapter' },
      ],
    },
    {
      id: 'searching',
      order: 9,
      title: 'Searching Basics',
      concept: 'Linear and binary search',
      icon: 'Search',
      storyIntro: 'Google processes 8.5 billion searches per day. Without efficient search algorithms, the internet as we know it wouldn\'t exist.',
      watch: 'Search Algorithms',
      practiceCount: 4,
      challenge: 'Binary Search in Sorted Array',
      timeMinutes: 40,
      difficulty: 'medium',
      completedSteps: 0,
      totalSteps: 7,
      currentStep: 0,
      locked: true,
      mentorNote: 'Searching is the base of optimization.',
      realWorld: ['Databases', 'Autocomplete', 'APIs'],
      reward: { xp: 60, badge: 'Search Scout' },
      steps: [
        { id: 'step-1-story', type: 'story_hook', title: 'Story Hook', storyContent: 'Searching efficiently is what separates amateur code from production-ready code.' },
        { id: 'step-2-video', type: 'video', title: 'Curated Video', videoUrl: '', videoTitle: 'Binary Search Deep Dive', videoDuration: '10 min', videoNote: 'Notice how the search space halves each iteration.' },
        { id: 'step-3-cheatsheet', type: 'cheatsheet', title: 'Cheatsheet', cheatsheetContent: ['Linear: O(n), check every element', 'Binary: O(log n), requires sorted data', 'Binary search = divide and conquer'] },
        { id: 'step-4-practice', type: 'practice', title: 'Practice Problems', practiceProblems: [] },
        { id: 'step-5-quiz', type: 'quiz', title: 'Mini Quiz', quizQuestions: [] },
        { id: 'step-6-task', type: 'task', title: 'The Task', taskStatement: 'Implement binary search to find a target in a sorted array.', taskSampleInput: '[1,3,5,7,9], target=5', taskSampleOutput: 'Found at index 2' },
        { id: 'step-7-complete', type: 'complete', title: 'Complete Chapter' },
      ],
    },
    {
      id: 'sorting',
      order: 10,
      title: 'Sorting Foundations',
      concept: 'Bubble, selection, and insertion',
      icon: 'ArrowDownUp',
      storyIntro: 'Amazon sorts millions of products by price, rating, and relevance every second. Sorting is one of the most fundamental operations in computer science.',
      watch: 'Sorting for Beginners',
      practiceCount: 5,
      challenge: 'Sort an array by parity',
      timeMinutes: 50,
      difficulty: 'medium',
      completedSteps: 0,
      totalSteps: 7,
      currentStep: 0,
      locked: true,
      mentorNote: 'Sorting teaches algorithm flow.',
      realWorld: ['Leaderboards', 'Catalogs', 'Scheduling'],
      reward: { xp: 70, badge: 'Sorting Starter' },
      steps: [
        { id: 'step-1-story', type: 'story_hook', title: 'Story Hook', storyContent: 'Sorting is the foundation of organized data. Without it, finding anything would be like looking for a needle in a haystack.' },
        { id: 'step-2-video', type: 'video', title: 'Curated Video', videoUrl: '', videoTitle: 'Sorting Visualized', videoDuration: '11 min', videoNote: 'Compare the animations of bubble sort vs merge sort.' },
        { id: 'step-3-cheatsheet', type: 'cheatsheet', title: 'Cheatsheet', cheatsheetContent: ['Bubble: O(n²), swap adjacent', 'Selection: O(n²), find min each pass', 'Insertion: O(n²), best for nearly sorted'] },
        { id: 'step-4-practice', type: 'practice', title: 'Practice Problems', practiceProblems: [] },
        { id: 'step-5-quiz', type: 'quiz', title: 'Mini Quiz', quizQuestions: [] },
        { id: 'step-6-task', type: 'task', title: 'The Task', taskStatement: 'Sort an array so all even numbers come before odd numbers.', taskSampleInput: '[3,1,2,4]', taskSampleOutput: '[2,4,3,1]' },
        { id: 'step-7-complete', type: 'complete', title: 'Complete Chapter' },
      ],
    },
  ],
};

export const phases: Phase[] = [
  phaseOne,
  {
    id: 'phase-2',
    title: 'Advanced Data Structures',
    subtitle: 'Stacks, Queues, Linked Lists, Trees',
    description: 'Dive into the data structures that power real-world applications.',
    progressPercent: 0,
    missionsCompleted: 0,
    missionsTotal: 8,
    problemsSolved: 0,
    currentStreak: 0,
    nextGoal: 'Stack Mastery',
    missions: [],
  },
  {
    id: 'phase-3',
    title: 'Graphs & Dynamic Programming',
    subtitle: 'BFS, DFS, DP patterns, and optimization',
    description: 'Master the topics that separate good from great.',
    progressPercent: 0,
    missionsCompleted: 0,
    missionsTotal: 10,
    problemsSolved: 0,
    currentStreak: 0,
    nextGoal: 'Graph Traversal',
    missions: [],
  },
];

export const getMissionById = (missionId: string) =>
  phaseOne.missions.find((mission) => mission.id === missionId);

export const getNextMission = (missionId: string) => {
  const index = phaseOne.missions.findIndex((mission) => mission.id === missionId);
  if (index === -1) return phaseOne.missions[0];
  return phaseOne.missions[index + 1] || null;
};

export type CommunityFeedItem = {
  id: number;
  type: 'completed' | 'shared' | 'started' | 'streak';
  name: string;
  city: string;
  action: string;
  time: string;
};

export const communityFeed: CommunityFeedItem[] = [
  { id: 1, type: 'completed', name: 'Arjun', city: 'Nagpur', action: 'just completed Arrays Bootcamp', time: '2 min ago' },
  { id: 2, type: 'shared', name: 'Priya', city: 'Bhopal', action: 'shared her progress on LinkedIn', time: '5 min ago' },
  { id: 3, type: 'started', name: 'Rohit', city: 'Lucknow', action: 'started Phase 1 today', time: '12 min ago' },
  { id: 4, type: 'streak', name: 'Sneha', city: 'Pune', action: 'completed 5-day streak', time: '18 min ago' },
  { id: 5, type: 'completed', name: 'Vikram', city: 'Jaipur', action: 'solved 10 problems today', time: '25 min ago' },
  { id: 6, type: 'streak', name: 'Ananya', city: 'Indore', action: 'earned the "Recursion Starter" badge', time: '32 min ago' },
];
