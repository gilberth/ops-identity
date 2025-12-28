import { cn } from "@/lib/utils";
import { Users, Monitor, FolderTree, FileText, Server, Share2 } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface ObjectCount {
  type: string;
  count: number;
  icon: LucideIcon;
}

interface ObjectsAnalyzedProps {
  data: {
    users?: number;
    computers?: number;
    groups?: number;
    gpos?: number;
    dcs?: number;
    trusts?: number;
  };
  className?: string;
}

export function ObjectsAnalyzed({ data, className }: ObjectsAnalyzedProps) {
  const objects: ObjectCount[] = [
    { type: "Users", count: data.users ?? 0, icon: Users },
    { type: "Computers", count: data.computers ?? 0, icon: Monitor },
    { type: "Groups", count: data.groups ?? 0, icon: FolderTree },
    { type: "GPOs", count: data.gpos ?? 0, icon: FileText },
    { type: "DCs", count: data.dcs ?? 0, icon: Server },
    { type: "Trusts", count: data.trusts ?? 0, icon: Share2 },
  ].filter(obj => obj.count > 0);

  const maxCount = Math.max(...objects.map(o => o.count));

  return (
    <div className={cn("space-y-3", className)}>
      {objects.map((obj, index) => {
        const percentage = (obj.count / maxCount) * 100;
        const Icon = obj.icon;

        return (
          <div
            key={obj.type}
            className="flex items-center gap-3 animate-slide-up opacity-0"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: "forwards" }}
          >
            {/* Icon */}
            <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            {/* Label */}
            <div className="w-20 shrink-0">
              <span className="text-xs text-muted-foreground">{obj.type}</span>
            </div>

            {/* Bar */}
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full transition-all duration-700"
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Count */}
            <div className="w-16 text-right shrink-0">
              <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                {obj.count.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}

      {/* Total */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Total Objects
        </span>
        <span className="font-display font-bold text-lg text-primary">
          {objects.reduce((sum, obj) => sum + obj.count, 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default ObjectsAnalyzed;
