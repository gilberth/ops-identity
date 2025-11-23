import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import AssessmentCard from "@/components/assessment/AssessmentCard";
import { api } from "@/utils/api";
import { toast } from "@/hooks/use-toast";

const Dashboard = () => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    try {
      const assessmentsData = await api.getAssessments();

      // Load findings count for each assessment
      const assessmentsWithFindings = await Promise.all(
        (assessmentsData || []).map(async (assessment) => {
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
        })
      );

      setAssessments(assessmentsWithFindings);
    } catch (error) {
      console.error('Error loading assessments:', error);
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

  const totalAssessments = assessments.length;
  const completedAssessments = assessments.filter(a => a.status === "completed").length;
  const totalCritical = assessments.reduce((sum, a) => sum + a.criticalFindings, 0);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card rounded-lg shadow-card p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Assessments</p>
                  <p className="text-3xl font-bold">{totalAssessments}</p>
                </div>
                <Shield className="h-12 w-12 text-primary opacity-80" />
              </div>
            </div>

            <div className="bg-card rounded-lg shadow-card p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Completados</p>
                  <p className="text-3xl font-bold">{completedAssessments}</p>
                </div>
                <CheckCircle className="h-12 w-12 text-severity-low opacity-80" />
              </div>
            </div>

            <div className="bg-card rounded-lg shadow-card p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Hallazgos Críticos</p>
                  <p className="text-3xl font-bold">{totalCritical}</p>
                </div>
                <AlertTriangle className="h-12 w-12 text-severity-critical opacity-80" />
              </div>
            </div>
          </div>
        </div>

        {/* Assessments List */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Assessments Recientes</h2>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Cargando assessments...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {assessments.map(assessment => (
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
      </main>
    </div>
  );
};

export default Dashboard;
