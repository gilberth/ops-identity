import React from "react";
import Sidebar from "./Sidebar";
import NotificationsPanel from "./NotificationsPanel";
import QuickSettingsPanel from "./QuickSettingsPanel";
import { User, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background effects */}
      <div className="fixed inset-0 bg-grid-tactical opacity-15 pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3 pointer-events-none" />

      <Sidebar />

      {/* Main Content Wrapper */}
      <main className="pl-60 min-h-screen flex flex-col transition-all duration-300 relative">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end px-6 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center gap-2">
            {/* Notifications Panel */}
            <NotificationsPanel />

            {/* Quick Settings Panel */}
            <QuickSettingsPanel />

            {/* Divider */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary transition-colors">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      OP
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-medium text-foreground leading-none">
                      Operator
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      admin@local
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Operator</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      admin@local
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/" className="text-destructive flex items-center">
                    Sign out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 relative">
          {/* Scanline effect */}
          <div className="scanline pointer-events-none" />
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
