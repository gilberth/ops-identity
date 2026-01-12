import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/utils/api";
import { useClient } from "@/context/ClientContext";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Dashboard Components
import {
  LetterGrade,
  CategoryRadar,
  SeverityBar,
  CategoryHealthCard,
  TopFindings,
  ObjectsAnalyzed,
  CommandPalette,
} from "@/components/dashboard";
import { RemediationModal } from "@/components/assessment/RemediationModal";

// Icons
import {
  Users,
  FileText,
  Network,
  Shield,
  Key,
  Server,
  FolderTree,
  Loader2,
  Clock,
  ArrowRight,
  Download,
  RefreshCw,
  Zap,
  Activity,
  Terminal,
  Eye,
  Trash2,
  History,
} from "lucide-react";

// Table Components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const Dashboard = () => {
  const { currentClient } = useClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [isRemediationOpen, setIsRemediationOpen] = useState(false);

  // Data state
  const [latestAssessment, setLatestAssessment] = useState<any>(null);
  const [stats, setStats] = useState({
    score: 0,
    previousScore: undefined as number | undefined,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [categoryScores, setCategoryScores] = useState<any[]>([]);
  const [topFindings, setTopFindings] = useState<any[]>([]);
  const [objectCounts, setObjectCounts] = useState({
    users: 0,
    computers: 0,
    groups: 0,
    gpos: 0,
    dcs: 0,
    trusts: 0,
  });
  const [allAssessments, setAllAssessments] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [currentClient]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const assessments = await api.getAssessments(currentClient?.id);

      if (!assessments || assessments.length === 0) {
        setLatestAssessment(null);
        setAllAssessments([]);
        return;
      }

      const sorted = assessments.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setAllAssessments(sorted);
      const latest = sorted[0];
      const previous = sorted[1];
      setLatestAssessment(latest);

      // Load findings
      const findings = await api.getFindings(latest.id);
      let critical = 0,
        high = 0,
        medium = 0,
        low = 0;
      const findingsList: any[] = [];

      // Category issue counts
      const categoryIssues: Record<string, number> = {
        Identity: 0,
        GPO: 0,
        Infrastructure: 0,
        Kerberos: 0,
        DNS: 0,
        Groups: 0,
      };

      if (Array.isArray(findings)) {
        findings.forEach((f: any) => {
          const sev = (f.severity || "medium").toLowerCase();
          if (sev === "critical") critical++;
          else if (sev === "high") high++;
          else if (sev === "medium") medium++;
          else low++;

          // Map finding to category
          const cat = f.category || "Infrastructure";
          if (categoryIssues[cat] !== undefined) {
            categoryIssues[cat]++;
          }

          findingsList.push({
            id: f.id || `finding-${findingsList.length}`,
            title: f.title,
            severity: sev,
            category: f.category || "Infrastructure",
            affectedCount: f.evidence?.count || f.affected_count || 1,
            cisControl: f.cis_control || f.mitre_id?.split("-")[0],
            mitreId: f.mitre_id,
            description: f.description,
            recommendation: f.recommendation,
          });
        });
      }

      // Calculate score
      const penalty = critical * 15 + high * 8 + medium * 3 + low * 1;
      let calculatedScore = Math.max(0, 100 - penalty);
      if (critical > 0 && calculatedScore > 80) calculatedScore = 80;

      // Previous score (if available)
      let previousScore: number | undefined;
      if (previous) {
        const prevFindings = await api.getFindings(previous.id);
        if (Array.isArray(prevFindings)) {
          let pc = 0,
            ph = 0,
            pm = 0,
            pl = 0;
          prevFindings.forEach((f: any) => {
            const sev = (f.severity || "medium").toLowerCase();
            if (sev === "critical") pc++;
            else if (sev === "high") ph++;
            else if (sev === "medium") pm++;
            else pl++;
          });
          const prevPenalty = pc * 15 + ph * 8 + pm * 3 + pl * 1;
          previousScore = Math.max(0, 100 - prevPenalty);
          if (pc > 0 && previousScore > 80) previousScore = 80;
        }
      }

      setStats({
        score: calculatedScore,
        previousScore,
        critical,
        high,
        medium,
        low,
      });

      // Category scores for radar
      const categories = [
        { category: "Identity", fullMark: 100 },
        { category: "GPO", fullMark: 100 },
        { category: "Infrastructure", fullMark: 100 },
        { category: "Kerberos", fullMark: 100 },
        { category: "DNS", fullMark: 100 },
        { category: "Groups", fullMark: 100 },
      ];

      setCategoryScores(
        categories.map((cat) => ({
          ...cat,
          score: Math.max(20, 100 - categoryIssues[cat.category] * 12),
          issues: categoryIssues[cat.category],
        }))
      );

      // Top findings (critical and high first)
      const sorted_findings = [...findingsList].sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      });
      setTopFindings(sorted_findings.slice(0, 6));

      // Object counts from raw data
      if (latest.raw_data) {
        const raw = typeof latest.raw_data === "string" ? JSON.parse(latest.raw_data) : latest.raw_data;
        setObjectCounts({
          users: raw.Users?.length || 0,
          computers: raw.Computers?.length || 0,
          groups: raw.Groups?.length || 0,
          gpos: raw.GPOs?.length || 0,
          dcs: raw.DomainControllers?.length || 0,
          trusts: raw.Trusts?.length || 0,
        });
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const categoryIcons: Record<string, typeof Users> = {
    Identity: Users,
    GPO: FileText,
    Infrastructure: Server,
    Kerberos: Key,
    DNS: Network,
    Groups: FolderTree,
  };

  // Format time ago
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      pending: { className: "bg-secondary text-muted-foreground border-border", label: "Pendiente" },
      analyzing: { className: "badge-medium", label: "En Curso" },
      completed: { className: "badge-low", label: "Completado" },
      failed: { className: "badge-critical", label: "Fallido" }
    };
    const config = statusConfig[status] || { className: "bg-secondary text-muted-foreground border-border", label: status };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Handle delete assessment
  const handleDeleteAssessment = async () => {
    if (!selectedAssessmentId) return;
    try {
      await api.deleteAssessment(selectedAssessmentId);
      toast({
        title: "Assessment eliminado",
        description: "El assessment ha sido eliminado exitosamente.",
      });
      loadDashboardData();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el assessment.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedAssessmentId(null);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground tracking-wide">
              COMMAND CENTER
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Operational hygiene analysis for{" "}
            <span className="text-primary font-medium font-mono">
              {currentClient?.name || "Unknown"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Trigger */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span className="text-xs">Search</span>
            <kbd className="hidden sm:inline-flex ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-secondary rounded">
              Ctrl+K
            </kbd>
          </Button>

          {latestAssessment && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Last scan: {timeAgo(latestAssessment.created_at)}</span>
            </div>
          )}

          <Link to="/new-assessment">
            <Button size="sm" className="h-9 gap-2 btn-primary">
              <Download className="h-3.5 w-3.5" />
              <span>New Scan</span>
            </Button>
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="absolute inset-0 h-10 w-10 animate-ping rounded-full bg-primary/20" />
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            Loading security telemetry...
          </p>
        </div>
      ) : !latestAssessment ? (
        <div className="panel p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-display font-bold text-foreground mb-2">
            No Assessment Data
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Run your first security assessment to analyze your Active Directory
            infrastructure health.
          </p>
          <Link to="/new-assessment">
            <Button className="btn-primary gap-2">
              <Zap className="h-4 w-4" />
              Start Assessment
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Executive Summary Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Letter Grade Panel */}
            <div className="lg:col-span-3 panel p-6 flex flex-col items-center justify-center">
              <div className="panel-title mb-4">Hygiene Score</div>
              <LetterGrade
                score={stats.score}
                previousScore={stats.previousScore}
                size="lg"
                showTrend
              />
            </div>

            {/* Category Radar */}
            <div className="lg:col-span-5 panel">
              <div className="panel-header">
                <span className="panel-title">Category Analysis</span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {categoryScores.length} Categories
                </Badge>
              </div>
              <div className="panel-body">
                <CategoryRadar data={categoryScores} />
              </div>
            </div>

            {/* Severity Breakdown */}
            <div className="lg:col-span-4 panel">
              <div className="panel-header">
                <span className="panel-title">Findings by Severity</span>
              </div>
              <div className="panel-body">
                <SeverityBar
                  counts={{
                    critical: stats.critical,
                    high: stats.high,
                    medium: stats.medium,
                    low: stats.low,
                  }}
                  height="lg"
                />
              </div>
            </div>
          </div>

          {/* Category Health Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categoryScores.map((cat, index) => {
              const Icon = categoryIcons[cat.category] || Shield;
              return (
                <div
                  key={cat.category}
                  className="animate-slide-up opacity-0"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: "forwards",
                  }}
                >
                  <CategoryHealthCard
                    name={cat.category}
                    score={cat.score}
                    issues={cat.issues}
                    icon={Icon}
                    onClick={() => navigate(`/users`)}
                  />
                </div>
              );
            })}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Findings Panel */}
            <div className="lg:col-span-2 panel">
              <div className="panel-header">
                <span className="panel-title">Priority Findings</span>
                <Link to={`/assessment/${latestAssessment.id}`}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary">
                    View All <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              <div className="panel-body">
                <TopFindings
                  findings={topFindings}
                  onFindingClick={(finding) => {
                    setSelectedFinding(finding);
                    setIsRemediationOpen(true);
                  }}
                  onViewAll={() => navigate(`/assessment/${latestAssessment.id}`)}
                />
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Objects Analyzed */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Objects Analyzed</span>
                </div>
                <div className="panel-body">
                  <ObjectsAnalyzed data={objectCounts} />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="panel p-5">
                <div className="panel-title mb-4">Quick Actions</div>
                <div className="space-y-2">
                  <Link to="/new-assessment" className="block">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-10 text-sm"
                    >
                      <Download className="h-4 w-4 text-primary" />
                      Download Collection Script
                    </Button>
                  </Link>
                  <Link to="/reports" className="block">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-10 text-sm"
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      Generate PDF Report
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-10 text-sm"
                    onClick={loadDashboardData}
                  >
                    <RefreshCw className="h-4 w-4 text-primary" />
                    Refresh Data
                  </Button>
                </div>
              </div>

              {/* Domain Info */}
              <div className="panel p-5">
                <div className="panel-title mb-4">Assessment Details</div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Domain</span>
                    <span className="font-mono text-foreground">
                      {latestAssessment.domain_name || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Assessment ID</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {latestAssessment.id?.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      className={cn(
                        "text-[10px] uppercase font-mono",
                        latestAssessment.status === "completed"
                          ? "badge-pass"
                          : "badge-medium"
                      )}
                    >
                      {latestAssessment.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Assessment History */}
          {allAssessments.length > 0 && (
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <span className="panel-title">Assessment History</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {allAssessments.length} assessments
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="pl-6 h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dominio</TableHead>
                    <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                    <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fecha</TableHead>
                    <TableHead className="pr-6 text-right h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAssessments.map((assessment) => (
                    <TableRow key={assessment.id} className="border-border hover:bg-secondary/30 transition-colors">
                      <TableCell className="pl-6 font-medium text-foreground py-4">
                        <div className="flex items-center gap-2">
                          {assessment.id === latestAssessment?.id && (
                            <Badge className="badge-low text-[9px] px-1.5 py-0">Actual</Badge>
                          )}
                          <span className="font-mono text-sm">{assessment.domain || assessment.domain_name || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">{getStatusBadge(assessment.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground py-4">
                        {format(new Date(assessment.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/assessment/${assessment.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedAssessmentId(assessment.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Remediation Modal */}
          <RemediationModal
            isOpen={isRemediationOpen}
            onClose={() => setIsRemediationOpen(false)}
            finding={selectedFinding}
          />
        </>
      )}

      {/* Delete Assessment Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta acción no se puede deshacer. Se eliminarán todos los datos relacionados con este assessment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssessment} className="rounded-lg bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
