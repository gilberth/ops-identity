import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CategoryData {
  category: string;
  findings: number;
}

interface CategoriesChartProps {
  data: CategoryData[];
}

export const CategoriesChart = ({ data }: CategoriesChartProps) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold">{payload[0].payload.category}</p>
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
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="category" 
            className="text-xs"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis className="text-xs" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="findings" fill="#8B5CF6" name="Findings" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};


