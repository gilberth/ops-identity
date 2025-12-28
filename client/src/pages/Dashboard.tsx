import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Activity,
  Users,
  FileText,
  Globe,
  Loader2,
  Zap,
  TrendingUp,
  TrendingDown,
  Server,
  Lock,
  Eye
} from "lucide-react";
import { CategoriesChart } from "@/components/assessment/CategoriesChart";
import { api } from "@/utils/api";
import { Link } from "react-router-dom";
import { Hammer } from "lucide-react";
import { RemediationModal } from "@/components/assessment/RemediationModal";
import { cn } from "@/lib/utils";
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
    domainAdmins: 0,
    hasPrivilegedFinding: false,
    replStatus: { status: "Healthy", label: "Converged", color: "green" },
    dcStatus: { status: "Optimized", label: "Consistent OS", color: "slate" }
  });
  const [topRisks, setTopRisks] = useState<any[]>([]);
  const [categoryScores, setCategoryScores] = useState<any[]>([]);
  const [latestAssessment, setLatestAssessment] = useState<any>(null);
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

      const sorted = assessments.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = sorted[0];
      setLatestAssessment(latest);

      const findings = await api.getFindings(latest.id);
      let critical = 0, high = 0, medium = 0, low = 0;
      let risksList: any[] = [];
      let domainAdminsCount = 0;
      let hasDomainAdminFinding = false;
      let replStatus = { status: "Healthy", label: "Converged", color: "green" };
      let dcStatus = { status: "Optimized", label: "Consistent OS", color: "slate" };

      if (Array.isArray(findings)) {
        findings.forEach((f: any) => {
          const sev = (f.severity || "medium").toLowerCase();
          if (sev === "critical") critical++;
          else if (sev === "high") high++;
          else if (sev === "medium") medium++;
          else low++;

          if (
            (f.title?.toLowerCase().includes("domain admin") || f.title?.toLowerCase().includes("administrators") || f.title?.toLowerCase().includes("administradores")) &&
            (f.title?.toLowerCase().includes("member") || f.title?.toLowerCase().includes("miembro") || f.title?.toLowerCase().includes("count") || f.title?.toLowerCase().includes("usuarios"))
          ) {
            hasDomainAdminFinding = true;
            if (f.evidence?.count) {
              domainAdminsCount = Math.max(domainAdminsCount, f.evidence.count);
            } else if (f.affected_count) {
              domainAdminsCount = Math.max(domainAdminsCount, f.affected_count);
            } else {
              const match = f.title.match(/(\d+)/);
              if (match) domainAdminsCount = Math.max(domainAdminsCount, parseInt(match[1]));
            }
          }

          if (f.title?.toLowerCase().includes("replication") || f.title?.toLowerCase().includes("sincronización")) {
            replStatus = { status: "Issues Found", label: "Sync Errors", color: "red" };
          }

          if (f.title?.toLowerCase().includes("operating system") || f.title?.toLowerCase().includes("end of life")) {
            dcStatus = { status: "Action Needed", label: "Legacy OS Found", color: "amber" };
          }

          risksList.push(f);
        });
      }

      const penalty = (critical * 15) + (high * 8) + (medium * 3) + (low * 1);
      let calculatedScore = Math.max(0, 100 - penalty);
      if (critical > 0 && calculatedScore > 80) calculatedScore = 80;

      setStats({
        score: calculatedScore,
        totalFindings: critical + high + medium + low,
        critical, high, medium, low,
        domainAdmins: hasDomainAdminFinding ? domainAdminsCount : 0,
        hasPrivilegedFinding: hasDomainAdminFinding,
        replStatus,
        dcStatus
      });

      setTopRisks(risksList.filter((r: any) => r.severity === "critical" || r.severity === "high").slice(0, 5));

      setCategoryScores([
        { name: "Identity", score: Math.max(30, 100 - (critical * 5)), color: "#00E5FF" },
        { name: "Infrastructure", score: Math.max(40, 100 - (high * 3)), color: "#22C55E" },
        { name: "GPO", score: Math.max(50, 100 - (medium * 2)), color: "#A855F7" },
      ]);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreGlow = (score: number) => {
    if (score >= 80) return "shadow-emerald-500/30";
    if (score >= 60) return "shadow-yellow-500/30";
    if (score >= 40) return "shadow-orange-500/30";
    return "shadow-red-500/30";
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Zap className="h-5 w-5 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Security Command Center
            </h1>
          </div>
          <p className="text-slate-400 text-sm">
            Real-time infrastructure health monitoring for{" "}
            <span className="text-cyan-400 font-medium">{currentClient?.name || 'Unknown Client'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/reports">
            <Button variant="outline" className="h-9 text-xs rounded-lg border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white">
              <FileText className="mr-2 h-3.5 w-3.5" /> Export Report
            </Button>
          </Link>
          <Link to="/new-assessment">
            <Button className="h-9 text-xs rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-[hsl(222,47%,6%)] font-semibold shadow-lg shadow-cyan-500/25">
              <Activity className="mr-2 h-3.5 w-3.5" /> New Scan
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 gap-4">
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
            <div className="absolute inset-0 h-10 w-10 animate-ping rounded-full bg-cyan-400/20" />
          </div>
          <p className="text-slate-500 text-sm font-mono">Loading security metrics...</p>
        </div>
      ) : !latestAssessment ? (
        <Card className="card-elevated border-dashed border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
              <Shield className="h-8 w-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Assessments Yet</h3>
            <p className="text-slate-400 text-sm text-center max-w-md mb-6">
              Run your first security assessment to see your infrastructure health metrics
            </p>
            <Link to="/new-assessment">
              <Button className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-[hsl(222,47%,6%)] font-semibold">
                <Zap className="mr-2 h-4 w-4" /> Start Assessment
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Security Score Card */}
            <Card className="card-elevated relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    Health Score
                  </span>
                  <div className={cn("flex items-center gap-1 text-xs font-medium", stats.score >= 50 ? "text-emerald-400" : "text-red-400")}>
                    {stats.score >= 50 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {stats.score >= 50 ? "Stable" : "At Risk"}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <span className={cn("text-5xl font-bold tracking-tighter", getScoreColor(stats.score))}>
                    {stats.score}
                  </span>
                  <span className="text-slate-500 text-lg mb-2">/100</span>
                </div>
                <div className="mt-4 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-1000", stats.score >= 80 ? "bg-emerald-500" : stats.score >= 60 ? "bg-yellow-500" : stats.score >= 40 ? "bg-orange-500" : "bg-red-500")}
                    style={{ width: `${stats.score}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Critical Issues */}
            <Card className={cn("card-elevated relative overflow-hidden group", stats.critical > 0 && "border-red-500/30")}>
              {stats.critical > 0 && <div className="absolute inset-0 bg-red-500/5" />}
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Critical</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={cn("text-4xl font-bold", stats.critical > 0 ? "text-red-400" : "text-slate-500")}>
                        {stats.critical}
                      </span>
                      {stats.critical > 0 && (
                        <span className="text-xs text-red-400 font-medium">Issues</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Immediate action required</p>
                  </div>
                  <div className={cn("p-3 rounded-xl", stats.critical > 0 ? "bg-red-500/20 glow-red" : "bg-white/5")}>
                    <AlertTriangle className={cn("h-6 w-6", stats.critical > 0 ? "text-red-400" : "text-slate-500")} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Privileged Accounts */}
            <Card className="card-elevated relative overflow-hidden group">
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Privileged</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={cn("text-4xl font-bold", stats.hasPrivilegedFinding ? "text-orange-400" : "text-emerald-400")}>
                        {stats.hasPrivilegedFinding ? stats.domainAdmins : "OK"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {stats.hasPrivilegedFinding ? "High-risk accounts" : "Least privilege met"}
                    </p>
                  </div>
                  <div className={cn("p-3 rounded-xl", stats.hasPrivilegedFinding ? "bg-orange-500/20" : "bg-emerald-500/20")}>
                    <Users className={cn("h-6 w-6", stats.hasPrivilegedFinding ? "text-orange-400" : "text-emerald-400")} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Replication Status */}
            <Card className="card-elevated relative overflow-hidden group">
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Topology</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={cn("text-2xl font-bold", stats.replStatus?.color === 'red' ? "text-red-400" : "text-emerald-400")}>
                        {stats.replStatus?.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{stats.replStatus?.label}</p>
                  </div>
                  <div className={cn("p-3 rounded-xl", stats.replStatus?.color === 'red' ? "bg-red-500/20" : "bg-emerald-500/20")}>
                    <Globe className={cn("h-6 w-6", stats.replStatus?.color === 'red' ? "text-red-400" : "text-emerald-400")} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Findings Table */}
            <Card className="col-span-1 lg:col-span-2 card-elevated">
              <CardHeader className="px-6 py-5 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <Eye className="h-4 w-4 text-cyan-400" />
                      Security Findings
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-xs mt-1">
                      Top priority issues requiring attention
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 bg-cyan-500/10 font-mono text-[10px]">
                    {topRisks.length} ACTIVE
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {topRisks.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 inline-flex mb-4">
                      <CheckCircle className="h-8 w-8 text-emerald-400" />
                    </div>
                    <p className="text-slate-400 text-sm">No critical issues found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {topRisks.map((risk, i) => (
                      <div key={i} className="p-4 hover:bg-white/[0.02] transition-colors group">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "mt-1 h-2 w-2 rounded-full shrink-0",
                            risk.severity === 'critical' ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50" : "bg-orange-500"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-white truncate pr-4 group-hover:text-cyan-400 transition-colors">
                                {risk.title}
                              </h4>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] uppercase font-bold tracking-wider px-2 h-5 font-mono shrink-0",
                                  risk.severity === 'critical'
                                    ? "border-red-500/30 text-red-400 bg-red-500/10"
                                    : "border-orange-500/30 text-orange-400 bg-orange-500/10"
                                )}
                              >
                                {risk.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2 mb-3">{risk.description}</p>

                            <div className="flex items-center gap-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-3"
                                onClick={() => {
                                  setSelectedFinding(risk);
                                  setIsRemediationOpen(true);
                                }}
                              >
                                <Hammer className="h-3 w-3 mr-1.5" /> Remediate
                              </Button>
                              {risk.category && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {risk.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Category Scores */}
              <Card className="card-elevated overflow-hidden">
                <CardHeader className="px-6 py-5 border-b border-white/5">
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Category Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <CategoriesChart data={categoryScores} />
                </CardContent>
              </Card>

              {/* Quick Status */}
              <Card className="card-elevated p-5">
                <h4 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-4 font-mono">
                  Infrastructure Status
                </h4>
                <div className="space-y-3">
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors",
                    stats.replStatus?.color === 'red'
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-emerald-500/10 border-emerald-500/20"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        stats.replStatus?.color === 'red' ? "bg-red-500/20" : "bg-emerald-500/20"
                      )}>
                        <Server className={cn("h-4 w-4", stats.replStatus?.color === 'red' ? "text-red-400" : "text-emerald-400")} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Replication</p>
                        <p className={cn("text-[10px]", stats.replStatus?.color === 'red' ? "text-red-400" : "text-emerald-400")}>
                          {stats.replStatus?.label}
                        </p>
                      </div>
                    </div>
                    {stats.replStatus?.color === 'red'
                      ? <AlertTriangle className="h-4 w-4 text-red-400" />
                      : <CheckCircle className="h-4 w-4 text-emerald-400" />
                    }
                  </div>

                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors",
                    stats.dcStatus?.color === 'amber'
                      ? "bg-orange-500/10 border-orange-500/20"
                      : "bg-white/5 border-white/10"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        stats.dcStatus?.color === 'amber' ? "bg-orange-500/20" : "bg-white/10"
                      )}>
                        <Lock className={cn("h-4 w-4", stats.dcStatus?.color === 'amber' ? "text-orange-400" : "text-slate-400")} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Domain Controllers</p>
                        <p className="text-[10px] text-slate-400">{stats.dcStatus?.label}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-white/5 text-slate-300 text-[10px] font-mono">
                      {stats.dcStatus?.status}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          </div>

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
