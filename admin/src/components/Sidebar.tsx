import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    Code,
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
    Zap
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';

const navSections = [
    {
        label: 'Overview',
        items: [
            { name: 'Dashboard', href: '/', icon: LayoutDashboard },
            { name: 'Analytics', href: '/analytics', icon: BarChart3 },
        ],
    },
    {
        label: 'Content',
        items: [
            { name: 'Problems', href: '/problems', icon: Code },
            { name: 'Categories', href: '/categories', icon: FileText },
            { name: 'Patterns', href: '/patterns', icon: Share2 },
            { name: 'Roadmaps', href: '/roadmaps', icon: GitBranch },
            { name: 'Tasks', href: '/tasks', icon: ListTodo },
        ],
    },
    {
        label: 'People',
        items: [
            { name: 'Users', href: '/users', icon: Users },
            { name: 'Feedback', href: '/feedback', icon: MessageSquare },
            { name: 'Referrals', href: '/referrals', icon: Zap },
        ],
    },
    {
        label: 'Finance',
        items: [
            { name: 'Plans', href: '/plans', icon: CreditCard },
            { name: 'Withdrawals', href: '/withdrawals', icon: DollarSign },
        ],
    },
    {
        label: 'System',
        items: [
            { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
            { name: 'AI Config', href: '/ai-config', icon: Bot },
            { name: 'Settings', href: '/settings', icon: Settings },
            { name: 'Audit Logs', href: '/logs', icon: Shield },
        ],
    },
];

const Sidebar = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "flex flex-col h-full border-r bg-card/80 backdrop-blur-xl transition-all duration-300 ease-in-out relative z-20",
                collapsed ? "w-[72px]" : "w-[280px]"
            )}
        >
            {/* Brand */}
            <div className="flex items-center gap-3 px-5 h-16 border-b shrink-0">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-white" />
                </div>
                {!collapsed && (
                    <span className="text-lg font-bold bg-gradient-to-r from-[hsl(234,89%,63%)] to-[hsl(258,90%,66%)] bg-clip-text text-transparent whitespace-nowrap animate-fade-in">
                        Learning Haven
                    </span>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
                {navSections.map((section) => (
                    <div key={section.label}>
                        {!collapsed && (
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-2">
                                {section.label}
                            </p>
                        )}
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
                                            "nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
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
                    </div>
                ))}
            </nav>

            {/* User & Collapse */}
            <div className="border-t px-3 py-3 space-y-2 shrink-0">
                {!collapsed && (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/50 animate-fade-in">
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{user?.full_name || 'Admin'}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{user?.role}</p>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors",
                            collapsed ? "w-full justify-center" : "flex-1 justify-start"
                        )}
                        onClick={logout}
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="ml-2">Logout</span>}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
