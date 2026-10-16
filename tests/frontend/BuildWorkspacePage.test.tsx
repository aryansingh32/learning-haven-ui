import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BuildWorkspacePage from '@/pages/BuildWorkspacePage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

// A fresh cache per test, so one test's data never leaks into the next.
const renderComponent = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/docker-test/workspace?language=go']}>
        <Routes>
          <Route path="/projects/:slug/workspace" element={<BuildWorkspacePage />} />
        </Routes>
      </MemoryRouter>
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
    expect(screen.getByRole('status', { name: /loading workspace/i })).toBeInTheDocument();
  });

  it('explains when the workspace cannot be loaded instead of spinning forever', async () => {
    (buildHavenService.getWorkspace as any).mockRejectedValue(new Error('Not found'));
    renderComponent();
    expect(await screen.findByText(/workspace isn't available/i, undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders workspace UI correctly for enrolled user', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getAllByText('Docker Challenge').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Bind to port').length).toBeGreaterThan(0); // Stage title
    });
    
    // Check Tabs exist
    expect(screen.getByText('Instructions')).toBeInTheDocument();
    expect(screen.getByText('Code Examples')).toBeInTheDocument();
    expect(screen.getByText('Concepts')).toBeInTheDocument();
  });

  it('keeps the complete solution hidden until the learner reveals it', async () => {
    (buildHavenService.getWorkspace as any).mockResolvedValue({
      workspace: {
        challenge: {
          title: 'Docker Challenge', slug: 'docker-test', languages: [{ language: 'go' }],
          stages: [{ stage_number: 1, title: 'Bind to port', description: 'Bind to 8080', code_example: 'package main // SOLUTION_BODY' }],
        },
        enrollment: { id: 'enroll-123', language: 'go', current_stage: 1, status: 'in_progress', repo_url: 'https://github.com/test/repo', build_mode: 'vibe' },
        attempts: [],
      },
    });
    renderComponent();
    const reveal = await screen.findByRole('button', { name: /Reveal complete solution/i });
    expect(screen.getByText(/Click "Reveal" to see the solution/i)).toBeInTheDocument();
    fireEvent.click(reveal);
    expect(await screen.findByRole('button', { name: /Hide solution/i })).toBeInTheDocument();
  });
});
