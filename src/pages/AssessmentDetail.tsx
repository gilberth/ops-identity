import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Shield, Users, FileText, AlertTriangle, RefreshCw, Upload, Terminal } from "lucide-react";
import Header from "@/components/layout/Header";
import SeverityBadge from "@/components/assessment/SeverityBadge";
import AnalysisProgress from "@/components/assessment/AnalysisProgress";
import { AssessmentLogs } from "@/components/assessment/AssessmentLogs";
import { api } from "@/utils/api";
import { toast } from "@/hooks/use-toast";
import { generateReport } from "@/lib/reportGenerator";

const AssessmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [rawData, setRawData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadAssessment();

      // Poll for updates every 5 seconds if analyzing (faster updates for progress)
      const interval = setInterval(() => {
        if (assessment?.status === 'analyzing') {
          loadAssessment();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [id, assessment?.status]);

  const handleRetryAnalysis = async () => {
    if (!id) return;

    toast({
      title: "Para reintentar",
      description: "Por favor vuelve a subir el archivo JSON",
    });
  };

  const handleReset = async () => {
    const confirmed = window.confirm("¿Estás seguro de que quieres resetear este análisis? Se perderán todos los hallazgos actuales.");
    if (!confirmed) return;

    setResetting(true);
    try {
      toast({
        title: "Eliminando datos",
        description: "Limpiando hallazgos anteriores...",
      });

      await api.resetAssessment(id!);

      toast({
        title: "Reseteo completo",
        description: "Todos los hallazgos han sido eliminados. Puedes subir un nuevo archivo.",
      });

      setTimeout(() => {
        loadAssessment();
      }, 1000);

    } catch (error: any) {
      console.error('Error resetting:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo resetear",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleUploadFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    // Validate file type (accept .json and .zip)
    const isJson = file.name.endsWith('.json');
    const isZip = file.name.endsWith('.zip');
    
    if (!isJson && !isZip) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo JSON o ZIP válido",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileSizeMB = file.size / (1024 * 1024);
      const vpsUrl = import.meta.env.VITE_VPS_ENDPOINT || 'http://localhost:3000';

      // For large files or ZIP files, use the new upload endpoint
      if (fileSizeMB > 50 || isZip) {
        console.log(`[UPLOAD] Using large file endpoint for ${file.name} (${fileSizeMB.toFixed(2)}MB)`);
        
        toast({
          title: "Subiendo archivo",
          description: `${fileSizeMB.toFixed(1)}MB - Procesando ${isZip ? 'archivo comprimido' : 'archivo grande'}...`,
        });

        // Use FormData for multipart upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assessmentId', id);

        const response = await fetch(`${vpsUrl}/api/upload-large-file`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('[UPLOAD SUCCESS]', result);

        toast({
          title: "Archivo procesado",
          description: isZip 
            ? "Archivo descomprimido y análisis iniciado" 
            : "Análisis iniciado correctamente",
        });

        // Reload assessment after a short delay
        setTimeout(() => {
          loadAssessment();
        }, 2000);

      } else {
        // Original flow for small JSON files
        toast({
          title: "Subiendo archivo",
          description: `${fileSizeMB.toFixed(1)}MB - Procesando...`,
        });

        // Read file content
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const text = e.target?.result as string;
            const jsonData = JSON.parse(text);

            console.log(`[UPLOAD] Sending ${fileSizeMB.toFixed(2)}MB to VPS...`);

            // Send directly to VPS
            const response = await fetch(`${vpsUrl}/api/process-assessment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                assessmentId: id,
                jsonData: jsonData,
                domainName: assessment?.domain
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`VPS Error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('[UPLOAD SUCCESS]', result);

            toast({
              title: "Análisis iniciado",
              description: "Los datos se han enviado al servidor para su análisis.",
            });

            // Reload assessment
            setTimeout(() => {
              loadAssessment();
            }, 2000);

          } catch (err: any) {
            console.error('Error sending to VPS:', err);
            toast({
              title: "Error de conexión",
              description: `No se pudo conectar con el VPS: ${err.message}`,
              variant: "destructive",
            });
          } finally {
            setUploading(false);
            setUploadProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };

        reader.onerror = () => {
          toast({ title: "Error", description: "Error leyendo el archivo", variant: "destructive" });
          setUploading(false);
        };

        reader.readAsText(file);
      }

    } catch (error: any) {
      console.error('Error processing file:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar el archivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadReport = async () => {
    if (!assessment) {
      toast({
        title: "Error",
        description: "No hay assessment disponible",
        variant: "destructive",
      });
      return;
    }

    // If rawData is missing, user needs to re-upload the JSON file
    if (!rawData) {
      toast({
        title: "Datos raw no disponibles",
        description: "Este assessment fue procesado con el sistema antiguo. Por favor, vuelve a subir el archivo JSON para generar el reporte.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generando reporte",
        description: "Por favor espere...",
      });

      const blob = await generateReport({
        assessment,
        findings,
        rawData: rawData,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assessment-${assessment.domain}-${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Reporte generado",
        description: "El reporte se ha descargado correctamente",
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Error al generar el reporte",
        variant: "destructive",
      });
    }
  };

  const handleDownloadRawData = async () => {
    if (!rawData) {
      toast({
        title: "Error",
        description: "No hay datos raw disponibles para descargar",
        variant: "destructive",
      });
      return;
    }

    try {
      setDownloading(true);

      // Convert the raw data to JSON blob and download
      const jsonString = JSON.stringify(rawData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `raw-data-${assessment?.domain || 'assessment'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Datos descargados",
        description: "Los datos raw se han descargado correctamente",
      });
    } catch (error) {
      console.error('Error downloading raw data:', error);
      toast({
        title: "Error",
        description: "Error al descargar los datos raw",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const loadAssessment = async () => {
    try {
      // Load assessment (use maybeSingle to handle missing assessments)
      const assessmentData = await api.getAssessment(id);

      if (!assessmentData) {
        console.error('Assessment not found:', id);
        toast({
          title: "Assessment no encontrado",
          description: "El assessment no existe o fue eliminado.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      // Load assessment raw data for report generation
      let rawDataResult = null;
      try {
        rawDataResult = await api.getAssessmentData(id);
        setRawData(rawDataResult);
      } catch (error) {
        console.log('No raw data yet - file not uploaded or processed');
      }

      // Load findings
      const findingsData = await api.getFindings(id);

      // Extract stats from raw data - handle case where no data exists yet
      const dataObj = rawDataResult as any; // Use the fresh rawDataResult, not the state variable
      const stats = dataObj ? {
        totalUsers: dataObj.Users?.Data?.length || dataObj.Users?.length || 0,
        privilegedUsers: dataObj.Groups?.Data?.find((g: any) => g.Name === 'Domain Admins')?.Members?.length || 0,
        inactiveUsers: dataObj.Users?.Data?.filter((u: any) => {
          const lastLogon = u.LastLogonDate ? new Date(u.LastLogonDate) : null;
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          return lastLogon && lastLogon < ninetyDaysAgo;
        }).length || 0,
        gpoCount: dataObj.GPOs?.Data?.length || dataObj.GPOs?.length || 0,
      } : {
        totalUsers: 0,
        privilegedUsers: 0,
        inactiveUsers: 0,
        gpoCount: 0,
      };

      setAssessment({
        ...assessmentData,
        stats,
      });
      setFindings(findingsData || []);
    } catch (error) {
      console.error('Error loading assessment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header />
        <main className="container py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando assessment...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Header />
        <main className="container py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Assessment no encontrado</p>
            <Link to="/">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al Dashboard
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Header />

      <main className="container py-8">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{assessment.domain}</h1>
              <p className="text-muted-foreground">
                Assessment realizado el {new Date(assessment.created_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Estado: {assessment.status === 'completed' ? 'Completado' :
                  assessment.status === 'analyzing' ? 'Analizando' :
                    assessment.status === 'uploaded' ? 'Archivo Subido - Listo para Procesar' :
                      'Pendiente'}
              </p>
            </div>
            <div className="flex gap-3">
              {(assessment.status === 'pending' || assessment.status === 'uploaded') && !rawData && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    onClick={handleUploadFile}
                    disabled={uploading}
                    size="lg"
                    variant="default"
                  >
                    <Upload className={`h-5 w-5 mr-2 ${uploading ? 'animate-pulse' : ''}`} />
                    {uploading ? (uploadProgress ? `Subiendo ${uploadProgress.current}/${uploadProgress.total}` : 'Subiendo...') : 'Subir Datos JSON'}
                  </Button>
                </>
              )}
              {/* Logs button - always visible with pulse indicator during analysis */}
              <Button
                onClick={() => setLogsOpen(true)}
                variant="outline"
                size="lg"
                className="relative"
              >
                <Terminal className="h-5 w-5 mr-2" />
                Ver Logs en Tiempo Real
                {assessment.status === 'analyzing' && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                )}
              </Button>

              {assessment.status === 'analyzing' && (
                <>
                  <Button onClick={handleRetryAnalysis} disabled={retrying || resetting} variant="outline" size="lg">
                    <RefreshCw className={`h-5 w-5 mr-2 ${retrying ? 'animate-spin' : ''}`} />
                    {retrying ? 'Reintentando...' : 'Reintentar Análisis'}
                  </Button>
                  <Button
                    onClick={handleReset}
                    disabled={retrying || resetting}
                    variant="destructive"
                    size="sm"
                  >
                    <AlertTriangle className={`h-5 w-5 mr-2 ${resetting ? 'animate-pulse' : ''}`} />
                    {resetting ? 'Reseteando...' : 'Resetear Todo'}
                  </Button>
                </>
              )}
              {assessment.status === 'completed' && (
                <>
                  <Button onClick={handleDownloadReport} size="lg">
                    <FileText className="h-5 w-5 mr-2" />
                    Informe Principal
                  </Button>
                  {rawData && (
                    <Button
                      onClick={handleDownloadRawData}
                      variant="secondary"
                      disabled={downloading}
                      size="lg"
                      title="Descargar datos raw (JSON) como anexo técnico"
                    >
                      <Download className="h-5 w-5 mr-2" />
                      {downloading ? 'Descargando...' : 'Anexo Raw (JSON)'}
                    </Button>
                  )}
                </>
              )}
              {assessment.status !== 'completed' && rawData && (
                <Button
                  onClick={handleDownloadRawData}
                  variant="outline"
                  disabled={downloading}
                  size="lg"
                  title="Descargar datos raw (JSON) como anexo técnico"
                >
                  <Download className="h-5 w-5 mr-2" />
                  {downloading ? 'Descargando...' : 'Descargar Raw Data'}
                </Button>
              )}
            </div>
          </div>

          {/* Information banner for pending assessments */}
          {assessment.status === 'pending' && !rawData && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
                💡 ¿Cómo subir los datos del DC?
              </h3>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p><strong>Opción 1 - DC con Internet:</strong></p>
                <p className="ml-4">Ejecuta el script sin parámetros: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">.\AD-Assessment.ps1</code></p>

                <p className="mt-3"><strong>Opción 2 - DC sin Internet (Recomendado):</strong></p>
                <ol className="ml-4 list-decimal space-y-1">
                  <li>En el DC: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">.\AD-Assessment.ps1 -OfflineMode</code></li>
                  <li>El script guardará JSON y ZIP en <code className="bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">C:\AD-Assessments\</code></li>
                  <li>Copia el archivo <strong>ZIP</strong> a una PC con internet (más rápido, 70-80% más pequeño)</li>
                  <li>Usa el botón "Subir Datos JSON" arriba para cargar el archivo ZIP o JSON</li>
                </ol>

                <p className="mt-3 text-xs">
                  ℹ️ Archivos ZIP se procesan automáticamente. Soporta archivos hasta 5GB comprimidos.
                </p>
              </div>
            </div>
          )}

          {/* Raw Data Available indicator */}
          {rawData && assessment.status === 'completed' && (
            <Card className="mb-6 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1 text-green-900 dark:text-green-100">
                      📎 Anexo Técnico Disponible
                    </h3>
                    <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                      Los datos raw (JSON completo) están listos para descargar como anexo técnico del informe principal.
                      Este archivo contiene toda la información detallada extraída del Active Directory.
                    </p>
                    <Button
                      onClick={handleDownloadRawData}
                      variant="outline"
                      disabled={downloading}
                      size="sm"
                      className="border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloading ? 'Descargando...' : 'Descargar Anexo Raw (JSON)'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload progress indicator */}
          {uploadProgress && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {uploadProgress.current < uploadProgress.total
                        ? 'Subiendo y analizando chunks de usuarios'
                        : 'Finalizando análisis...'}
                    </span>
                    <span className="text-muted-foreground">{uploadProgress.current} / {uploadProgress.total}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Procesando en lotes de 10 para evitar sobrecargar el servidor. Por favor espera...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Usuarios</p>
                    <p className="text-2xl font-bold">{assessment.stats.totalUsers}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary opacity-70" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Privilegiados</p>
                    <p className="text-2xl font-bold">{assessment.stats.privilegedUsers}</p>
                  </div>
                  <Shield className="h-8 w-8 text-primary opacity-70" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Inactivos</p>
                    <p className="text-2xl font-bold">{assessment.stats.inactiveUsers}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-severity-medium opacity-70" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">GPOs</p>
                    <p className="text-2xl font-bold">{assessment.stats.gpoCount}</p>
                  </div>
                  <FileText className="h-8 w-8 text-primary opacity-70" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Findings Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Hallazgos de Seguridad</h2>

          {/* Show progress when analyzing */}
          {assessment.status === 'analyzing' && (
            <AnalysisProgress
              status={assessment.status}
              createdAt={assessment.created_at}
              progress={assessment.analysis_progress}
            />
          )}

          {findings.length === 0 && assessment.status !== 'analyzing' ? (
            <div className="text-center py-12 bg-card rounded-lg border border-border">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                No se encontraron hallazgos para este assessment.
              </p>
            </div>
          ) : findings.length > 0 ? (
            <div className="space-y-4">
              {findings.map((finding) => (
                <Card key={finding.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <SeverityBadge severity={finding.severity} />
                          <CardTitle className="text-xl">{finding.title}</CardTitle>
                        </div>
                        <CardDescription>{finding.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold mb-2 text-sm">Recomendación:</h4>
                      <p className="text-sm text-muted-foreground">{finding.recommendation}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </main>

      {/* Logs Modal */}
      {id && (
        <AssessmentLogs
          assessmentId={id}
          isOpen={logsOpen}
          onClose={() => setLogsOpen(false)}
        />
      )}
    </div>
  );
};

export default AssessmentDetail;
