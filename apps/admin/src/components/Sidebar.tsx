import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    Code,
    BookOpen,
    FileText,
    GitBranch,
    Settings,
    LogOut,
    Shield,
    DollarSign,
    MessageSquare,
    Trophy,
    ChevronLeft,
    ChevronRight,
    BarChart3,
    CreditCard,
    ListTodo,
    Bot,
    Share2,
    Zap,
    Target,
    GraduationCap,
    LayoutTemplate,
    Activity,
    Ticket,
    TrendingUp,
    Wallet,
    Mail,
    ShieldCheck,
    FlaskConical,
    Map,
    Hammer,
    Briefcase,
    FileUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const categories = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        basePaths: ['/analytics'],
        exactPaths: ['/'],
        items: [
            { name: 'Mission Control', href: '/', icon: Activity },
            { name: 'Analytics', href: '/analytics', icon: BarChart3 },
        ]
    },
    {
        id: 'learn',
        label: 'Learn',
        icon: BookOpen,
        basePaths: ['/courses', '/chapters', '/categories', '/roadmap-builder', '/catalog-builder', '/content-import'],
        exactPaths: [],
        items: [
            { name: 'Courses', href: '/courses', icon: GitBranch },
            { name: 'Chapters', href: '/chapters', icon: BookOpen },
            { name: 'Categories', href: '/categories', icon: FileText },
            { name: 'Visual Roadmap', href: '/roadmap-builder', icon: Map },
            { name: 'Landing Page CMS', href: '/catalog-builder', icon: LayoutTemplate },
            { name: 'Content Import', href: '/content-import', icon: FileUp },
        ]
    },
    {
        id: 'practice',
        label: 'Practice',
        icon: Code,
        basePaths: ['/problems', '/patterns', '/tasks'],
        exactPaths: [],
        items: [
            { name: 'Problems', href: '/problems', icon: Code },
            { name: 'Patterns', href: '/patterns', icon: Share2 },
            { name: 'Tasks', href: '/tasks', icon: ListTodo },
        ]
    },
    {
        id: 'build',
        label: 'Build',
        icon: Hammer,
        basePaths: ['/build-challenges'],
        exactPaths: [],
        items: [
            { name: 'Build Projects', href: '/build-challenges', icon: Code },
            { name: 'Challenge Users', href: '/build-challenges/users', icon: Users },
        ]
    },
    {
        id: 'careers',
        label: 'Careers',
        icon: Briefcase,
        basePaths: ['/apprenticeship'],
        exactPaths: [],
        items: [
            { name: 'Overview', href: '/apprenticeship', icon: GraduationCap },
            { name: 'Programs', href: '/apprenticeship/programs', icon: FileText },
            { name: 'Submissions', href: '/apprenticeship/submissions', icon: Code },
            { name: 'Students', href: '/apprenticeship/students', icon: Users },
            { name: 'Analytics', href: '/apprenticeship/analytics', icon: BarChart3 },
            { name: 'Coupons', href: '/apprenticeship/coupons', icon: CreditCard },
            { name: 'Notifications', href: '/apprenticeship/notifications', icon: MessageSquare },
        ]
    },
    {
        id: 'people',
        label: 'Users',
        icon: Users,
        basePaths: ['/users', '/permissions', '/communications', '/referrals', '/feedback'],
        exactPaths: [],
        items: [
            { name: 'Users', href: '/users', icon: Users },
            { name: 'Permissions', href: '/permissions', icon: ShieldCheck },
            { name: 'Communications', href: '/communications', icon: Mail },
            { name: 'Referrals', href: '/referrals', icon: Zap },
            { name: 'Feedback', href: '/feedback', icon: MessageSquare },
        ]
    },
    {
        id: 'commerce',
        label: 'Commerce',
        icon: DollarSign,
        basePaths: ['/revenue', '/plans', '/coupons', '/withdrawals'],
        exactPaths: [],
        items: [
            { name: 'Revenue', href: '/revenue', icon: TrendingUp },
            { name: 'Plans', href: '/plans', icon: CreditCard },
            { name: 'Coupons', href: '/coupons', icon: Ticket },
            { name: 'Withdrawals', href: '/withdrawals', icon: Wallet },
        ]
    },
    {
        id: 'platform',
        label: 'Platform',
        icon: Settings,
        basePaths: ['/system-health', '/cms', '/experiments', '/network', '/gamification', '/ai-config', '/leaderboard', '/settings', '/logs'],
        exactPaths: [],
        items: [
            { name: 'System Health', href: '/system-health', icon: Activity },
            { name: 'CMS & Appearance', href: '/cms', icon: LayoutTemplate },
            { name: 'Experiments', href: '/experiments', icon: FlaskConical },
            { name: 'Network Monitor', href: '/network', icon: Activity },
            { name: 'Gamification', href: '/gamification', icon: Target },
            { name: 'AI Config', href: '/ai-config', icon: Bot },
            { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
            { name: 'Settings', href: '/settings', icon: Settings },
            { name: 'Audit Logs', href: '/logs', icon: Shield },
        ]
    }
];

