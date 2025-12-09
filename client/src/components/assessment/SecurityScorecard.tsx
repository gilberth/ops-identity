import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

interface SecurityScorecardProps {
    findings: any[];
}

export const SecurityScorecard = ({ findings }: SecurityScorecardProps) => {
    // Calculate score
    let score = 100;
    const criticals = findings.filter(f => f.severity === 'critical').length;
    const highs = findings.filter(f => f.severity === 'high').length;
    const mediums = findings.filter(f => f.severity === 'medium').length;
    const lows = findings.filter(f => f.severity === 'low').length;

    score -= (criticals * 15);
    score -= (highs * 10);
    score -= (mediums * 5);
    score -= (lows * 1);
    if (score < 0) score = 0;

    const getGrade = (s: number) => {
        if (s >= 90) return { grade: 'A', color: 'text-green-500', label: 'Excelente' };
        if (s >= 80) return { grade: 'B', color: 'text-blue-500', label: 'Bueno' };
        if (s >= 70) return { grade: 'C', color: 'text-yellow-500', label: 'Regular' };
        if (s >= 60) return { grade: 'D', color: 'text-orange-500', label: 'Deficiente' };
        return { grade: 'F', color: 'text-red-500', label: 'Crítico' };
    };

    const { grade, color, label } = getGrade(score);

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Identity Hygiene Scorecard
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
                <div className={`text-6xl font-bold mb-2 ${color}`}>{grade}</div>
                <div className="text-2xl font-semibold mb-6">{label} ({Math.round(score)}/100)</div>

                <div className="w-full space-y-4">
                    <div className="flex justify-between text-sm">
                        <span>Críticos ({criticals})</span>
                        <span className="text-red-500 font-bold">-{criticals * 15} pts</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>Altos ({highs})</span>
                        <span className="text-orange-500 font-bold">-{highs * 10} pts</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>Medios ({mediums})</span>
                        <span className="text-yellow-500 font-bold">-{mediums * 5} pts</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
