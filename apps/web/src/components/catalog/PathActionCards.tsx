import { ArrowRight, Rocket, Building2, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const DEFAULT_CARDS = [
  {
    id: 'career',
    icon: Rocket,
    title: 'Start a Career',
    subtitle: 'Learn Java + DSA + Projects',
    badge: 'Job Ready Path',
    link: '/courses',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&auto=format&fit=crop',
    tint: 'from-blue-600/90 to-blue-800/90',
  },
  {
    id: 'business',
    icon: Building2,
    title: 'Enterprise Learning',
    subtitle: 'Train teams • Skill development',
    badge: 'For Teams',
    link: '/referrals',
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=500&auto=format&fit=crop',
    tint: 'from-slate-800/90 to-slate-900/90',
  },
  {
    id: 'degree',
    icon: GraduationCap,
    title: 'Degree Programs',
    subtitle: 'University partnerships',
    badge: 'Coming Soon',
    link: '/courses',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=500&auto=format&fit=crop',
    tint: 'from-indigo-700/90 to-indigo-900/90',
  },
];

type Props = {
  cards?: typeof DEFAULT_CARDS;
  className?: string;
};

export function PathActionCards({ cards = DEFAULT_CARDS, className }: Props) {
  const navigate = useNavigate();

  return (
    <section className={cn('grid md:grid-cols-3 gap-4', className)}>
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => navigate(card.link)}
          className="group relative h-[140px] md:h-[160px] rounded-2xl overflow-hidden text-left shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img src={card.image} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
          <div className={cn('absolute inset-0 bg-gradient-to-br', card.tint)} />
          <div className="relative z-10 p-5 h-full flex flex-col justify-between text-white">
            <div>
              <span className="text-caption font-bold uppercase tracking-wider text-white/70">{card.badge}</span>
              <h3 className="font-display text-lg font-bold mt-1">{card.title}</h3>
              <p className="text-meta text-white/85 mt-0.5">{card.subtitle}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-meta font-semibold group-hover:gap-2 transition-all">
              Explore <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>
      ))}
    </section>
  );
}
