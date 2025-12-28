import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, Trash2, Eye, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/utils/api";
import { toast } from "@/hooks/use-toast";
import AIConfigPanel from "@/components/admin/AIConfigPanel";
import MainLayout from "@/components/layout/MainLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Assessment {
  id: string;
  domain: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  analysis_progress: any;
}

const AdminPanel = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    loadAssessments();
    const interval = setInterval(() => {
      loadAssessments();
    }, 5000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    filterAssessments();
  }, [assessments, statusFilter]);

  const loadAssessments = async () => {
    try {
      const data = await api.getAssessments();
      setAssessments(data || []);
    } catch (error) {
      console.error('Error loading assessments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los análisis.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAssessments = () => {
    if (statusFilter === "all") {
      setFilteredAssessments(assessments);
    } else {
      setFilteredAssessments(assessments.filter(a => a.status === statusFilter));
    }
  };

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

  const handleRestartAnalysis = async (id: string) => {
    try {
      await api.resetAssessment(id);
      toast({
        title: "Análisis reiniciado",
        description: "El análisis se ha reiniciado correctamente.",
      });
      loadAssessments();
    } catch (error) {
      console.error('Error restarting analysis:', error);
      toast({
        title: "Error",
        description: "No se pudo reiniciar el análisis.",
        variant: "destructive",
      });
    }
  };

  const handleCancelAnalysis = async (id: string) => {
    try {
      toast({
        title: "Análisis cancelado",
        description: "El análisis ha sido marcado como cancelado.",
      });
      loadAssessments();
    } catch (error) {
      console.error('Error canceling analysis:', error);
      toast({
        title: "Error",
        description: "No se pudo cancelar el análisis.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAssessment = async () => {
    if (!selectedAssessmentId) return;

    try {
      await api.deleteAssessment(selectedAssessmentId);
      toast({
        title: "Análisis eliminado",
        description: "El análisis ha sido eliminado exitosamente.",
      });
      loadAssessments();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el análisis.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedAssessmentId(null);
    }
  };

  const getProgressInfo = (assessment: Assessment) => {
    const progress = assessment.analysis_progress;
    if (!progress || !progress.total) return "N/A";
    const percentage = Math.round((progress.completed / progress.total) * 100);
    return `${progress.completed}/${progress.total} (${percentage}%)`;
  };

  const getLastError = (assessment: Assessment) => {
    const progress = assessment.analysis_progress;
    return progress?.lastError || "N/A";
  };

  const stats = {
    total: assessments.length,
    analyzing: assessments.filter(a => a.status === 'analyzing').length,
    failed: assessments.filter(a => a.status === 'failed').length,
    completed: assessments.filter(a => a.status === 'completed').length,
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
            Configuración
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona la IA, integraciones y análisis del sistema
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="panel p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Total Análisis</p>
            <p className="text-3xl font-display font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">En Curso</p>
            <p className="text-3xl font-display font-bold text-primary">{stats.analyzing}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Fallidos</p>
            <p className="text-3xl font-display font-bold text-[hsl(var(--severity-critical))]">{stats.failed}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Completados</p>
            <p className="text-3xl font-display font-bold text-accent">{stats.completed}</p>
          </div>
        </div>

        {/* AI Provider Configuration */}
        <AIConfigPanel />

        {/* Filters */}
        <div className="panel p-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Historial de Análisis</h2>
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-muted-foreground">Filtrar por estado:</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] rounded-lg border-border bg-secondary/50 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="analyzing">En Curso</SelectItem>
                <SelectItem value="completed">Completados</SelectItem>
                <SelectItem value="failed">Fallidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="panel overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground text-sm">Cargando análisis...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="pl-6 h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dominio</TableHead>
                  <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                  <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progreso</TableHead>
                  <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Creado</TableHead>
                  <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Último Error</TableHead>
                  <TableHead className="pr-6 text-right h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No hay análisis que coincidan con los filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssessments.map((assessment) => (
                    <TableRow key={assessment.id} className="border-border hover:bg-secondary/30 transition-colors">
                      <TableCell className="pl-6 font-medium text-foreground py-4">{assessment.domain}</TableCell>
                      <TableCell className="py-4">{getStatusBadge(assessment.status)}</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground py-4">{getProgressInfo(assessment)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground py-4">
                        {format(new Date(assessment.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate py-4">
                        {getLastError(assessment) !== "N/A" ? (
                          <span className="text-[hsl(var(--severity-critical))] flex items-center gap-1 font-medium bg-[hsl(var(--severity-critical))]/10 px-2 py-1 rounded-md w-fit text-xs">
                            <AlertCircle className="h-3 w-3" />
                            {getLastError(assessment)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/assessment/${assessment.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>

                          {assessment.status === 'analyzing' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelAnalysis(assessment.id)}
                              className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}

                          {(assessment.status === 'failed' || assessment.status === 'analyzing') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRestartAnalysis(assessment.id)}
                              className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}

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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta acción no se puede deshacer. Se eliminarán todos los datos relacionados con este análisis.
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
    </MainLayout>
  );
};

export default AdminPanel;
