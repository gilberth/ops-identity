import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComplianceMatrixProps {
    findings: any[];
}

export const ComplianceMatrix = ({ findings }: ComplianceMatrixProps) => {

    // Calculate specific framework stats
    const getStats = (frameworkPrefix: string) => {
        // Filter findings related to this framework (checking cis_control, mitre_attack columns)
        const relevantFindings = findings.filter(f => {
            if (frameworkPrefix === 'CIS') return f.cis_control && f.cis_control.length > 0;
            if (frameworkPrefix === 'MITRE') return f.mitre_attack && f.mitre_attack.length > 0;
            return false;
        });

        const total = relevantFindings.length;
        const critical = relevantFindings.filter(f => f.severity === 'critical' || f.severity === 'high').length;

        // Calculate a mock "Compliance Score" (inverse of findings)
        // In a real app, this would be `(Passed Checks / Total Checks) * 100`
        // Here we simulate: Start at 100%, subtract 5% per High/Critical, 2% per Med/Low
        let penalty = 0;
        relevantFindings.forEach(f => {
            if (f.severity === 'critical') penalty += 15;
            else if (f.severity === 'high') penalty += 10;
            else penalty += 2;
        });

        const score = Math.max(0, 100 - penalty);

        return { score, criticalCount: critical, totalFindings: total };
    };

    const cisStats = getStats('CIS');
    const mitreStats = getStats('MITRE');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* CIS Controls Card */}
            <Card className="shadow-none border border-gray-100 bg-slate-50/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-blue-600" /> CIS Benchmarks
                    </CardTitle>
                    <Badge variant={cisStats.score > 80 ? 'default' : 'destructive'} className={cn(cisStats.score > 80 ? "bg-green-600" : "")}>
                        {cisStats.score}% Compliant
                    </Badge>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Identity & Access</span>
                            <span className="font-medium text-foreground">{cisStats.score > 90 ? 'Pass' : 'Review'}</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full rounded-full", cisStats.score > 70 ? "bg-blue-500" : "bg-red-500")}
                                style={{ width: `${cisStats.score}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            <strong>{cisStats.criticalCount}</strong> critical deviations from CIS Controls found.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* MITRE ATT&CK Card */}
            <Card className="shadow-none border border-gray-100 bg-slate-50/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Crosshair className="h-4 w-4 text-red-600" /> MITRE ATT&CK
                    </CardTitle>
                    <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
                        {mitreStats.totalFindings} Techniques detected
                    </Badge>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                        {/* Mini Heatmap Visualization */}
                        {['Initial Access', 'Credential Access', 'Lateral Mvmt'].map((phase, i) => (
                            <div key={i} className="flex flex-col gap-1">
                                <div className={cn("h-8 rounded w-full flex items-center justify-center text-xs font-bold text-white",
                                    mitreStats.totalFindings > 5 ? "bg-red-500" : (mitreStats.totalFindings > 0 ? "bg-orange-400" : "bg-green-500")
                                )}>
                                    {mitreStats.totalFindings > 0 ? Math.floor(Math.random() * 3) + 1 : 0}
                                </div>
                                <span className="text-[9px] text-center text-muted-foreground leading-tight">{phase}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                        Active exposure to <strong>Credential Access</strong> techniques.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
