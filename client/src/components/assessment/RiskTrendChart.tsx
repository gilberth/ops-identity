import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Area, AreaChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RiskTrendChartProps {
    data?: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-[1rem] border border-gray-100 bg-white p-3 shadow-soft">
                <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                        Score:
                    </span>
                    <span className="font-bold text-foreground">
                        {payload[0].value}%
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

export function RiskTrendChart({ data }: RiskTrendChartProps) {
    // Mock data if none provided
    const chartData = data || [
        { date: "Jan 01", score: 65 },
        { date: "Jan 15", score: 68 },
        { date: "Feb 01", score: 72 },
        { date: "Feb 15", score: 70 },
        { date: "Mar 01", score: 75 },
        { date: "Mar 15", score: 82 },
        { date: "Apr 01", score: 85 },
    ];

    return (
        <Card className="col-span-1 h-full rounded-[2rem] border-none shadow-soft bg-white">
            <CardHeader className="pb-4 pt-6 px-6">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    Security Score Trend
                    <span className="text-xs font-normal text-muted-foreground bg-gray-100 px-2 py-1 rounded-full">Last 90 Days</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                dy={10}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                domain={[0, 100]}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 2 }} />
                            <Area
                                type="monotone"
                                dataKey="score"
                                stroke="hsl(var(--primary))"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorScore)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