const Sidebar = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    // Determine active category based on URL
    const activeCategory = categories.find(cat => 
        cat.exactPaths.includes(location.pathname) || 
        cat.basePaths.some(path => location.pathname.startsWith(path))
    ) || categories[0];

    return (
        <TooltipProvider delayDuration={0}>
            <aside
                className={cn(
                    "flex h-full transition-all duration-300 ease-in-out relative z-20",
                    collapsed ? "w-[72px]" : "w-[312px]" // 72px + 240px
                )}
            >
                {/* Primary Sidebar (Icons only) */}
                <div className="w-[72px] shrink-0 h-full border-r bg-card/80 backdrop-blur-xl flex flex-col items-center py-4 z-20 relative">
                    {/* Brand */}
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center mb-6 shadow-sm">
                        <Zap className="w-5 h-5 text-white" />
                    </div>

                    {/* Primary Categories */}
                    <div className="flex-1 flex flex-col gap-3 w-full px-2 overflow-y-auto hide-scrollbar">
                        {categories.map((cat) => {
                            const Icon = cat.icon;
                            const isActive = activeCategory.id === cat.id;

                            return (
                                <Tooltip key={cat.id}>
                                    <TooltipTrigger asChild>
                                        <Link
                                            to={cat.items[0].href}
                                            className={cn(
                                                "w-full aspect-square flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200",
                                                isActive 
                                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                            )}
                                        >
                                            <Icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "")} />
                                            <span className={cn("text-[9px] font-semibold leading-none", isActive ? "text-primary-foreground/90" : "text-muted-foreground/70")}>
                                                {cat.label}
                                            </span>
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="font-medium">
                                        {cat.label}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>

                    {/* User Profile & Logout (Primary Sidebar) */}
                    <div className="mt-4 flex flex-col gap-2 w-full px-2 items-center">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold shadow-sm cursor-pointer">
                                    {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p className="font-medium">{user?.full_name || 'Admin'}</p>
                                <p className="text-xs text-muted-foreground">{user?.role}</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-10 h-10 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={logout}
                                >
                                    <LogOut className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium text-destructive">
                                Logout
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* Secondary Sidebar (Links for active category) */}
                <div 
                    className={cn(
                        "h-full border-r bg-card/40 backdrop-blur-sm flex flex-col transition-all duration-300 absolute left-[72px] top-0 bottom-0 overflow-hidden",
                        collapsed ? "w-0 opacity-0 pointer-events-none" : "w-[240px] opacity-100"
                    )}
                >
                    <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-2">
                            <activeCategory.icon className="w-4 h-4 text-primary" />
                            <span className="font-bold tracking-tight text-sm uppercase">{activeCategory.label}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setCollapsed(true)}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                    </div>

                    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
                        {activeCategory.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = item.href === '/' 
                                ? location.pathname === '/' 
                                : location.pathname.startsWith(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 group relative",
                                        isActive
                                            ? "text-primary bg-primary/10"
                                            : "text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                                    )}
                                >
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full" />
                                    )}
                                    <Icon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                                    <span className="truncate">{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                
                {/* Overlay Toggle Button (when collapsed) */}
                {collapsed && (
                    <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-[60px] top-4 w-6 h-6 rounded-full bg-background shadow-md border-border/50 z-30"
                        onClick={() => setCollapsed(false)}
                    >
                        <ChevronRight className="w-3 h-3" />
                    </Button>
                )}
            </aside>
        </TooltipProvider>
    );
};

export default Sidebar;
