import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CategoryHealthCardProps {
  name: string;
  score: number;
  issues: number;
  icon: LucideIcon;
  trend?: number;
  className?: string;
  onClick?: () => void;
}

const getScoreColor = (score: number) => {
  if (score >= 90) return {
    progress: "bg-emerald-500",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/20",
    bg: "bg-emerald-500/5",
  };
  if (score >= 75) return {
    progress: "bg-green-400",
    text: "text-green-400",
    glow: "shadow-green-500/20",
    bg: "bg-green-500/5",
  };
  if (score >= 60) return {
    progress: "bg-yellow-400",
    text: "text-yellow-400",
    glow: "shadow-yellow-500/20",
    bg: "bg-yellow-500/5",
  };
  if (score >= 40) return {
    progress: "bg-orange-500",
    text: "text-orange-400",
    glow: "shadow-orange-500/20",
    bg: "bg-orange-500/5",
  };
  return {
    progress: "bg-red-500",
    text: "text-red-400",
    glow: "shadow-red-500/20",
    bg: "bg-red-500/5",
  };
};

export function CategoryHealthCard({
  name,
  score,
  issues,
  icon: Icon,
  trend,
  className,
  onClick,
}: CategoryHealthCardProps) {
  const colors = getScoreColor(score);

  return (
    <div
      className={cn(
        "group panel p-4 cursor-pointer interactive",
        "hover:border-primary/30",
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "p-2.5 rounded-lg border border-border/50",
            "bg-secondary/50 group-hover:bg-primary/10 transition-colors"
          )}
        >
          <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>

        {/* Score Badge */}
        <div className={cn("px-2 py-1 rounded-md font-mono text-sm font-bold tabular-nums", colors.bg, colors.text)}>
          {score}%
        </div>
      </div>

      {/* Category Name */}
      <h3 className="font-medium text-foreground mb-1 group-hover:text-primary transition-colors">
        {name}
      </h3>

      {/* Issues Count */}
      <p className="text-xs text-muted-foreground mb-3">
        {issues === 0 ? (
          <span className="text-emerald-400">No issues detected</span>
        ) : (
          <span>
            <span className={colors.text}>{issues}</span> issue{issues !== 1 ? "s" : ""} found
          </span>
        )}
      </p>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", colors.progress)}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Trend Indicator */}
      {trend !== undefined && trend !== 0 && (
        <div className="mt-2 flex items-center gap-1">
          <span
            className={cn(
              "text-[10px] font-mono",
              trend > 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
          <span className="text-[10px] text-muted-foreground">vs last scan</span>
        </div>
      )}
    </div>
  );
}

export default CategoryHealthCard;
