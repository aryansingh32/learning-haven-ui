import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizSection } from './QuizSection';
import { api } from '@/services/api.svc';

vi.mock('@/services/api.svc', () => ({
  api: { post: vi.fn() },
}));

const mockedPost = vi.mocked(api.post);

const questions = [
  { q: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(1)'] },
  { q: 'Which structure is LIFO?', options: ['Queue', 'Stack'] },
  { q: 'What does DFS stand for?', options: ['Depth First Search', 'Data Flow System'] },
];

/** A /quiz/submit response with the given per-question correctness. */
function graded(correct: boolean[], correctOption: string | null = null) {
  const score = correct.filter(Boolean).length;
  const percent = Math.round((score / correct.length) * 100);
  return {
    score, total: correct.length, percent, passed: percent >= 66, best_percent: percent, can_unlock: false,
    results: correct.map((c) => ({ correct: c, skipped: false, selectedIndex: 0, correctOption: c ? null : correctOption, explanation: 'Because.' })),
  };
}

function renderQuiz(overrides: Partial<React.ComponentProps<typeof QuizSection>> = {}) {
  const onGraded = vi.fn();
  const onProceed = vi.fn();
  render(
    <QuizSection
      chapterId="ch-1"
      questions={questions}
      onGraded={onGraded}
      onProceed={onProceed}
      {...overrides}
    />
  );
  return { onGraded, onProceed };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Default: the server marks every answer correct.
  mockedPost.mockImplementation((async (_url: string, body: { answers: number[] }) => graded(body.answers.map(() => true))) as never);
});

describe('QuizSection — one question at a time', () => {
  it('shows only the first question initially', () => {
    renderQuiz();
    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
    expect(screen.getByText(questions[0].q)).toBeInTheDocument();
    expect(screen.queryByText(questions[1].q)).not.toBeInTheDocument();
    expect(screen.queryByText(questions[2].q)).not.toBeInTheDocument();
  });

  it('disables Next until an option is selected', () => {
    renderQuiz();
    const next = screen.getByRole('button', { name: /next question/i });
    expect(next).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /O\(log n\)/ }));
    expect(screen.getByRole('button', { name: /next question/i })).not.toBeDisabled();
  });

  it('advances to the next question after answering', async () => {
    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: /O\(log n\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /next question/i }));

    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeInTheDocument());
    expect(screen.getByText(questions[1].q)).toBeInTheDocument();
    expect(screen.queryByText(questions[0].q)).not.toBeInTheDocument();
  });

  it('advances when the question is skipped without an answer', async () => {
    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeInTheDocument());
    expect(screen.getByText('0 answered')).toBeInTheDocument();
  });

  it('lets the learner go back to a previous question', async () => {
    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    await waitFor(() => expect(screen.getByText('Question 1 of 3')).toBeInTheDocument());
  });

  it('sends every answer in one request and shows the server\'s summary', async () => {
    const { onGraded } = renderQuiz();

    fireEvent.click(screen.getByRole('button', { name: /O\(log n\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Stack/ }));
    fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    await waitFor(() => expect(screen.getByText('Question 3 of 3')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Depth First Search/ }));
    fireEvent.click(screen.getByRole('button', { name: /finish quiz/i }));

    await waitFor(() => expect(screen.getByText('Your result')).toBeInTheDocument());
    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith('/chapters/ch-1/quiz/submit', { answers: [1, 1, 0] });
    expect(screen.getByText('3 correct')).toBeInTheDocument();
    expect(onGraded).toHaveBeenCalledWith(expect.objectContaining({ score: 3, total: 3, passed: true }));
  });

  it('sends -1 for skipped questions and shows the right answer from the server', async () => {
    mockedPost.mockResolvedValue(graded([false, false, false], 'O(log n)') as never);

    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText('Question 3 of 3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(screen.getByText('Your result')).toBeInTheDocument());
    expect(screen.getByText('3 skipped')).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledWith('/chapters/ch-1/quiz/submit', { answers: [-1, -1, -1] });
    expect(screen.getAllByText(/Correct answer/).length).toBeGreaterThan(0);
  });

  it('shows an error and keeps the answers when grading fails, instead of scoring 0', async () => {
    mockedPost.mockRejectedValueOnce(new Error('network down'));
    const { onGraded } = renderQuiz();

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText('Question 3 of 3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /O|Depth First Search/ }));
    fireEvent.click(screen.getByRole('button', { name: /finish quiz/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('network down'));
    expect(screen.queryByText('Your result')).not.toBeInTheDocument();
    expect(onGraded).not.toHaveBeenCalled();
    // Trying again works.
    fireEvent.click(screen.getByRole('button', { name: /finish quiz/i }));
    await waitFor(() => expect(screen.getByText('Your result')).toBeInTheDocument());
  });

  it('keeps the fresh results on screen when the chapter reloads with the saved score', async () => {
    const onGraded = vi.fn();
    const { rerender } = render(<QuizSection chapterId="ch-1" questions={questions} onGraded={onGraded} onProceed={vi.fn()} />);
    for (const _ of questions) {
      fireEvent.click(screen.getByRole('button', { name: /skip/i }));
      await new Promise((r) => setTimeout(r, 0));
    }
    await waitFor(() => expect(screen.getByText('Your result')).toBeInTheDocument());
    rerender(<QuizSection chapterId="ch-1" questions={questions} onGraded={onGraded} onProceed={vi.fn()} alreadySubmitted savedScorePercent={100} />);
    expect(screen.getByText('Your result')).toBeInTheDocument();
    expect(screen.queryByText('Previous attempt')).not.toBeInTheDocument();
  });

  it('lets the learner retake after a saved attempt (no bounce back to "Previous attempt")', async () => {
    renderQuiz({ alreadySubmitted: true, savedScorePercent: 80 });
    fireEvent.click(screen.getByRole('button', { name: /retake quiz/i }));
    await waitFor(() => expect(screen.getByText('Question 1 of 3')).toBeInTheDocument());
    expect(screen.queryByText('Previous attempt')).not.toBeInTheDocument();
  });

  it('shows the previous attempt screen when the quiz was already submitted', () => {
    renderQuiz({ alreadySubmitted: true, savedScorePercent: 80 });
    expect(screen.getByText('Previous attempt')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('restores in-progress position from localStorage', () => {
    localStorage.setItem('lh_quiz_ch-1', JSON.stringify({ answers: { 0: 1 }, submitted: false, current: 1 }));
    renderQuiz();
    expect(screen.getByText('Question 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('1 answered')).toBeInTheDocument();
  });
});
