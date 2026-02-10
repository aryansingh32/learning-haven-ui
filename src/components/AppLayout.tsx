import { NavLink as RouterNavLink } from "react-router-dom";
import { 
  LayoutDashboard, BookOpen, Eye, Bot, Gift, Award, User,
  Menu, X, Moon, Sun
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";

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
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen gradient-warm transition-colors duration-300">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="fixed left-0 top-0 bottom-0 w-[260px] card-glass z-30 flex flex-col border-r border-border/50">
          <div className="p-6 border-b border-border/50">
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
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </RouterNavLink>
            ))}
          </nav>
          {/* Theme toggle + User */}
          <div className="p-3 border-t border-border/50">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-all"
            >
              {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </button>
          </div>
          <div className="p-4 border-t border-border/50">
            <RouterNavLink to="/profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/80 transition-colors">
              <div className="h-9 w-9 rounded-xl gradient-golden flex items-center justify-center text-primary-foreground font-display font-bold text-sm shadow-sm">
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
        <header className="fixed top-0 left-0 right-0 h-14 card-glass z-30 flex items-center justify-between px-4 border-b border-border/50">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl hover:bg-secondary transition-colors">
              {sidebarOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
            </button>
            <h1 className="ml-3 font-display text-lg font-bold text-foreground">
              <span className="text-gradient-golden">DSA</span> OS
            </h1>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-secondary transition-colors">
            {theme === "light" ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
          </button>
        </header>
      )}

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-64 card-glass z-50 shadow-card-hover flex flex-col border-r border-border/50"
            >
              <div className="p-6 border-b border-border/50">
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
                          : "text-muted-foreground hover:bg-secondary/80"
                      )
                    }
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </RouterNavLink>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 card-glass border-t border-border/50 z-30 flex justify-around py-2 px-1 safe-area-bottom">
          {navItems.slice(0, 5).map((item) => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all duration-200",
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
        "min-h-screen transition-all duration-300",
        isMobile ? "pt-14 pb-20 px-4" : "ml-[260px] p-6 lg:p-8"
      )}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          key={typeof window !== "undefined" ? window.location.pathname : ""}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
