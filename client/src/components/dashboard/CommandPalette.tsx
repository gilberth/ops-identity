import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  FileText,
  Network,
  Shield,
  Settings,
  Search,
  Download,
  AlertTriangle,
  Clock,
  Building2,
  Zap,
} from "lucide-react";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const navigationItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", keywords: ["home", "overview"] },
  { icon: Users, label: "Identity Analysis", path: "/users", keywords: ["users", "accounts", "privileged"] },
  { icon: FileText, label: "GPO Analysis", path: "/gpo", keywords: ["group policy", "policies"] },
  { icon: Network, label: "DNS & Network", path: "/dns", keywords: ["dns", "dhcp", "network"] },
  { icon: Shield, label: "Reports", path: "/reports", keywords: ["export", "pdf"] },
  { icon: Settings, label: "Configuration", path: "/admin", keywords: ["settings", "admin"] },
];

const quickActions = [
  { icon: Download, label: "New Assessment", path: "/new-assessment", keywords: ["scan", "collect"] },
  { icon: Building2, label: "Switch Organization", path: "/", keywords: ["client", "tenant"] },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(open ?? false);
  const navigate = useNavigate();

  const handleOpenChange = useCallback((value: boolean) => {
    setIsOpen(value);
    onOpenChange?.(value);
  }, [onOpenChange]);

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenChange(!isOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, handleOpenChange]);

  const handleSelect = (path: string) => {
    handleOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
      <Command className="bg-card border-0">
        <div className="flex items-center border-b border-border px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <CommandInput
            placeholder="Search commands, navigate..."
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0"
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>
        <CommandList className="max-h-[400px] p-2">
          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </CommandEmpty>

          <CommandGroup heading="Quick Actions">
            {quickActions.map((item) => (
              <CommandItem
                key={item.path}
                value={`${item.label} ${item.keywords.join(" ")}`}
                onSelect={() => handleSelect(item.path)}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg aria-selected:bg-primary/10"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="font-medium">{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator className="my-2" />

          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.path}
                value={`${item.label} ${item.keywords.join(" ")}`}
                onSelect={() => handleSelect(item.path)}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg aria-selected:bg-primary/10"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                </div>
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>

        <div className="border-t border-border px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
              Select
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-primary" />
            <span className="font-mono">OpsIdentity</span>
          </div>
        </div>
      </Command>
    </CommandDialog>
  );
}

export default CommandPalette;
