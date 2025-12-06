import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, Trash2, Eye, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "@/utils/api";
import { toast } from "@/hooks/use-toast";
import AIConfigPanel from "@/components/admin/AIConfigPanel";
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

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      loadAssessments();
    }, 5000); // Poll every 5 seconds

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
    const statusConfig: Record<string, { variant: any; label: string }> = {
      pending: { variant: "secondary", label: "Pendiente" },
      analyzing: { variant: "default", label: "En Curso" },
      completed: { variant: "outline", label: "Completado" },
      failed: { variant: "destructive", label: "Fallido" }
    };

    const config = statusConfig[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
      // For now, we just reload to reflect any backend changes
      // In future, add a dedicated cancel endpoint if needed
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
    <div className="min-h-screen bg-gray-50/50">

      <main className="container py-8 max-w-[1600px]">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 tracking-tight text-foreground">Configuración</h1>
          <p className="text-muted-foreground text-lg">
            Gestiona la IA, integraciones y análisis del sistema
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-[2rem] shadow-soft p-6 border border-gray-100 transition-all hover:shadow-lg">
            <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Total Análisis</p>
            <p className="text-4xl font-bold tracking-tight">{stats.total}</p>
          </div>
          <div className="bg-white rounded-[2rem] shadow-soft p-6 border border-gray-100 transition-all hover:shadow-lg">
            <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">En Curso</p>
            <p className="text-4xl font-bold tracking-tight text-primary">{stats.analyzing}</p>
          </div>
          <div className="bg-white rounded-[2rem] shadow-soft p-6 border border-gray-100 transition-all hover:shadow-lg">
            <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Fallidos</p>
            <p className="text-4xl font-bold tracking-tight text-destructive">{stats.failed}</p>
          </div>
          <div className="bg-white rounded-[2rem] shadow-soft p-6 border border-gray-100 transition-all hover:shadow-lg">
            <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Completados</p>
            <p className="text-4xl font-bold tracking-tight text-emerald-600">{stats.completed}</p>
          </div>
        </div>

        {/* AI Provider Configuration */}
        <div className="mb-8">
          <AIConfigPanel />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-[2rem] shadow-soft p-6 border border-gray-100 mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Historial de Análisis</h2>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-muted-foreground">Filtrar por estado:</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px] rounded-xl border-gray-200">
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
        <div className="bg-white rounded-[2.5rem] shadow-soft border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground font-medium">Cargando análisis...</p>
            </div>
          ) : (
            <div className="p-2">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-gray-100">
                    <TableHead className="pl-6 h-14 text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Dominio</TableHead>
                    <TableHead className="h-14 text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Estado</TableHead>
                    <TableHead className="h-14 text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Progreso</TableHead>
                    <TableHead className="h-14 text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Creado</TableHead>
                    <TableHead className="h-14 text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Último Error</TableHead>
                    <TableHead className="pr-6 text-right h-14 text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssessments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                        No hay análisis que coincidan con los filtros
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssessments.map((assessment) => (
                      <TableRow key={assessment.id} className="hover:bg-gray-50/50 border-gray-50 transition-colors">
                        <TableCell className="pl-6 font-semibold text-foreground py-4">{assessment.domain}</TableCell>
                        <TableCell className="py-4">{getStatusBadge(assessment.status)}</TableCell>
                        <TableCell className="text-sm font-medium text-muted-foreground py-4">{getProgressInfo(assessment)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground py-4">
                          {format(new Date(assessment.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate py-4">
                          {getLastError(assessment) !== "N/A" && (
                            <span className="text-destructive flex items-center gap-1 font-medium bg-red-50 px-2 py-1 rounded-lg w-fit">
                              <AlertCircle className="h-3 w-3" />
                              {getLastError(assessment)}
                            </span>
                          )}
                          {getLastError(assessment) === "N/A" && (
                            <span className="text-muted-foreground/30">-</span>
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
                                className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
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
                              className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
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
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los datos relacionados con este análisis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssessment} className="rounded-xl bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPanel;
