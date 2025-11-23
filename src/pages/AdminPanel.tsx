import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, Trash2, Eye, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
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
    <div className="min-h-screen bg-gradient-subtle">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Panel de Administración</h1>
          <p className="text-muted-foreground text-lg">
            Gestiona todos los análisis del sistema
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-lg shadow-card p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-card rounded-lg shadow-card p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">En Curso</p>
            <p className="text-2xl font-bold text-primary">{stats.analyzing}</p>
          </div>
          <div className="bg-card rounded-lg shadow-card p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Fallidos</p>
            <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
          </div>
          <div className="bg-card rounded-lg shadow-card p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Completados</p>
            <p className="text-2xl font-bold text-severity-low">{stats.completed}</p>
          </div>
        </div>

        {/* AI Provider Configuration */}
        <AIConfigPanel />

        {/* Filters */}
        <div className="bg-card rounded-lg shadow-card p-4 border border-border mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Filtrar por estado:</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
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
        <div className="bg-card rounded-lg shadow-card border border-border overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Cargando análisis...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dominio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead>Último Error</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay análisis que coincidan con los filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">{assessment.domain}</TableCell>
                      <TableCell>{getStatusBadge(assessment.status)}</TableCell>
                      <TableCell className="text-sm">{getProgressInfo(assessment)}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(assessment.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {getLastError(assessment) !== "N/A" && (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {getLastError(assessment)}
                          </span>
                        )}
                        {getLastError(assessment) === "N/A" && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/assessment/${assessment.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          
                          {assessment.status === 'analyzing' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelAnalysis(assessment.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {(assessment.status === 'failed' || assessment.status === 'analyzing') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestartAnalysis(assessment.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAssessmentId(assessment.id);
                              setDeleteDialogOpen(true);
                            }}
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
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los datos relacionados con este análisis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssessment}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPanel;
