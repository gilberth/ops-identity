import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TrendData {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface TrendChartProps {
  data: TrendData[];
}

export const TrendChart = ({ data }: TrendChartProps) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="critical" 
            stroke="#DC2626" 
            strokeWidth={2}
            name="Critical"
          />
          <Line 
            type="monotone" 
            dataKey="high" 
            stroke="#EA580C" 
            strokeWidth={2}
            name="High"
          />
          <Line 
            type="monotone" 
            dataKey="medium" 
            stroke="#F59E0B" 
            strokeWidth={2}
            name="Medium"
          />
          <Line 
            type="monotone" 
            dataKey="low" 
            stroke="#10B981" 
            strokeWidth={2}
            name="Low"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};


