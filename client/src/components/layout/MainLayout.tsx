import React from 'react';
import Sidebar from './Sidebar';
import { Search, Bell, Settings, Terminal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MainLayoutProps {
    children: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
            {/* Background effects */}
            <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
            <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

            <Sidebar />

            {/* Main Content Wrapper */}
            <main className="pl-64 min-h-screen flex flex-col transition-all duration-300 relative">

                {/* Top Header */}
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between px-6 bg-[hsl(222,47%,6%)]/80 backdrop-blur-xl border-b border-white/5">

                    {/* Search Bar */}
                    <div className="relative w-80 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                        <Input
                            placeholder="Search assessments, findings..."
                            className="h-9 w-full rounded-lg border-white/10 bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500/30 transition-all"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 flex items-center gap-1">
                            <Terminal className="h-2.5 w-2.5" /> /
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                        {/* Notifications */}
                        <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-cyan-400 border-2 border-[hsl(222,47%,6%)]" />
                        </button>

                        {/* Settings */}
                        <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                            <Settings className="h-5 w-5" />
                        </button>

                        {/* Divider */}
                        <div className="h-6 w-px bg-white/10 mx-2" />

                        {/* User */}
                        <div className="flex items-center gap-3">
                            <div className="hidden md:block text-right">
                                <p className="text-sm font-semibold text-white leading-none">Admin User</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">sysadmin@local</p>
                            </div>
                            <Avatar className="h-8 w-8 border border-white/10 cursor-pointer hover:border-cyan-500/50 transition-colors">
                                <AvatarImage src="https://github.com/shadcn.png" />
                                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-emerald-500 text-[hsl(222,47%,6%)] text-xs font-bold">
                                    AD
                                </AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-6 relative">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
