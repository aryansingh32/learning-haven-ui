import { ArrowRight, CheckCircle2, Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChapterCtaVariant = 'primary' | 'secondary' | 'celebrate';

const variantClasses: Record<ChapterCtaVariant, string> = {
  primary:
    'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.25)]',
  secondary: 'bg-secondary hover:bg-secondary/80 text-foreground border border-border/60',
  celebrate:
    'bg-orange-500 hover:bg-orange-600 text-white shadow-xl px-8 py-4 text-lg',
};

const iconMap = {
  primary: ArrowRight,
  secondary: ArrowRight,
  celebrate: Sparkles,
  play: Play,
  check: CheckCircle2,
};

type ChapterCtaProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ChapterCtaVariant;
  icon?: keyof typeof iconMap;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
};

export function ChapterCta({
  children,
  onClick,
  variant = 'primary',
  icon = variant === 'celebrate' ? 'celebrate' : variant === 'primary' ? 'primary' : 'secondary',
  disabled,
  className,
  type = 'button',
}: ChapterCtaProps) {
  const Icon =
    icon === 'play'
      ? Play
      : icon === 'check'
        ? CheckCircle2
        : icon === 'celebrate'
          ? Sparkles
          : ArrowRight;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        className
      )}
    >
      {children}
      <Icon className={cn('h-4 w-4', icon === 'play' && 'fill-current', variant === 'celebrate' && 'h-5 w-5')} />
    </button>
  );
}
