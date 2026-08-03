import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun, Hammer, Github, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = {
  slug: string;
  title: string;
  language?: string;
  stageLabel?: string;
  statusBadge?: 'in_progress' | 'completed' | null;
  repoUrl?: string;
  isGithubConnected?: boolean;
  onConnectGithub?: () => void;
  onDisconnectGithub?: () => void;
};

export function BuildWorkspaceTopBar({
  slug,
  title,
  language,
  stageLabel,
  statusBadge,
  repoUrl,
  isGithubConnected,
  onConnectGithub,
  onDisconnectGithub,
}: Props) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-card/60 px-4 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/projects"
          className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <Hammer className="h-3.5 w-3.5" />
          Projects
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link
          to={`/projects/${slug}`}
          className="truncate text-xs font-medium text-foreground hover:text-primary transition-colors"
        >
          {title}
        </Link>
        {stageLabel && (
          <>
            <span className="hidden text-muted-foreground/40 sm:inline">/</span>
            <span className="hidden truncate text-xs font-medium text-foreground sm:inline">
              {stageLabel}
            </span>
          </>
        )}
        {statusBadge === 'in_progress' && (
          <Badge variant="secondary" className="hidden bg-primary/10 text-primary text-[10px] sm:inline-flex">
            In progress
          </Badge>
        )}
        {statusBadge === 'completed' && (
          <Badge variant="secondary" className="hidden bg-success/10 text-success text-[10px] sm:inline-flex">
            Completed
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs bg-secondary/50 hover:bg-secondary">
              <Github className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">GitHub</span>
              {isGithubConnected ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {repoUrl && (
              <DropdownMenuItem asChild>
                <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                  Open Repository
                </a>
              </DropdownMenuItem>
            )}
            {isGithubConnected ? (
              <>
                <DropdownMenuItem onClick={onConnectGithub} className="cursor-pointer">
                  Reconnect Account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDisconnectGithub} className="text-destructive focus:text-destructive cursor-pointer">
                  Disconnect Account
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={onConnectGithub} className="cursor-pointer">
                Connect Account
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {language && (
          <Badge variant="secondary" className="capitalize text-[10px]">
            {language}
          </Badge>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
