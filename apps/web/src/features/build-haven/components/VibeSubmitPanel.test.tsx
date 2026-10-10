import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VibeSubmitPanel } from './VibeSubmitPanel';
import { buildHavenService } from '@/features/build-haven/api/build-haven.service';

vi.mock('@/features/build-haven/api/build-haven.service', () => ({
  buildHavenService: {
    vibeSubmitStage: vi.fn(),
  },
}));

const mockedVibeSubmitStage = vi.mocked(buildHavenService.vibeSubmitStage);

const journeys = [
  {
    id: 'j1',
    label: 'Sign up flow',
    public: true,
    steps: [
      { action: 'goto', target: '/' },
      { action: 'click', target: '#signup', label: 'Click signup' },
      { action: 'expect_visible', target: '#welcome' },
    ],
  },
  {
    id: 'j2',
    label: 'Hidden grading check',
    public: false,
    steps: [{ action: 'goto', target: '/admin' }],
  },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof VibeSubmitPanel>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VibeSubmitPanel
        enrollmentId="enrollment-1"
        stageId="stage-1"
        journeys={journeys as any}
        {...overrides}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedVibeSubmitStage.mockReset();
});

describe('VibeSubmitPanel', () => {
  it('renders only public journeys from the contract, not admin-only grading journeys', () => {
    renderPanel();
    expect(screen.getByText('Sign up flow')).toBeInTheDocument();
    expect(screen.queryByText('Hidden grading check')).not.toBeInTheDocument();
  });

  it('describes each journey step in plain language', () => {
    renderPanel();
    expect(screen.getByText(/Click "#signup"/)).toBeInTheDocument();
    expect(screen.getByText(/"#welcome" should be visible/)).toBeInTheDocument();
  });

  it('disables Submit until a URL/repo is entered', () => {
    renderPanel();
    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/your-app\.vercel\.app/), { target: { value: 'https://my-app.example.com' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('submits with the live_url source by default and renders a passed result', async () => {
    mockedVibeSubmitStage.mockResolvedValueOnce({
      result: {
        verdict: 'passed',
        gates_passed: 1,
        gates_total: 1,
        score_pct: 100,
        gate_results: [{ journeyId: 'j1', label: 'Sign up flow', passed: true, steps_passed: 3, steps_total: 3 }],
        logs_tail: 'ok',
        duration_ms: 500,
        submission_source: 'live_url',
        submission_ref: 'https://my-app.example.com',
      },
    } as any);

    renderPanel();
    fireEvent.change(screen.getByPlaceholderText(/your-app\.vercel\.app/), { target: { value: 'https://my-app.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockedVibeSubmitStage).toHaveBeenCalledWith('enrollment-1', 'stage-1', 'https://my-app.example.com', 'live_url');
    });

    expect(await screen.findByText(/all proof gates passed/i)).toBeInTheDocument();
  });

  it('switches to github_push source and submits with it', async () => {
    mockedVibeSubmitStage.mockResolvedValueOnce({
      result: {
        verdict: 'pending_review',
        gates_passed: 0,
        gates_total: 1,
        score_pct: 0,
        gate_results: [{ journeyId: 'j1', label: 'Sign up flow', passed: false, steps_passed: 0, steps_total: 3 }],
        logs_tail: 'pending',
        duration_ms: 200,
        submission_source: 'github_push',
        submission_ref: 'https://github.com/me/app',
      },
    } as any);

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /github repo/i }));
    fireEvent.change(screen.getByPlaceholderText(/github\.com\/you\/your-app/), { target: { value: 'https://github.com/me/app' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockedVibeSubmitStage).toHaveBeenCalledWith('enrollment-1', 'stage-1', 'https://github.com/me/app', 'github_push');
    });

    expect(await screen.findByText(/submitted for manual review/i)).toBeInTheDocument();
  });

  it('shows a failing gate\'s failure reason and screenshot when expanded by default', async () => {
    mockedVibeSubmitStage.mockResolvedValueOnce({
      result: {
        verdict: 'failed',
        gates_passed: 0,
        gates_total: 1,
        score_pct: 0,
        gate_results: [
          {
            journeyId: 'j1',
            label: 'Sign up flow',
            passed: false,
            steps_passed: 1,
            steps_total: 3,
            failure_step: 'Click signup',
            failure_reason: 'Element not found: #signup',
            screenshot_url: 'data:image/jpeg;base64,abc123',
          },
        ],
        logs_tail: 'failed',
        duration_ms: 300,
        submission_source: 'live_url',
        submission_ref: 'https://my-app.example.com',
      },
    } as any);

    renderPanel();
    fireEvent.change(screen.getByPlaceholderText(/your-app\.vercel\.app/), { target: { value: 'https://my-app.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText('Element not found: #signup')).toBeInTheDocument();
    expect(screen.getByAltText(/screenshot at point of failure/i)).toHaveAttribute('src', 'data:image/jpeg;base64,abc123');
  });

  it('shows a previously-submitted result on mount via initialResult, without calling the API', () => {
    renderPanel({
      initialResult: {
        verdict: 'partial',
        gates_passed: 1,
        gates_total: 2,
        score_pct: 50,
        gate_results: [],
        logs_tail: '',
        duration_ms: 100,
        submission_source: 'live_url',
        submission_ref: 'https://my-app.example.com',
      } as any,
    });

    expect(screen.getByText(/1\/2 gates passed/i)).toBeInTheDocument();
    expect(mockedVibeSubmitStage).not.toHaveBeenCalled();
  });
});
