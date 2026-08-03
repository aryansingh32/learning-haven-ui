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
    ChevronDown,
    Mail,
    ShieldCheck,
    FlaskConical,
    Map
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';

const navSections = [
    {
        label: 'Overview',
        items: [
            { name: 'Mission Control', href: '/', icon: LayoutDashboard },
            { name: 'Analytics', href: '/analytics', icon: BarChart3 },
        ],
    },
    {
        label: 'Commerce',
        items: [
            { name: 'Revenue', href: '/revenue', icon: TrendingUp },
            { name: 'Plans', href: '/plans', icon: CreditCard },
            { name: 'Coupons', href: '/coupons', icon: Ticket },
            { name: 'Withdrawals', href: '/withdrawals', icon: Wallet },
        ],
    },
    {
        label: 'Content',
        items: [
            { name: 'Visual Roadmap', href: '/roadmap-builder', icon: Map },
            { name: 'Landing Page CMS', href: '/catalog-builder', icon: LayoutTemplate },
            { name: 'Courses', href: '/courses', icon: GitBranch },
            { name: 'Categories', href: '/categories', icon: FileText },
            { name: 'Chapters', href: '/chapters', icon: BookOpen },
            { name: 'Problems', href: '/problems', icon: Code },
            { name: 'Patterns', href: '/patterns', icon: Share2 },
        ],
    },
    {
        label: 'Projects',
        items: [
            { name: 'Build Projects', href: '/build-challenges', icon: Code },
            { name: 'Challenge Users', href: '/build-challenges/users', icon: Users },
            { name: 'Tasks', href: '/tasks', icon: ListTodo },
        ],
    },
    {
        label: 'Jobs & Apprenticeships',
        collapsible: true,
        items: [
            { name: 'Overview', href: '/apprenticeship', icon: GraduationCap },
            { name: 'Programs', href: '/apprenticeship/programs', icon: FileText },
            { name: 'Submissions', href: '/apprenticeship/submissions', icon: Code },
            { name: 'Students', href: '/apprenticeship/students', icon: Users },
            { name: 'Analytics', href: '/apprenticeship/analytics', icon: BarChart3 },
            { name: 'Coupons', href: '/apprenticeship/coupons', icon: CreditCard },
            { name: 'Notifications', href: '/apprenticeship/notifications', icon: MessageSquare },
        ],
    },
    {
        label: 'People',
        items: [
            { name: 'Users', href: '/users', icon: Users },
            { name: 'Permissions', href: '/permissions', icon: ShieldCheck },
            { name: 'Communications', href: '/communications', icon: Mail },
            { name: 'Referrals', href: '/referrals', icon: Zap },
            { name: 'Feedback', href: '/feedback', icon: MessageSquare },
        ],
    },
    {
        label: 'Platform',
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
        ],
    },
];

const Sidebar = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        'Jobs & Apprenticeships': true,
    });

    const toggleSection = (label: string) => {
        setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
    };

    return (
        <aside
            className={cn(
                "flex flex-col h-full border-r bg-card/80 backdrop-blur-xl transition-all duration-300 ease-in-out relative z-20",
                collapsed ? "w-[72px]" : "w-[260px]"
            )}
        >
            {/* Brand */}
            <div className="flex items-center gap-3 px-4 h-14 border-b shrink-0">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-white" />
                </div>
                {!collapsed && (
                    <div className="animate-fade-in">
                        <span className="text-sm font-bold bg-gradient-to-r from-[hsl(234,89%,63%)] to-[hsl(258,90%,66%)] bg-clip-text text-transparent whitespace-nowrap">
                            DSA OS Admin
                        </span>
                        <p className="text-[9px] text-muted-foreground -mt-0.5">v2.0 · Mission Control</p>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
                {navSections.map((section) => {
                    const isCollapsed = section.collapsible && collapsedSections[section.label];
                    const hasActiveChild = section.items.some(item =>
                        item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href)
                    );

                    return (
                        <div key={section.label}>
                            {!collapsed && (
                                <button
                                    onClick={() => section.collapsible && toggleSection(section.label)}
                                    className={cn(
                                        "w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1.5",
                                        section.collapsible && "cursor-pointer hover:text-muted-foreground transition-colors",
                                        hasActiveChild && isCollapsed && "text-primary/60"
                                    )}
                                >
                                    <span>{section.label}</span>
                                    {section.collapsible && (
                                        <ChevronDown className={cn("w-3 h-3 transition-transform", !isCollapsed && "rotate-180")} />
                                    )}
                                </button>
                            )}
                            {(!section.collapsible || !isCollapsed) && (
                                <div className="space-y-0.5">
                                    {section.items.map((item) => {
                                        const Icon = item.icon;
                                        const isActive =
                                            item.href === '/'
                                                ? location.pathname === '/'
                                                : location.pathname.startsWith(item.href);

                                        return (
                                            <Link
                                                key={item.href}
                                                to={item.href}
                                                title={collapsed ? item.name : undefined}
                                                className={cn(
                                                    "nav-item flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200",
                                                    isActive
                                                        ? "active bg-primary/10 text-primary"
                                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                                )}
                                            >
                                                <Icon className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
                                                {!collapsed && (
                                                    <span className="truncate">{item.name}</span>
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* User & Collapse */}
            <div className="border-t px-2 py-2 space-y-1.5 shrink-0">
                {!collapsed && (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/50 animate-fade-in">
                        <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{user?.full_name || 'Admin'}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{user?.role}</p>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors text-xs",
                            collapsed ? "w-full justify-center" : "flex-1 justify-start"
                        )}
                        onClick={logout}
                    >
                        <LogOut className="w-3.5 h-3.5 shrink-0" />
                        {!collapsed && <span className="ml-2">Logout</span>}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                    </Button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
