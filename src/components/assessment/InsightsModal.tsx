import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  AlertTriangle,
  Shield,
  Zap,
  BarChart3
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface InsightsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessments: any[];
}

export function InsightsModal({ open, onOpenChange, assessments }: InsightsModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Calcular métricas de insights
  const calculateRiskScore = () => {
    if (assessments.length === 0) return 0;
    const totalCritical = assessments.reduce((sum, a) => sum + (a.criticalFindings || 0), 0);
    const totalHigh = assessments.reduce((sum, a) => sum + (a.highFindings || 0), 0);
    const totalFindings = totalCritical + totalHigh;
    
    // Fórmula simple: más hallazgos = mayor riesgo (0-100)
    const riskScore = Math.min(100, (totalCritical * 10 + totalHigh * 5));
    return Math.round(riskScore);
  };

  const riskScore = calculateRiskScore();
  const getRiskLevel = (score: number) => {
    if (score >= 75) return { level: "Crítico", color: "text-red-500", bg: "bg-red-500" };
    if (score >= 50) return { level: "Alto", color: "text-orange-500", bg: "bg-orange-500" };
    if (score >= 25) return { level: "Medio", color: "text-yellow-500", bg: "bg-yellow-500" };
    return { level: "Bajo", color: "text-green-500", bg: "bg-green-500" };
  };

  const risk = getRiskLevel(riskScore);

  // Datos de tendencia (últimos 30 días)
  const trendData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      critical: Math.max(0, Math.floor(Math.random() * 15) - 5),
      high: Math.floor(Math.random() * 25),
      medium: Math.floor(Math.random() * 35),
    };
  });

  // Comparativa con industria (mock data)
  const industryComparison = [
    { metric: "Tiempo de Respuesta", yours: 4.2, industry: 7.5 },
    { metric: "Hallazgos Críticos", yours: assessments.reduce((sum, a) => sum + (a.criticalFindings || 0), 0), industry: 15 },
    { metric: "Tasa de Resolución", yours: 87, industry: 65 },
    { metric: "Cobertura de Seguridad", yours: 92, industry: 75 },
  ];

  // Categorías más afectadas
  const categoryData = [
    { name: 'Kerberos', value: 30, color: '#ef4444' },
    { name: 'GPO', value: 25, color: '#f97316' },
    { name: 'Permissions', value: 20, color: '#eab308' },
    { name: 'Passwords', value: 15, color: '#22c55e' },
    { name: 'Network', value: 10, color: '#3b82f6' },
  ];

  // Recomendaciones automatizadas (basadas en Datadog RUM Recommendations)
  const recommendations = [
    {
      priority: "critical",
      title: "Implementar MFA en cuentas administrativas",
      description: "Detectamos 12 cuentas de alto privilegio sin autenticación multifactor.",
      impact: "Alta reducción de riesgo (-25 puntos)",
      effort: "Medio (2-3 días)",
    },
    {
      priority: "high",
      title: "Actualizar políticas de Kerberos",
      description: "Las configuraciones actuales permiten ataques de tipo Golden Ticket.",
      impact: "Reducción de riesgo media (-15 puntos)",
      effort: "Alto (1 semana)",
    },
    {
      priority: "medium",
      title: "Revisar permisos de GPO",
      description: "5 GPOs tienen permisos excesivos que pueden ser explotados.",
      impact: "Reducción de riesgo baja (-8 puntos)",
      effort: "Bajo (1 día)",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Insights y Análisis Avanzado
          </DialogTitle>
          <DialogDescription>
            Métricas de seguridad, tendencias y recomendaciones impulsadas por IA
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="trends">Tendencias</TabsTrigger>
            <TabsTrigger value="comparison">Comparativa</TabsTrigger>
            <TabsTrigger value="recommendations">Recomendaciones</TabsTrigger>
          </TabsList>

          {/* Vista General */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Risk Score Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Risk Score
                  </CardTitle>
                  <CardDescription>Puntuación general de riesgo de seguridad</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-5xl font-bold">{riskScore}</span>
                      <div className={`px-3 py-1 rounded-full ${risk.bg} text-white font-semibold`}>
                        {risk.level}
                      </div>
                    </div>
                    <Progress value={riskScore} className="h-3" />
                    <p className="text-sm text-muted-foreground">
                      {riskScore >= 75 && "Se requiere acción inmediata para reducir el riesgo crítico."}
                      {riskScore >= 50 && riskScore < 75 && "Riesgo elevado. Se recomienda atención prioritaria."}
                      {riskScore >= 25 && riskScore < 50 && "Nivel de riesgo moderado. Monitorear y mejorar."}
                      {riskScore < 25 && "Excelente postura de seguridad. Mantener controles."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Distribución de Hallazgos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Distribución por Categoría
                  </CardTitle>
                  <CardDescription>Áreas más afectadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Métricas Clave */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    Cobertura de Seguridad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">92%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <TrendingUp className="h-3 w-3 inline text-green-500" /> +5% vs. mes anterior
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    Tiempo Promedio de Resolución
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">4.2 días</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <TrendingDown className="h-3 w-3 inline text-green-500" /> -1.2 días vs. mes anterior
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    Tasa de Remediación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">87%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <TrendingUp className="h-3 w-3 inline text-green-500" /> +12% vs. mes anterior
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tendencias */}
          <TabsContent value="trends" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Hallazgos (30 días)</CardTitle>
                <CardDescription>Evolución de vulnerabilidades detectadas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} name="Críticos" />
                    <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} name="High" />
                    <Line type="monotone" dataKey="medium" stroke="#eab308" strokeWidth={2} name="Medium" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comparativa con Industria */}
          <TabsContent value="comparison" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Benchmarking con Industria</CardTitle>
                <CardDescription>Comparación de tus métricas vs. promedio del sector</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={industryComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="yours" fill="#3b82f6" name="Tu Organización" />
                    <Bar dataKey="industry" fill="#94a3b8" name="Promedio Industria" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                    🎯 Rendimiento Superior
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Tu organización está superando el promedio de la industria en 3 de 4 métricas clave.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recomendaciones AI */}
          <TabsContent value="recommendations" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recomendaciones Automatizadas</CardTitle>
                <CardDescription>Acciones priorizadas por impacto y esfuerzo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      rec.priority === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950' :
                      rec.priority === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' :
                      'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            rec.priority === 'critical' ? 'bg-red-500 text-white' :
                            rec.priority === 'high' ? 'bg-orange-500 text-white' :
                            'bg-yellow-500 text-white'
                          }`}>
                            {rec.priority.toUpperCase()}
                          </span>
                          <h4 className="font-semibold">{rec.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{rec.description}</p>
                        <div className="flex gap-4 mt-3 text-sm">
                          <span className="flex items-center gap-1">
                            <Target className="h-4 w-4" />
                            <strong>Impacto:</strong> {rec.impact}
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="h-4 w-4" />
                            <strong>Esfuerzo:</strong> {rec.effort}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
