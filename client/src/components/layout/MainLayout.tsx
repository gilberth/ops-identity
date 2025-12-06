import React from 'react';
import Sidebar from './Sidebar';
import { Search, Bell, Mail, Command } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MainLayoutProps {
    children: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
            <Sidebar />

            {/* Main Content Wrapper */}
            <main className="pl-64 min-h-screen flex flex-col transition-all duration-300 relative">

                {/* Top Header */}
                <header className="sticky top-0 z-30 flex h-24 items-center justify-between px-8 bg-background/90 backdrop-blur-sm border-b border-gray-100/50">

                    {/* Search Bar */}
                    <div className="relative w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search task"
                            className="h-12 w-full rounded-2xl border-none bg-white shadow-sm ring-1 ring-black/5 pl-12 pr-12 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:shadow-md"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500 flex items-center gap-1">
                            <Command className="h-3 w-3" /> F
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-6">
                        <button className="rounded-full bg-white p-3 text-muted-foreground shadow-sm ring-1 ring-black/5 hover:text-primary hover:shadow-md transition-all">
                            <Mail className="h-5 w-5" />
                        </button>
                        <button className="rounded-full bg-white p-3 text-muted-foreground shadow-sm ring-1 ring-black/5 hover:text-primary hover:shadow-md transition-all relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2.5 right-3 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
                        </button>

                        <div className="flex items-center gap-3 pl-2 border-l ml-2 border-gray-100">
                            <div className="hidden md:block text-right">
                                <p className="text-sm font-bold leading-none text-foreground">Admin User</p>
                                <p className="text-xs text-muted-foreground mt-1">sysadmin@local</p>
                            </div>
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm cursor-pointer ring-1 ring-black/5">
                                <AvatarImage src="https://github.com/shadcn.png" />
                                <AvatarFallback>AD</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-8 pt-6">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
