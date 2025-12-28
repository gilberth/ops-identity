import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    FileText,
    Network,
    Shield,
    Download,
    Settings,
    ChevronRight,
    Zap,
    Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useClient } from '@/context/ClientContext';

export const Sidebar = () => {
    const location = useLocation();
    const { currentClient, clearClient } = useClient();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Users, label: 'Identity', path: '/users' },
        { icon: FileText, label: 'GPO Analysis', path: '/gpo' },
        { icon: Network, label: 'DNS & Network', path: '/dns' },
        { icon: Shield, label: 'Reports', path: '/reports' },
        { icon: Settings, label: 'Configuration', path: '/admin' },
    ];

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-[hsl(222,47%,5%)] border-r border-white/5 flex flex-col">
            {/* Animated background pattern */}
            <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

            {/* Logo Area */}
            <div className="relative flex h-20 items-center px-6 flex-shrink-0 border-b border-white/5">
                <Link to="/dashboard" className="flex items-center gap-3 group">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-[hsl(222,47%,6%)] shadow-lg group-hover:shadow-cyan-500/25 transition-shadow duration-300">
                        <Zap className="h-5 w-5" />
                        <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg tracking-tight text-white">
                            OpsIdentity
                        </span>
                        <span className="text-[10px] font-medium text-cyan-400/80 uppercase tracking-widest">
                            Security Platform
                        </span>
                    </div>
                </Link>
            </div>

            {/* Client Context Card */}
            <div className="relative px-4 py-4 flex-shrink-0">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">
                            Active Client
                        </span>
                    </div>
                    <p className="font-semibold text-white truncate text-sm" title={currentClient?.name}>
                        {currentClient?.name || "Select client..."}
                    </p>
                    <Link
                        to="/"
                        onClick={() => clearClient()}
                        className="inline-flex items-center gap-1 text-xs text-cyan-400 font-medium hover:text-cyan-300 mt-2 transition-colors group"
                    >
                        Switch Organization
                        <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>
            </div>

            {/* Navigation */}
            <nav className="relative flex-1 px-3 py-2 overflow-y-auto scrollbar-cyber">
                <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 font-mono">
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
                                    "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400"
                                        : "text-slate-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
                                )}
                            >
                                {/* Glow effect for active item */}
                                {isActive && (
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/10 to-transparent pointer-events-none" />
                                )}

                                <item.icon className={cn(
                                    "h-5 w-5 relative z-10 transition-colors",
                                    isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"
                                )} />

                                <span className="relative z-10">{item.label}</span>

                                {isActive && (
                                    <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Bottom CTA Card */}
            <div className="relative p-4 mt-auto flex-shrink-0">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/20 via-emerald-500/10 to-transparent border border-cyan-500/20 p-5">
                    {/* Decorative elements */}
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
                    <div className="absolute -left-4 -bottom-4 h-16 w-16 rounded-full bg-emerald-400/10 blur-xl" />

                    {/* Grid pattern overlay */}
                    <div className="absolute inset-0 bg-grid-pattern opacity-20" />

                    <div className="relative z-10 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-cyan-400/20 border border-cyan-400/30">
                                <Activity className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-white text-sm">New Assessment</p>
                                <p className="text-xs text-slate-400">Run security scan</p>
                            </div>
                        </div>

                        <Link to="/new-assessment" className="w-full">
                            <Button
                                size="sm"
                                className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-[hsl(222,47%,6%)] font-semibold border-none rounded-lg h-9 shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:shadow-cyan-500/40"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Download Script
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Version indicator */}
            <div className="relative px-4 pb-4">
                <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
                    <span>v2.0.0</span>
                    <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                    </span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
