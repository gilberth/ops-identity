import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Network, Shield, Download, Settings, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useClient } from '@/context/ClientContext';

export const Sidebar = () => {
    const location = useLocation();
    const { currentClient, clearClient } = useClient();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Users, label: 'Users', path: '/users' },
        { icon: FileText, label: 'GPO Analysis', path: '/gpo' },
        { icon: Network, label: 'DNS & Network', path: '/dns' },
        { icon: Shield, label: 'Reports', path: '/reports' },
        { icon: Settings, label: 'Configuration', path: '/admin' },
    ];

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-100 bg-white shadow-sm flex flex-col">
            {/* Logo Area */}
            <div className="flex h-24 items-center px-8 flex-shrink-0">
                <Link to="/dashboard" className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                        <span className="font-bold text-lg">Op</span>
                    </div>
                    <span className="font-bold text-xl tracking-tight text-foreground font-sans">
                        OpsIdentity
                    </span>
                </Link>
            </div>

            {/* Client Context Card */}
            <div className="px-6 pb-2 flex-shrink-0">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="h-3 w-3 text-slate-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            CLIENTE ACTUAL
                        </span>
                    </div>
                    <p className="font-bold text-slate-800 truncate" title={currentClient?.name}>
                        {currentClient?.name || "Seleccione..."}
                    </p>
                    <Link
                        to="/"
                        onClick={() => clearClient()}
                        className="text-xs text-primary font-medium hover:underline mt-1 block"
                    >
                        Cambiar Empresa →
                    </Link>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2 px-4 py-4 overflow-y-auto">
                <p className="px-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4 ml-1">
                    Menu
                </p>

                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200",
                                isActive
                                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                                    : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Card - 'Download App' style */}
            <div className="p-4 mt-auto mb-4 flex-shrink-0">
                <div className="relative overflow-hidden rounded-3xl bg-[#0f172a] p-6 text-white shadow-xl">
                    {/* Abstract curve background */}
                    <div className="absolute right-[-20px] top-[-20px] h-32 w-32 rounded-full border-[10px] border-white/5 opacity-50" />
                    <div className="absolute right-[-10px] bottom-[-30px] h-32 w-32 rounded-full border-[10px] border-white/5 opacity-50" />

                    <div className="relative z-10 flex flex-col items-start gap-4">
                        <div className="rounded-full bg-white/20 p-2.5 backdrop-blur-sm">
                            <Download className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-lg leading-tight">Download Agent</p>
                            <p className="text-xs text-white/60 mt-1 font-medium">Get the collector script</p>
                        </div>
                        <Link to="/new-assessment" className="w-full">
                            <Button size="sm" className="w-full bg-primary hover:bg-primary-hover text-white font-semibold border-none rounded-xl mt-1 h-10">
                                Download
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </aside>
    );
};

// Export active for now to satisfy imports
export default Sidebar;
