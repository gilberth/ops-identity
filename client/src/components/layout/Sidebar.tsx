import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useClient } from "@/context/ClientContext";
import {
  LayoutDashboard,
  Users,
  FileText,
  Network,
  Shield,
  Download,
  Settings,
  ChevronRight,
  Terminal,
  Activity,
  Building2,
  LogOut,
} from "lucide-react";

export const Sidebar = () => {
  const location = useLocation();
  const { currentClient, clearClient } = useClient();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Identity", path: "/users" },
    { icon: FileText, label: "GPO Analysis", path: "/gpo" },
    { icon: Network, label: "DNS & Network", path: "/dns" },
    { icon: Shield, label: "Reports", path: "/reports" },
    { icon: Settings, label: "Admin", path: "/admin" },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 bg-[hsl(220,20%,5%)] border-r border-border flex flex-col">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-grid-tactical opacity-20 pointer-events-none" />

      {/* Logo */}
      <div className="relative flex h-16 items-center px-5 border-b border-border shrink-0">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Terminal className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-sm tracking-wide text-foreground">
              OPSIDENTITY
            </span>
            <span className="text-[9px] font-mono text-primary uppercase tracking-[0.2em]">
              Hygiene Platform
            </span>
          </div>
        </Link>
      </div>

      {/* Active Client */}
      <div className="relative px-3 py-4 shrink-0">
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-accent pulse-live" />
            <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
              Active Organization
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="font-medium text-sm text-foreground truncate">
                {currentClient?.name || "Select client..."}
              </p>
            </div>
          </div>
          <Link
            to="/"
            onClick={() => clearClient()}
            className="inline-flex items-center gap-1 text-[10px] text-primary font-medium hover:text-primary/80 mt-2 transition-colors group"
          >
            <LogOut className="h-3 w-3" />
            Switch
            <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-3 py-2 overflow-y-auto scrollbar-tactical">
        <p className="px-3 mb-2 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Navigation
        </p>

        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "nav-item",
                  isActive && "nav-item-active"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{item.label}</span>
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* New Assessment CTA */}
      <div className="relative p-3 shrink-0">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 p-4">
          {/* Decorative glow */}
          <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-primary/20 blur-xl" />

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/20">
                <Activity className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">New Scan</p>
                <p className="text-[10px] text-muted-foreground">Run assessment</p>
              </div>
            </div>

            <Link to="/new-assessment" className="block">
              <Button
                size="sm"
                className="w-full btn-primary h-8 text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-2" />
                Get Script
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="relative px-4 py-3 border-t border-border">
        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
          <span>v3.0.8</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            Connected
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
