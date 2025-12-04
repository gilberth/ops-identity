import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface MaturityRadarProps {
    findings: any[];
}

export const MaturityRadar = ({ findings }: MaturityRadarProps) => {
    // Calculate maturity based on findings
    // This is a simplified logic. In a real app, you'd map specific findings to domains.
    const calculateDomainScore = (domain: string) => {
        // Filter findings that might belong to this domain (simple keyword match for demo)
        const domainFindings = findings.filter(f =>
            f.title.toLowerCase().includes(domain.toLowerCase()) ||
            f.description.toLowerCase().includes(domain.toLowerCase())
        );

        // Base score 100, deduct based on severity
        let score = 100;
        domainFindings.forEach(f => {
            if (f.severity === 'critical') score -= 20;
            else if (f.severity === 'high') score -= 10;
            else if (f.severity === 'medium') score -= 5;
        });

        return Math.max(0, score);
    };

    const categories = [
        { subject: 'Identity', A: calculateDomainScore('user') },
        { subject: 'Infrastructure', A: calculateDomainScore('computer') },
        { subject: 'GPO', A: calculateDomainScore('gpo') },
        { subject: 'DNS', A: calculateDomainScore('dns') },
        { subject: 'Kerberos', A: calculateDomainScore('kerberos') },
        { subject: 'Privileged', A: calculateDomainScore('admin') },
    ];

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Nivel de Madurez</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={categories}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                            name="Madurez"
                            dataKey="A"
                            stroke="#8884d8"
                            fill="#8884d8"
                            fillOpacity={0.6}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};
