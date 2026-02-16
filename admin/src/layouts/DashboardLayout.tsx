import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const pageNames: Record<string, string> = {
    '/': 'Dashboard',
    '/analytics': 'Analytics',
    '/users': 'User Management',
    '/problems': 'Problem Management',
    '/categories': 'Categories',
    '/patterns': 'Patterns',
    '/roadmaps': 'Roadmaps',
    '/tasks': 'Task Assignment',
    '/feedback': 'Feedback',
    '/referrals': 'Referrals',
    '/plans': 'Subscription Plans',
    '/withdrawals': 'Withdrawals',
    '/leaderboard': 'Leaderboard Config',
    '/ai-config': 'AI Configuration',
    '/settings': 'System Settings',
    '/logs': 'Audit Logs',
};

const DashboardLayout = () => {
    const { user } = useAuth();
    const location = useLocation();

    const getPageName = () => {
        const exact = pageNames[location.pathname];
        if (exact) return exact;
        for (const [path, name] of Object.entries(pageNames)) {
            if (location.pathname.startsWith(path) && path !== '/') return name;
        }
        return 'Dashboard';
    };

    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Header */}
                <header className="h-16 border-b bg-card/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight">{getPageName()}</h1>
                            <p className="text-xs text-muted-foreground">
                                Welcome back, {user?.full_name || 'Admin'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                className="pl-9 w-[200px] h-9 bg-accent/50 border-transparent focus:border-primary/30 text-sm"
                            />
                        </div>
                        <Button variant="ghost" size="icon" className="relative h-9 w-9">
                            <Bell className="h-4 w-4" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
                        </Button>
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
                            {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                    </div>
                </header>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <div className="page-enter">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
