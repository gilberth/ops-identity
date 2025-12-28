import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface SeverityBarProps {
  counts: SeverityCounts;
  className?: string;
  showLabels?: boolean;
  height?: "sm" | "md" | "lg";
}

const severityConfig = {
  critical: {
    label: "Critical",
    color: "bg-red-500",
    textColor: "text-red-400",
    glowColor: "shadow-red-500/50",
  },
  high: {
    label: "High",
    color: "bg-orange-500",
    textColor: "text-orange-400",
    glowColor: "shadow-orange-500/50",
  },
  medium: {
    label: "Medium",
    color: "bg-yellow-500",
    textColor: "text-yellow-400",
    glowColor: "shadow-yellow-500/50",
  },
  low: {
    label: "Low",
    color: "bg-cyan-500",
    textColor: "text-cyan-400",
    glowColor: "shadow-cyan-500/50",
  },
};

const heightClasses = {
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
};

export function SeverityBar({
  counts,
  className,
  showLabels = true,
  height = "md",
}: SeverityBarProps) {
  const total = counts.critical + counts.high + counts.medium + counts.low;

  if (total === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className={cn("w-full bg-secondary rounded-full overflow-hidden", heightClasses[height])}>
          <div className="h-full bg-emerald-500/30 w-full flex items-center justify-center">
            <span className="text-[10px] font-mono text-emerald-400">NO ISSUES</span>
          </div>
        </div>
      </div>
    );
  }

  const getPercentage = (count: number) => (count / total) * 100;

  return (
    <TooltipProvider>
      <div className={cn("space-y-3", className)}>
        {/* Stacked Bar */}
        <div className={cn("w-full bg-secondary rounded-full overflow-hidden flex", heightClasses[height])}>
          {(Object.keys(severityConfig) as Array<keyof SeverityCounts>).map((severity) => {
            const count = counts[severity];
            const percentage = getPercentage(count);
            const config = severityConfig[severity];

            if (count === 0) return null;

            return (
              <Tooltip key={severity}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "h-full transition-all duration-500 cursor-pointer hover:brightness-125",
                      config.color
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-card border-border">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", config.color)} />
                    <span className="font-mono text-xs">
                      {count} {config.label}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Labels */}
        {showLabels && (
          <div className="flex items-center justify-between gap-4">
            {(Object.keys(severityConfig) as Array<keyof SeverityCounts>).map((severity) => {
              const count = counts[severity];
              const config = severityConfig[severity];

              return (
                <div key={severity} className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", config.color)} />
                  <span className="text-xs text-muted-foreground">{config.label}</span>
                  <span className={cn("font-mono text-sm font-bold tabular-nums", config.textColor)}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Total Findings
          </span>
          <span className="font-display font-bold text-lg text-foreground">
            {total}
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default SeverityBar;
