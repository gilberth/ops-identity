import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SeverityData {
  name: string;
  value: number;
  color: string;
}

interface SeverityChartProps {
  data: SeverityData[];
}

const COLORS = {
  critical: '#DC2626', // red-600
  high: '#EA580C', // orange-600
  medium: '#F59E0B', // amber-500
  low: '#10B981', // emerald-500
};

export const SeverityChart = ({ data }: SeverityChartProps) => {
  const chartData = (data || []).map(item => ({
    ...item,
    color: COLORS[item.name.toLowerCase() as keyof typeof COLORS] || '#6B7280'
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} findings
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {(chartData || []).map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};


