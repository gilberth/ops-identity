import { cn } from "@/lib/utils";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type Severity = "critical" | "high" | "medium" | "low";

interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  affectedCount: number;
  cisControl?: string;
  mitreId?: string;
}

interface TopFindingsProps {
  findings: Finding[];
  onViewAll?: () => void;
  onFindingClick?: (finding: Finding) => void;
  className?: string;
}

const severityConfig: Record<Severity, {
  dot: string;
  badge: string;
  label: string;
  order: number;
}> = {
  critical: {
    dot: "dot-critical",
    badge: "badge-critical",
    label: "CRITICAL",
    order: 0,
  },
  high: {
    dot: "dot-high",
    badge: "badge-high",
    label: "HIGH",
    order: 1,
  },
  medium: {
    dot: "dot-medium",
    badge: "badge-medium",
    label: "MEDIUM",
    order: 2,
  },
  low: {
    dot: "dot-low",
    badge: "badge-low",
    label: "LOW",
    order: 3,
  },
};

export function TopFindings({
  findings,
  onViewAll,
  onFindingClick,
  className,
}: TopFindingsProps) {
  // Sort by severity
  const sortedFindings = [...findings].sort(
    (a, b) => severityConfig[a.severity].order - severityConfig[b.severity].order
  );

  return (
    <div className={cn("space-y-3", className)}>
      {sortedFindings.map((finding, index) => {
        const config = severityConfig[finding.severity];

        return (
          <div
            key={finding.id}
            className={cn(
              "finding-row group",
              "animate-slide-up opacity-0"
            )}
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: "forwards" }}
            onClick={() => onFindingClick?.(finding)}
          >
            {/* Severity Indicator */}
            <div className="flex items-center justify-center w-6">
              <div className={cn("w-2.5 h-2.5 rounded-full", config.dot)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Title */}
              <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {finding.title}
              </p>

              {/* Meta */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {finding.category}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-mono font-medium text-foreground">
                    {finding.affectedCount}
                  </span>{" "}
                  affected
                </span>
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {finding.cisControl && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-secondary text-muted-foreground">
                  {finding.cisControl}
                </span>
              )}
              {finding.mitreId && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                  {finding.mitreId}
                </span>
              )}
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase", config.badge)}>
                {config.label}
              </span>
            </div>

            {/* Arrow */}
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        );
      })}

      {/* View All Button */}
      {onViewAll && findings.length > 0 && (
        <Button
          variant="ghost"
          className="w-full mt-2 text-muted-foreground hover:text-primary"
          onClick={onViewAll}
        >
          View All Findings
          <ExternalLink className="w-3.5 h-3.5 ml-2" />
        </Button>
      )}

      {/* Empty State */}
      {findings.length === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">No findings detected</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Your environment is secure
          </p>
        </div>
      )}
    </div>
  );
}

export default TopFindings;
