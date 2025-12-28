import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, X, Minus, AlertTriangle } from "lucide-react";

type CellStatus = "pass" | "partial" | "fail" | "na";

interface HeatmapCell {
  id: string;
  name: string;
  status: CellStatus;
  details?: string;
}

interface HeatmapRow {
  category: string;
  controls: HeatmapCell[];
}

interface ComplianceHeatmapProps {
  data: HeatmapRow[];
  className?: string;
}

const statusConfig: Record<CellStatus, {
  icon: typeof Check;
  class: string;
  label: string;
}> = {
  pass: {
    icon: Check,
    class: "heatmap-pass",
    label: "Compliant",
  },
  partial: {
    icon: AlertTriangle,
    class: "heatmap-partial",
    label: "Partially Compliant",
  },
  fail: {
    icon: X,
    class: "heatmap-fail",
    label: "Non-Compliant",
  },
  na: {
    icon: Minus,
    class: "heatmap-na",
    label: "Not Applicable",
  },
};

function HeatmapCellComponent({ cell }: { cell: HeatmapCell }) {
  const config = statusConfig[cell.status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "heatmap-cell cursor-pointer transition-transform hover:scale-110",
              config.class
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-card border-border max-w-xs">
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {cell.id}
            </p>
            <p className="font-medium text-sm">{cell.name}</p>
            <p className={cn(
              "text-xs font-medium",
              cell.status === "pass" && "text-emerald-400",
              cell.status === "partial" && "text-yellow-400",
              cell.status === "fail" && "text-red-400",
              cell.status === "na" && "text-muted-foreground"
            )}>
              {config.label}
            </p>
            {cell.details && (
              <p className="text-xs text-muted-foreground mt-1">{cell.details}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ComplianceHeatmap({ data, className }: ComplianceHeatmapProps) {
  // Calculate summary stats
  const allCells = data.flatMap(row => row.controls);
  const stats = {
    pass: allCells.filter(c => c.status === "pass").length,
    partial: allCells.filter(c => c.status === "partial").length,
    fail: allCells.filter(c => c.status === "fail").length,
    na: allCells.filter(c => c.status === "na").length,
  };
  const applicable = stats.pass + stats.partial + stats.fail;
  const complianceRate = applicable > 0 ? Math.round((stats.pass / applicable) * 100) : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {Object.entries(statusConfig).map(([status, config]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={cn("w-3 h-3 rounded", config.class)} />
              <span className="text-xs text-muted-foreground">{config.label}</span>
              <span className="font-mono text-xs font-medium text-foreground">
                {stats[status as CellStatus]}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Compliance Rate:</span>
          <span className={cn(
            "font-mono font-bold",
            complianceRate >= 80 && "text-emerald-400",
            complianceRate >= 60 && complianceRate < 80 && "text-yellow-400",
            complianceRate < 60 && "text-red-400"
          )}>
            {complianceRate}%
          </span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.category} className="flex items-center gap-3">
            {/* Category Label */}
            <div className="w-28 shrink-0">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground truncate block">
                {row.category}
              </span>
            </div>

            {/* Controls Grid */}
            <div className="flex gap-1 flex-wrap">
              {row.controls.map((cell) => (
                <HeatmapCellComponent key={cell.id} cell={cell} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ComplianceHeatmap;
