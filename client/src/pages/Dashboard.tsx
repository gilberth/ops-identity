import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle, ArrowRight, Download, Activity, Users, FileText, Globe, Loader2 } from "lucide-react";
import { CategoriesChart } from "@/components/assessment/CategoriesChart";
import { RiskTrendChart } from "@/components/assessment/RiskTrendChart";
import { api } from "@/utils/api";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Hammer } from "lucide-react";
import { RemediationModal } from "@/components/assessment/RemediationModal";
import { cn } from "@/lib/utils";
import { MaturityRadar } from "@/components/assessment/MaturityRadar";
import { ComplianceMatrix } from "@/components/assessment/ComplianceMatrix";
import { useClient } from "@/context/ClientContext";

const Dashboard = () => {
  const { currentClient } = useClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    score: 0,
    totalFindings: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [topRisks, setTopRisks] = useState<any[]>([]);
  const [categoryScores, setCategoryScores] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [latestAssessment, setLatestAssessment] = useState<any>(null);
  const [allFindings, setAllFindings] = useState<any[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [isRemediationOpen, setIsRemediationOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [currentClient]);

  const loadDashboardData = async () => {
    try {
      const assessments = await api.getAssessments(currentClient?.id);
      if (!assessments || assessments.length === 0) {
        setLoading(false);
        setLatestAssessment(null);
        return;
      }

      // Sort assessments by date desc
      const sorted = assessments.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = sorted[0];
      setLatestAssessment(latest);

      // Fetch raw data for the latest assessment to compute deeper stats
      let rawData: any = {};
      try {
        rawData = await api.getAssessmentData(latest.id);
      } catch (e) {
        console.error("Failed to fetch raw data for dashboard stats", e);
      }

      // --- INTELLIGENCE LAYER ---
      const findings = await api.getFindings(latest.id);
      let critical = 0, high = 0, medium = 0, low = 0;
      let risksList: any[] = [];
      let totalGPOs = 0, modifiedGPOs = 0; // Mock or real if available
      let domainAdmins = 0;
      let staleAccounts = 0;

      if (Array.isArray(findings)) {
        findings.forEach((f: any) => {
          const sev = (f.severity || "medium").toLowerCase();
          if (sev === "critical") critical++;
          else if (sev === "high") high++;
          else if (sev === "medium") medium++;
          else low++;

          // Heuristic extraction for KPIs if not directly available
          if (f.title?.includes("Domain Admin")) domainAdmins++;
          if (f.title?.includes("inactive") || f.title?.includes("stale")) staleAccounts++;

          risksList.push(f);
        });
      }

      // Mocking specific counts if not found in findings (for demo visual)
      const domainInfo = rawData?.domainInfo || {};
      const dcCount = rawData?.dcs?.length || 0;

      const penalty = (critical * 15) + (high * 8) + (medium * 3) + (low * 1);
      let calculatedScore = Math.max(0, 100 - penalty);
      if (critical > 0 && calculatedScore > 80) calculatedScore = 80;

      setStats({
        score: calculatedScore,
        totalFindings: critical + high + medium + low,
        critical, high, medium, low
      });

      setAllFindings(Array.isArray(findings) ? findings : []);
      // Filter for top items
      setTopRisks(risksList.filter((r: any) => r.severity === "critical" || r.severity === "high").slice(0, 5));

      setCategoryScores([
        { name: "Identity Hygiene", score: Math.max(30, 100 - (critical * 5)), color: "#3b82f6" },
        { name: "Infrastructure Health", score: Math.max(40, 100 - (high * 3)), color: "#10b981" },
        { name: "GPO Management", score: Math.max(50, 100 - (medium * 2)), color: "#8b5cf6" },
      ]);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const MetricCard = ({ title, value, subtext, icon: Icon, color, trend }: any) => (
    <Card className="rounded-2xl border-none shadow-sm bg-white hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
            {trend && <span className={cn("text-xs font-medium", trend === 'up' ? "text-red-500" : "text-green-500")}>{trend === 'up' ? '↑' : '↓'} vs last</span>}
          </div>
          {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
        <div className={cn("p-2.5 rounded-xl bg-opacity-10", color)}>
          <Icon className={cn("h-5 w-5", color.replace('bg-', 'text-').replace('/10', ''))} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Infrastructure Health Control</h1>
          <p className="text-slate-500 text-sm mt-1">
            Tracking Configuration Drift & Operational Hygiene for <span className="font-semibold text-slate-700">{currentClient?.name || 'Unknown Client'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/reports">
            <Button variant="outline" className="h-9 text-xs rounded-lg border-slate-200">
              <FileText className="mr-2 h-3.5 w-3.5 text-slate-500" /> Export Audit Report
            </Button>
          </Link>
          <Link to="/new-assessment">
            <Button className="h-9 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20">
              <Activity className="mr-2 h-3.5 w-3.5" /> New Health Check
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center h-64 items-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-indigo-600 to-indigo-700 text-white">
              <CardContent className="p-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 h-32 w-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
                <div className="relative z-10">
                  <p className="text-indigo-100 text-sm font-medium mb-2">Technical Debt Score</p>
                  <div className="flex items-end gap-3">
                    <h2 className="text-5xl font-bold tracking-tighter">{100 - stats.score}</h2>
                    <span className="text-lg font-medium text-indigo-200 mb-2">/ 100</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-indigo-100 text-xs bg-white/10 w-fit px-2 py-1 rounded-lg backdrop-blur-sm">
                    <Activity className="h-3 w-3" />
                    {stats.score >= 80 ? 'Low Debt' : 'High Debt'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <MetricCard
              title="Config Gaps"
              value={stats.critical}
              subtext="Requires Optimization"
              icon={AlertTriangle}
              color="bg-red-500/10 text-red-600"
              trend={stats.critical > 0 ? 'up' : 'down'}
            />
            <MetricCard
              title="Privileged Bloat"
              value="--"
              subtext="Deviation from Least Privilege"
              icon={Users}
              color="bg-amber-500/10 text-amber-600"
            />
            <MetricCard
              title="Topology"
              value="Healthy"
              subtext="Replication & Sites"
              icon={Globe}
              color="bg-emerald-500/10 text-emerald-600"
            />
          </div>

          {/* Main Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Top Risks Table */}
            <Card className="col-span-1 lg:col-span-2 rounded-2xl border border-slate-100 shadow-sm bg-white">
              <CardHeader className="px-6 py-5 border-b border-slate-50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">Architectural & Hygiene Gaps</CardTitle>
                  <CardDescription className="text-xs">Top misconfigurations affecting stability</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {topRisks.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No architectural issues found.</div>
                  ) : (
                    topRisks.map((risk, i) => (
                      <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4">
                        <div className={cn("mt-1 h-2 w-2 rounded-full shrink-0",
                          risk.severity === 'critical' ? "bg-red-500 animate-pulse" : "bg-orange-500"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-semibold text-slate-800 truncate pr-4">{risk.title}</h4>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 h-5 border-slate-200 text-slate-500">
                              {risk.category || 'General'}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{risk.description}</p>

                          <div className="flex items-center gap-3 mt-3">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-200"
                              onClick={() => {
                                setSelectedFinding(risk);
                                setIsRemediationOpen(true);
                              }}
                            >
                              <Hammer className="h-3 w-3 mr-1.5" /> View Fix
                            </Button>
                            {risk.microsoft_docs && (
                              <a href={risk.microsoft_docs} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline flex items-center">
                                Best Practice Ref <ArrowRight className="h-2 w-2 ml-0.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right: Charts & Category Breakdown */}
            <div className="space-y-6">
              <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
                <CardHeader className="px-6 py-5 border-b border-slate-50">
                  <CardTitle className="text-sm font-bold text-slate-800">Operational Maturity</CardTitle>
                </CardHeader>
                <div className="p-4 bg-slate-50/50">
                  <CategoriesChart data={categoryScores} />
                </div>
              </Card>

              <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white p-6">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4">Infrastructure Status</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Replication Topology</p>
                        <p className="text-[10px] text-green-600 font-medium">Converged</p>
                      </div>
                    </div>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Domain Controllers</p>
                        <p className="text-[10px] text-slate-500">Consistent OS Version</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-white text-slate-600">Optimized</Badge>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Remediation Modal */}
          <RemediationModal
            isOpen={isRemediationOpen}
            onClose={() => setIsRemediationOpen(false)}
            finding={selectedFinding}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;
