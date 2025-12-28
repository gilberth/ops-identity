import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

interface CategoryScore {
  category: string;
  score: number;
  fullMark: number;
  issues: number;
}

interface CategoryRadarProps {
  data: CategoryScore[];
  className?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">
        {data.category}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-display font-bold text-primary">
          {data.score}%
        </span>
        <span className="text-xs text-muted-foreground">
          ({data.issues} issues)
        </span>
      </div>
    </div>
  );
};

export function CategoryRadar({ data, className }: CategoryRadarProps) {
  return (
    <div className={cn("w-full h-[300px]", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid
            gridType="polygon"
            stroke="hsl(220 15% 18%)"
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="category"
            tick={{
              fill: "hsl(220 10% 50%)",
              fontSize: 10,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="hsl(185 100% 45%)"
            strokeWidth={2}
            fill="hsl(185 100% 45%)"
            fillOpacity={0.15}
            dot={{
              r: 4,
              fill: "hsl(185 100% 45%)",
              strokeWidth: 0,
            }}
            activeDot={{
              r: 6,
              fill: "hsl(185 100% 55%)",
              stroke: "hsl(185 100% 45%)",
              strokeWidth: 2,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default CategoryRadar;
