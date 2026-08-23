import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BuildWorkspacePage from '@/pages/BuildWorkspacePage';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { buildHavenService } from '@/features/build-haven/api/build-haven.service';
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { toast } from 'sonner';

// Mock Dependencies
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/build-haven/api/build-haven.service', () => ({
  buildHavenService: {
    getWorkspace: vi.fn(),
    getLeaderboard: vi.fn(),
    subscribeToEnrollmentEvents: vi.fn().mockReturnValue(vi.fn()), // mock unsubsribe
    celebrateStage: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/features/apprenticeship/api/apprenticeship.service', () => ({
  apprenticeshipService: {
    getGithubStatus: vi.fn(),
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
        <BuildWorkspacePage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('BuildWorkspacePage UI/UX & Flow Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: { id: 'test-user' }, isAuthenticated: true });
    
    (apprenticeshipService.getGithubStatus as any).mockResolvedValue({ connected: true });
    (buildHavenService.getLeaderboard as any).mockResolvedValue({ leaderboard: [] });

    // Mock Workspace Response
    (buildHavenService.getWorkspace as any).mockResolvedValue({
      workspace: {
        challenge: {
          title: 'Docker Challenge',
          slug: 'docker-test',
          languages: [{ language: 'go' }],
          stages: [
            { stage_number: 1, title: 'Bind to port', description: 'Bind to 8080' },
            { stage_number: 2, title: 'Return 200', description: 'Return 200 OK' },
          ]
        },
        enrollment: {
          id: 'enroll-123',
          language: 'go',
          current_stage: 1,
          status: 'in_progress',
          repo_url: 'https://github.com/test/repo',
          build_mode: 'vibe'
        },
        attempts: []
      }
    });
  });

  it('renders loading state initially', () => {
    (buildHavenService.getWorkspace as any).mockImplementation(() => new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders workspace UI correctly for enrolled user', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Docker Challenge')).toBeInTheDocument();
      expect(screen.getByText('Bind to port')).toBeInTheDocument(); // Stage title
    });
    
    // Check Tabs exist
    expect(screen.getByText('Instructions')).toBeInTheDocument();
    expect(screen.getByText('Code Examples')).toBeInTheDocument();
    expect(screen.getByText('Concepts')).toBeInTheDocument();
  });

  it('displays "Complete Solution" blur gate when accessing examples before completion', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Code Examples')).toBeInTheDocument());
    
    fireEvent.click(screen.getByText('Code Examples'));
    
    // If the modal/gate appears
    await waitFor(() => {
      expect(screen.getByText(/View code examples\?/i)).toBeInTheDocument();
    });
  });
});
