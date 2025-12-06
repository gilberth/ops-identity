import { LucideIcon } from 'lucide-react';
import { ArrowUp, ArrowDown, MoveUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type CardVariant = 'default' | 'critical' | 'high' | 'info' | 'success' | 'primary';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  variant?: CardVariant;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export const StatsCard = ({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
  trend,
}: StatsCardProps) => {

  const isPrimary = variant === 'primary' || variant === 'info'; // 'info' maps to primary for backward compat

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 rounded-[2rem]",
      isPrimary
        ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 border-none"
        : "bg-white text-card-foreground shadow-soft border-none hover:shadow-lg"
    )}>
      <div className="p-6 h-full flex flex-col justify-between min-h-[160px]">
        <div className="flex items-start justify-between">
          <div>
            <p className={cn("text-sm font-semibold tracking-wide mb-1", isPrimary ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {title}
            </p>
            <h3 className={cn("text-4xl font-bold tracking-tight", isPrimary ? "text-white" : "text-foreground")}>
              {value}
            </h3>
          </div>

          <div className={cn(
            "rounded-full p-2.5 transition-all text-white",
            isPrimary
              ? "bg-white/20 hover:bg-white/30"
              : "bg-gray-100/50 hover:bg-gray-100 text-gray-400"
          )}>
            <MoveUpRight className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-bold rounded-full px-2 py-1",
              isPrimary
                ? "bg-black/20 text-white"
                : trend.isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}>
              {trend.isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              <span>{trend.value}%</span>
              <span className={cn("font-medium ml-1", isPrimary ? "text-white/70" : "text-muted-foreground")}>
                {trend.isPositive ? "Increased" : "Decreased"}
              </span>
            </div>
          )}
          {!trend && description && (
            <p className={cn("text-xs font-medium", isPrimary ? "text-white/60" : "text-muted-foreground")}>
              {description}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};
