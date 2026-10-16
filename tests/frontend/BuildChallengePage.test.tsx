import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BuildChallengePage from '@/pages/BuildChallengePage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { buildHavenService } from '@/features/build-haven/api/build-haven.service';
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { toast } from 'sonner';

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/build-haven/api/build-haven.service', () => ({
  buildHavenService: {
    getChallengeBySlug: vi.fn(),
    getWorkspace: vi.fn(),
    getLeaderboard: vi.fn(),
    startChallenge: vi.fn(),
  },
}));
vi.mock('@/features/apprenticeship/api/apprenticeship.service', () => ({
  apprenticeshipService: { getGithubStatus: vi.fn(), getGithubAuthUrl: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateSpy,
}));

const challenge = {
  id: 'challenge-1',
  title: 'Test Redis Challenge',
  slug: 'test-redis',
  description: 'Build Redis from scratch',
  difficulty_level: 'advanced',
  available_modes: ['traditional', 'vibe'],
  default_mode: 'vibe',
  languages: [{ language: 'python' }, { language: 'typescript' }],
  stages: [{ id: 's1', stage_number: 1, title: 'Stage 1: PING', estimated_minutes: 30 }],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/projects/test-redis']}>
        <Routes>
          <Route path="/projects/:slug" element={<BuildChallengePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BuildChallengePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: { id: 'u1' }, isAuthenticated: true });
    (buildHavenService.getChallengeBySlug as any).mockResolvedValue({ challenge });
    (buildHavenService.getWorkspace as any).mockResolvedValue({ workspace: { enrollment: null } });
    (buildHavenService.getLeaderboard as any).mockResolvedValue({ leaderboard: [] });
    (apprenticeshipService.getGithubStatus as any).mockResolvedValue({ connected: false });
  });

  it('announces loading while the challenge loads', () => {
    (buildHavenService.getChallengeBySlug as any).mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading challenge/i })).toBeInTheDocument();
  });

  it('shows the challenge with both build modes', async () => {
    renderPage();
    expect(await screen.findByText('Test Redis Challenge')).toBeInTheDocument();
    expect(screen.getByText('Traditional')).toBeInTheDocument();
    expect(screen.getByText('Vibe Coded')).toBeInTheDocument();
  });

  it('says "Challenge not found" instead of spinning forever when loading fails', async () => {
    (buildHavenService.getChallengeBySlug as any).mockRejectedValue(new Error('Challenge Not Found'));
    renderPage();
    // The page retries once before giving up.
    expect(await screen.findByText(/Challenge not found/i, undefined, { timeout: 5000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /All challenges/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/projects');
  });

  it('asks to connect GitHub before a traditional build', async () => {
    renderPage();
    await screen.findByText('Test Redis Challenge');
    fireEvent.click(screen.getByText('Traditional'));
    expect(await screen.findByRole('button', { name: /Connect GitHub to Start/i })).toBeInTheDocument();
    expect(buildHavenService.startChallenge).not.toHaveBeenCalled();
  });

  it('starts a vibe build and opens the workspace', async () => {
    (buildHavenService.startChallenge as any).mockResolvedValue({ enrollment: { id: 'e1' }, repository: null, clone_command: null });
    renderPage();
    await screen.findByText('Test Redis Challenge');
    fireEvent.click(screen.getByText('Vibe Coded'));
    fireEvent.click(await screen.findByRole('button', { name: /Start Vibe Coding/i }));
    await waitFor(() => expect(buildHavenService.startChallenge).toHaveBeenCalledWith('test-redis', 'python', 'vibe'));
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/projects/test-redis/workspace?language=python&mode=vibe'));
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the server error when starting fails', async () => {
    (buildHavenService.startChallenge as any).mockRejectedValue(new Error('Internal Server Error'));
    renderPage();
    await screen.findByText('Test Redis Challenge');
    fireEvent.click(screen.getByText('Vibe Coded'));
    fireEvent.click(await screen.findByRole('button', { name: /Start Vibe Coding/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Internal Server Error'));
    expect(navigateSpy).not.toHaveBeenCalledWith(expect.stringContaining('/workspace'));
  });
});
