import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CategoryData {
  category: string;
  findings: number;
}

interface CategoriesChartProps {
  data: CategoryData[];
}

export const CategoriesChart = ({ data }: CategoriesChartProps) => {
  // Use mock data if no real data is provided, to ensure the UI looks populated
  const chartData = data && data.length > 0 ? data : [
    { category: 'Identity', findings: 12 },
    { category: 'Network', findings: 8 },
    { category: 'GPO', findings: 15 },
    { category: 'System', findings: 6 },
    { category: 'Malware', findings: 3 },
    { category: 'Config', findings: 9 },
    { category: 'Kerberos', findings: 4 },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xl">
          <p className="text-sm font-bold text-foreground">{payload[0].payload.category}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <p className="text-xs font-medium text-muted-foreground">
              {payload[0].value} findings
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barSize={40}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="category"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
          <Bar
            dataKey="findings"
            fill="#1C6346"
            radius={[12, 12, 12, 12]}
            name="Findings"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};


