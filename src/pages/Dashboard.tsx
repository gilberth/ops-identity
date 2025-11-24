import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, Activity, Download, Calendar, BarChart3, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import AssessmentCard from "@/components/assessment/AssessmentCard";
import { api } from "@/utils/api";
import { toast } from "@/hooks/use-toast";
import { SeverityChart } from "@/components/assessment/SeverityChart";
import { CategoriesChart } from "@/components/assessment/CategoriesChart";
import { TrendChart } from "@/components/assessment/TrendChart";
import { StatsCard } from "@/components/assessment/StatsCard";
import { RecentActivityTimeline } from "@/components/assessment/RecentActivityTimeline";
import { Card } from "@/components/ui/card";

const Dashboard = () => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    try {
      const assessmentsData = await api.getAssessments();

      // Ensure assessmentsData is an array
      if (!Array.isArray(assessmentsData)) {
        console.warn('Invalid assessments data received:', assessmentsData);
        setAssessments([]);
        return;
      }

      // Load findings count for each assessment
      const assessmentsWithFindings = await Promise.all(
        assessmentsData.map(async (assessment) => {
          try {
            const findings = await api.getFindings(assessment.id);

            const criticalFindings = findings?.filter(f => f.severity === 'critical').length || 0;
            const highFindings = findings?.filter(f => f.severity === 'high').length || 0;

            return {
              id: assessment.id,
              domain: assessment.domain,
              date: assessment.created_at,
              status: assessment.status,
              criticalFindings,
              highFindings,
            };
          } catch (error) {
            console.error(`Error loading findings for assessment ${assessment.id}:`, error);
            return {
              id: assessment.id,
              domain: assessment.domain,
              date: assessment.created_at,
              status: assessment.status,
              criticalFindings: 0,
              highFindings: 0,
            };
          }
        })
      );

      setAssessments(assessmentsWithFindings);
    } catch (error) {
      console.error('Error loading assessments:', error);
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssessment = async (id: string) => {
    try {
      await api.deleteAssessment(id);

      toast({
        title: "Assessment eliminado",
        description: "El assessment ha sido eliminado exitosamente.",
      });

      // Reload assessments
      loadAssessments();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el assessment. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const totalAssessments = assessments?.length || 0;
  const completedAssessments = assessments?.filter(a => a.status === "completed").length || 0;
  const totalCritical = assessments?.reduce((sum, a) => sum + a.criticalFindings, 0) || 0;
  const totalHigh = assessments?.reduce((sum, a) => sum + a.highFindings, 0) || 0;
  const completionRate = totalAssessments > 0 ? Math.round((completedAssessments / totalAssessments) * 100) : 0;

  // Prepare chart data
  const severityData = [
    { name: 'Critical', value: totalCritical, color: '#ef4444' },
    { name: 'High', value: totalHigh, color: '#f97316' },
    { name: 'Medium', value: 0, color: '#eab308' }, // TODO: Add medium count
    { name: 'Low', value: 0, color: '#22c55e' }, // TODO: Add low count
  ].filter(item => item.value > 0);

  // Category data (mock for now - will be real data from API)
  const categoryData = [
    { category: 'Kerberos', findings: Math.floor(totalCritical * 0.3) },
    { category: 'GPO', findings: Math.floor(totalCritical * 0.25) },
    { category: 'Permissions', findings: Math.floor(totalCritical * 0.2) },
    { category: 'Passwords', findings: Math.floor(totalCritical * 0.15) },
    { category: 'Network', findings: Math.floor(totalCritical * 0.1) },
  ].filter(item => item.findings > 0);

  // Trend data (mock - last 7 days)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      critical: Math.floor(Math.random() * 10),
      high: Math.floor(Math.random() * 15),
      medium: Math.floor(Math.random() * 20),
      low: Math.floor(Math.random() * 25),
    };
  });

  // Recent activity for timeline
  const recentActivity = (assessments || []).slice(0, 5).map(a => ({
    id: a.id,
    domain: a.domain,
    date: a.date,
    status: a.status as 'completed' | 'in_progress' | 'failed',
    critical: a.criticalFindings,
    high: a.highFindings,
  }));

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />

      <main className="container py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Active Directory Security Assessment</h1>
              <p className="text-muted-foreground text-lg">
                Evalúa y mejora la seguridad de tus controladores de dominio
              </p>
            </div>
            <Link to="/new-assessment">
              <Button size="lg" className="bg-gradient-primary hover:opacity-90">
                <Plus className="h-5 w-5 mr-2" />
                Nuevo Assessment
              </Button>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Total Assessments"
              value={totalAssessments}
              description="Todos los análisis"
              icon={Shield}
              trend={totalAssessments > 0 ? { value: 12, isPositive: true } : undefined}
            />
            <StatsCard
              title="Hallazgos Críticos"
              value={totalCritical}
              description="Requieren acción inmediata"
              icon={AlertTriangle}
              trend={totalCritical > 0 ? { value: 5, isPositive: false } : undefined}
            />
            <StatsCard
              title="Tasa de Completado"
              value={`${completionRate}%`}
              description="Assessments finalizados"
              icon={CheckCircle}
              trend={completionRate > 0 ? { value: 8, isPositive: true } : undefined}
            />
            <StatsCard
              title="Tiempo Promedio"
              value="4.2 días"
              description="Resolución de críticos"
              icon={Clock}
              trend={{ value: 8, isPositive: true }}
            />
          </div>

          {/* Quick Actions */}
          {totalAssessments > 0 && (
            <Card className="p-4 mt-6">
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">Acciones Rápidas</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="default" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Reportes
                </Button>
                <Link to="/new-assessment">
                  <Button variant="secondary" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Nuevo Assessment
                  </Button>
                </Link>
                <Button variant="outline" size="sm">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Insights
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Alertas
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Charts Section */}
        {!loading && totalAssessments > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SeverityChart data={severityData} loading={loading} />
              <CategoriesChart data={categoryData} loading={loading} />
            </div>

            <div className="mb-6">
              <TrendChart data={trendData} loading={loading} />
            </div>
          </>
        )}

        {/* Recent Activity Timeline and Assessments */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assessments List */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-6">Assessments Recientes</h2>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Cargando assessments...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6">
                  {(assessments || []).map(assessment => (
                    <AssessmentCard
                      key={assessment.id}
                      {...assessment}
                      onDelete={handleDeleteAssessment}
                    />
                  ))}
                </div>

                {assessments.length === 0 && (
                  <div className="text-center py-12">
                    <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground text-lg mb-4">
                      No hay assessments todavía
                    </p>
                    <Link to="/new-assessment">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Crear tu primer assessment
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recent Activity Timeline */}
          {!loading && totalAssessments > 0 && (
            <div className="lg:col-span-1">
              <h2 className="text-2xl font-bold mb-6">Actividad Reciente</h2>
              <RecentActivityTimeline activities={recentActivity} loading={loading} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
