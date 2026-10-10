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

function renderQuiz(overrides: Partial<React.ComponentProps<typeof QuizSection>> = {}) {
  const onSubmitQuiz = vi.fn();
  const onProceed = vi.fn();
  render(
    <QuizSection
      chapterId="ch-1"
      questions={questions}
      onSubmitQuiz={onSubmitQuiz}
      onProceed={onProceed}
      {...overrides}
    />
  );
  return { onSubmitQuiz, onProceed };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Default: every graded answer comes back correct.
  mockedPost.mockResolvedValue({ correct: true, explanation: 'Because.', correctOption: null } as never);
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

  it('grades every question and shows a summary after the last one', async () => {
    const { onSubmitQuiz } = renderQuiz();

    fireEvent.click(screen.getByRole('button', { name: /O\(log n\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Stack/ }));
    fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    await waitFor(() => expect(screen.getByText('Question 3 of 3')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Depth First Search/ }));
    fireEvent.click(screen.getByRole('button', { name: /finish quiz/i }));

    await waitFor(() => expect(screen.getByText('Your result')).toBeInTheDocument());
    // All three graded server-side, all correct.
    expect(mockedPost).toHaveBeenCalledTimes(3);
    expect(screen.getByText('3 correct')).toBeInTheDocument();
    expect(onSubmitQuiz).toHaveBeenCalledWith(3, true, 3);
  });

  it('sends the skip sentinel for skipped questions and counts them in the summary', async () => {
    mockedPost.mockResolvedValue({
      correct: false,
      explanation: 'The right answer is B.',
      correctOption: 'O(log n)',
    } as never);

    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText('Question 3 of 3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(screen.getByText('Your result')).toBeInTheDocument());
    expect(screen.getByText('3 skipped')).toBeInTheDocument();
    expect(mockedPost).toHaveBeenCalledWith(
      '/chapters/ch-1/quiz/check',
      expect.objectContaining({ selectedIndex: -1 })
    );
  });

  it('treats an unreachable grading endpoint as incorrect rather than crashing', async () => {
    mockedPost.mockRejectedValue(new Error('network down'));
    const { onSubmitQuiz } = renderQuiz();

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText('Question 2 of 3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    await waitFor(() => expect(screen.getByText('Question 3 of 3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(screen.getByText('Your result')).toBeInTheDocument());
    expect(onSubmitQuiz).toHaveBeenCalledWith(0, false, 3);
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
