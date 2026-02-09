import { NavLink as RouterNavLink } from "react-router-dom";
import { 
  LayoutDashboard, BookOpen, Eye, Bot, Gift, Award, User,
  Menu, X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/topics", icon: BookOpen, label: "Learn" },
  { to: "/visualizer", icon: Eye, label: "Visualizer" },
  { to: "/ai-coach", icon: Bot, label: "AI" },
  { to: "/referrals", icon: Gift, label: "Referrals" },
  { to: "/certificates", icon: Award, label: "Certificates" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen gradient-warm">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-card border-r border-border z-30 flex flex-col">
          <div className="p-6 border-b border-border">
            <h1 className="font-display text-xl font-bold text-foreground tracking-tight">
              <span className="text-gradient-golden">DSA</span> OS
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Master Algorithms</p>
          </div>
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => (
              <RouterNavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </RouterNavLink>
            ))}
          </nav>
          {/* User badge at bottom */}
          <div className="p-4 border-t border-border">
            <RouterNavLink to="/profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary transition-colors">
              <div className="h-9 w-9 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-sm">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Arjun Sharma</p>
                <p className="text-[10px] text-muted-foreground">Level 8 • 2,150 XP</p>
              </div>
            </RouterNavLink>
          </div>
        </aside>
      )}

      {/* Mobile Top Bar */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur-md border-b border-border z-30 flex items-center px-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl hover:bg-secondary transition-colors">
            {sidebarOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
          </button>
          <h1 className="ml-3 font-display text-lg font-bold text-foreground">
            <span className="text-gradient-golden">DSA</span> OS
          </h1>
        </header>
      )}

      {/* Mobile Drawer */}
      {isMobile && sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card z-50 shadow-card-hover flex flex-col animate-fade-in">
            <div className="p-6 border-b border-border">
              <h1 className="font-display text-xl font-bold text-foreground">
                <span className="text-gradient-golden">DSA</span> OS
              </h1>
            </div>
            <nav className="flex-1 p-3 space-y-0.5">
              {navItems.map((item) => (
                <RouterNavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary"
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {item.label}
                </RouterNavLink>
              ))}
            </nav>
          </aside>
        </>
      )}

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-30 flex justify-around py-2 px-1 safe-area-bottom">
          {navItems.slice(0, 5).map((item) => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </RouterNavLink>
          ))}
        </nav>
      )}

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all",
        isMobile ? "pt-14 pb-20 px-4" : "ml-[260px] p-6 lg:p-8"
      )}>
        {children}
      </main>
    </div>
  );
}
