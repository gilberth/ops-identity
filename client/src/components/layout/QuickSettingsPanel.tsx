import { useState, useEffect } from "react";
import { Settings, Moon, Sun, Monitor, Cpu, Zap, Database, RefreshCw, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface AIConfig {
  provider: string;
  model: string;
  status: "connected" | "disconnected" | "error";
}

const QuickSettingsPanel = () => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: "openai",
    model: "gpt-4o-mini",
    status: "disconnected",
  });
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  // Fetch AI config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/ai/config");
        if (response.ok) {
          const data = await response.json();
          setAiConfig({
            provider: data.provider || "openai",
            model: data.model || "gpt-4o-mini",
            status: data.apiKeyConfigured ? "connected" : "disconnected",
          });
        }
      } catch (error) {
        setAiConfig((prev) => ({ ...prev, status: "error" }));
      }
    };

    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const checkAIConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const response = await fetch("/api/ai/test");
      if (response.ok) {
        setAiConfig((prev) => ({ ...prev, status: "connected" }));
        toast({
          title: "Connection successful",
          description: `${aiConfig.provider} API is responding correctly.`,
        });
      } else {
        setAiConfig((prev) => ({ ...prev, status: "error" }));
        toast({
          title: "Connection failed",
          description: "Unable to connect to AI provider.",
          variant: "destructive",
        });
      }
    } catch {
      setAiConfig((prev) => ({ ...prev, status: "error" }));
      toast({
        title: "Connection error",
        description: "Network error while testing connection.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const themeOptions = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ] as const;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-emerald-400";
      case "error":
        return "text-red-400";
      default:
        return "text-yellow-400";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-emerald-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Settings className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Settings className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Quick Settings</h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Theme Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Theme
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                    theme === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <option.icon className="h-4 w-4" />
                  <span className="text-[10px] font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* AI Provider Status */}
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              AI Analysis Engine
            </Label>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium capitalize">
                    {aiConfig.provider}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full animate-pulse",
                      getStatusBg(aiConfig.status)
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-mono capitalize",
                      getStatusColor(aiConfig.status)
                    )}
                  >
                    {aiConfig.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Model:</span>
                <span className="font-mono text-foreground">{aiConfig.model}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={checkAIConnection}
                disabled={isCheckingConnection}
              >
                {isCheckingConnection ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/admin" onClick={() => setIsOpen(false)}>
                <Button variant="outline" size="sm" className="w-full h-9 text-xs">
                  <Database className="h-3.5 w-3.5 mr-1.5" />
                  Admin Panel
                </Button>
              </Link>
              <Link to="/new-assessment" onClick={() => setIsOpen(false)}>
                <Button variant="outline" size="sm" className="w-full h-9 text-xs">
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  New Scan
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-t border-border bg-secondary/30">
          <Link
            to="/admin"
            className="text-xs text-primary hover:underline flex items-center justify-center gap-1"
            onClick={() => setIsOpen(false)}
          >
            <Settings className="h-3 w-3" />
            All Settings
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default QuickSettingsPanel;
