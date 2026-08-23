import { motion } from 'framer-motion';
import { Code2, Sparkles, GitFork, Bot, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ModeCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  features: string[];
  ctaLabel: string;
  accentClass: string;
  borderClass: string;
  glowClass: string;
}

function ModeCard({
  selected,
  onClick,
  icon,
  title,
  subtitle,
  features,
  accentClass,
  borderClass,
  glowClass,
}: ModeCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'relative flex w-full flex-col items-start gap-4 rounded-2xl border-2 p-6 text-left transition-all duration-200',
        selected
          ? `${borderClass} ${glowClass} bg-card/90`
          : 'border-border/50 bg-card/40 hover:border-border hover:bg-card/60'
      )}
    >
      {selected && (
        <motion.div
          layoutId="mode-selected"
          className="absolute right-4 top-4"
          initial={false}
        >
          <CheckCircle2 className={cn('h-5 w-5', accentClass)} />
        </motion.div>
      )}

      <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', selected ? `bg-${accentClass}/10` : 'bg-muted/50')}>
        <span className={cn('h-6 w-6', selected ? accentClass : 'text-muted-foreground')}>
          {icon}
        </span>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <ul className="space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
            <ArrowRight className={cn('mt-0.5 h-3 w-3 shrink-0', selected ? accentClass : '')} />
            {f}
          </li>
        ))}
      </ul>
    </motion.button>
  );
}

interface BuildModePickerProps {
  availableModes: ('traditional' | 'vibe')[];
  selectedMode: 'traditional' | 'vibe';
  onSelect: (mode: 'traditional' | 'vibe') => void;
  /** If true, shows a "Continue →" confirm button below the cards */
  showConfirm?: boolean;
  onConfirm?: () => void;
  isLoading?: boolean;
}

export function BuildModePicker({
  availableModes,
  selectedMode,
  onSelect,
  showConfirm,
  onConfirm,
  isLoading,
}: BuildModePickerProps) {
  const showTraditional = availableModes.includes('traditional');
  const showVibe = availableModes.includes('vibe');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Choose how you want to build</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Both modes tackle the same challenge — pick the workflow that fits you.
        </p>
      </div>

      <div className={cn('grid gap-4', showTraditional && showVibe ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
        {showTraditional && (
          <ModeCard
            selected={selectedMode === 'traditional'}
            onClick={() => onSelect('traditional')}
            icon={<Code2 className="h-full w-full" />}
            title="Traditional"
            subtitle="Write code, push commits, pass automated tests"
            features={[
              'Clone a private GitHub repo provisioned for you',
              'Write code in your local editor or IDE',
              'Push commits — we run Docker-isolated tests instantly',
              'Standard progression: one stage at a time',
            ]}
            ctaLabel="Start with code"
            accentClass="text-primary"
            borderClass="border-primary"
            glowClass="shadow-lg shadow-primary/10"
          />
        )}

        {showVibe && (
          <ModeCard
            selected={selectedMode === 'vibe'}
            onClick={() => onSelect('vibe')}
            icon={<Sparkles className="h-full w-full" />}
            title="Vibe Coded"
            subtitle="Build with AI tools — we verify the product, not the code"
            features={[
              'Use Cursor, Claude, Bolt, Lovable, or any AI builder',
              'Read the Product Contract — we tell you WHAT to build',
              'Submit your live URL or GitHub repo when ready',
              'We run browser-based proof gates to verify functionality',
            ]}
            ctaLabel="Start with AI"
            accentClass="text-violet-500"
            borderClass="border-violet-500"
            glowClass="shadow-lg shadow-violet-500/10"
          />
        )}
      </div>

      {showConfirm && (
        <div className="flex justify-end">
          <Button
            size="lg"
            className={cn(
              'px-8 shadow-md',
              selectedMode === 'vibe'
                ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/20'
                : 'gradient-golden text-primary-foreground shadow-primary/20'
            )}
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? (
              'Setting up…'
            ) : selectedMode === 'vibe' ? (
              <>
                <Bot className="mr-2 h-4 w-4" />
                Start Vibe Coding
              </>
            ) : (
              <>
                <GitFork className="mr-2 h-4 w-4" />
                Set Up Repository
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
