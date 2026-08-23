import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BuildChallengePage from '@/pages/BuildChallengePage';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { buildHavenService } from '@/features/build-haven/api/build-haven.service';
import { toast } from 'sonner';

// Mock Dependencies
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/build-haven/api/build-haven.service', () => ({
  buildHavenService: {
    getChallengeBySlug: vi.fn(),
    getMyEnrollments: vi.fn(),
    enrollInChallenge: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderComponent = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <BuildChallengePage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('BuildChallengePage Integration & Edge Case Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: { id: 'test-user-123' }, isAuthenticated: true });
    
    // Default Successful Mock Responses
    (buildHavenService.getChallengeBySlug as any).mockResolvedValue({
      id: 'challenge-1',
      title: 'Test Redis Challenge',
      slug: 'test-redis',
      description: 'Build Redis from scratch',
      difficultyLevel: 'advanced',
      priceInr: 0,
      durationDays: 30,
      available_modes: ['traditional', 'vibe'],
      default_mode: 'vibe',
      supportedLanguages: ['python', 'typescript'],
      stages: [
        { id: 's1', stage_number: 1, title: 'Stage 1: PING', verification_type: 'contract' }
      ]
    });

    (buildHavenService.getMyEnrollments as any).mockResolvedValue([]);
  });

  it('renders loading state initially', () => {
    // Force a hanging promise to test loading state
    (buildHavenService.getChallengeBySlug as any).mockImplementation(() => new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Expecting loader icon/spinner
  });

  it('renders dual-mode options properly after loading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Test Redis Challenge')).toBeInTheDocument();
    });

    // Check if dual modes are present
    expect(screen.getByText('Vibe Mode')).toBeInTheDocument();
    expect(screen.getByText('Traditional Mode')).toBeInTheDocument();
  });

  it('handles edge case: User lacking GitHub connection blocks traditional mode enrollment', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Traditional Mode')).toBeInTheDocument());

    // Switch to Traditional Mode
    fireEvent.click(screen.getByText('Traditional Mode'));
    
    // In traditional mode, selecting a language and enrolling should check github
    fireEvent.click(screen.getByText('Python'));
    
    const enrollBtn = screen.getByRole('button', { name: /Enroll & Start Building/i });
    fireEvent.click(enrollBtn);

    // Because we mock auth context but didn't mock github auth state, we expect a toast or redirect
    await waitFor(() => {
      // Assuming missing github triggers an error or redirect, we check for error handling
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('GitHub'));
    });
  });

  it('handles edge case: API error on challenge load displays 404/Error state', async () => {
    (buildHavenService.getChallengeBySlug as any).mockRejectedValue(new Error('Challenge Not Found'));
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText(/Challenge not found/i)).toBeInTheDocument();
    });
  });

  it('successfully executes Vibe Mode Enrollment Flow', async () => {
    (buildHavenService.enrollInChallenge as any).mockResolvedValue({ id: 'enroll-1' });
    renderComponent();

    await waitFor(() => expect(screen.getByText('Test Redis Challenge')).toBeInTheDocument());

    // Ensure Vibe Mode is active
    fireEvent.click(screen.getByText('Vibe Mode'));
    
    // Select Language
    fireEvent.click(screen.getByText('Python'));

    // Submit
    const enrollBtn = screen.getByRole('button', { name: /Enroll & Start Building/i });
    fireEvent.click(enrollBtn);

    await waitFor(() => {
      expect(buildHavenService.enrollInChallenge).toHaveBeenCalledWith(
        'challenge-1',
        'python',
        null,
        'vibe'
      );
      // Wait for redirect logic or success toast
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('successfully'));
    });
  });

  it('handles edge case: Server error during enrollment gracefully', async () => {
    (buildHavenService.enrollInChallenge as any).mockRejectedValue(new Error('Internal Server Error'));
    renderComponent();

    await waitFor(() => expect(screen.getByText('Test Redis Challenge')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Python'));
    const enrollBtn = screen.getByRole('button', { name: /Enroll & Start Building/i });
    fireEvent.click(enrollBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to enroll'));
    });
  });
});
