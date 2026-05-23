import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun, Hammer, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  slug: string;
  title: string;
  language?: string;
  stageLabel?: string;
  statusBadge?: 'in_progress' | 'completed' | null;
  repoUrl?: string;
  previewMode?: boolean;
  onPreviewModeChange?: (value: boolean) => void;
};

export function BuildWorkspaceTopBar({
  slug,
  title,
  language,
  stageLabel,
  statusBadge,
  repoUrl,
  previewMode,
  onPreviewModeChange,
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
        {repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Repository</span>
          </a>
        )}
        {language && (
          <Badge variant="secondary" className="capitalize text-[10px]">
            {language}
          </Badge>
        )}
        {onPreviewModeChange && (
          <Button
            type="button"
            variant={previewMode ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => onPreviewModeChange(!previewMode)}
          >
            {previewMode ? 'Preview on' : 'Preview'}
          </Button>
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
