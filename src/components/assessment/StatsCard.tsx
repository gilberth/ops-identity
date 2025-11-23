import { LucideIcon } from 'lucide-react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
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
  trend,
}: StatsCardProps) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    const TrendIcon = trend.isPositive ? ArrowUp : ArrowDown;
    return <TrendIcon className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    return trend.isPositive ? 'text-green-600' : 'text-red-600';
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground mt-2">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      {trend && (
        <div className={`flex items-center mt-2 text-sm ${getTrendColor()}`}>
          {getTrendIcon()}
          <span className="ml-1">{Math.abs(trend.value)}%</span>
        </div>
      )}
    </Card>
  );
};
