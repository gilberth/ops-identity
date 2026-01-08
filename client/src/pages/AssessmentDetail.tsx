import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Shield, Users, FileText, AlertTriangle, RefreshCw, Upload, Terminal, Trash2 } from "lucide-react";

import SeverityBadge from "@/components/assessment/SeverityBadge";
import AnalysisProgress from "@/components/assessment/AnalysisProgress";
import { AssessmentLogs } from "@/components/assessment/AssessmentLogs";
import { api, getApiEndpoint } from "@/utils/api";
import { toast } from "@/hooks/use-toast";
import { generateRawDataPdf } from "@/lib/rawDataPdfGenerator";
import { generateReport } from "@/lib/reportGenerator";
import { SecurityScorecard } from "@/components/assessment/SecurityScorecard";
import { MaturityRadar } from "@/components/assessment/MaturityRadar";
import { FindingCard } from "@/components/assessment/FindingCard";

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

        const response = await fetch(`${getApiEndpoint()}/api/upload-large-file`, {
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
            const response = await fetch(`${getApiEndpoint()}/api/process-assessment`, {
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

  // Download JSON Raw formateado (archivo completo)
  const handleDownloadJsonRaw = () => {
    if (!rawData) {
      toast({ title: "Error", description: "No hay datos raw disponibles", variant: "destructive" });
      return;
    }
    const jsonString = JSON.stringify(rawData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raw-data-${assessment?.domain || 'domain'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast({ title: "JSON descargado", description: "Archivo JSON raw descargado correctamente" });
  };

  // Export CSV helper
  const exportToCSV = (data: any[], filename: string, columns: { key: string; header: string }[]) => {
    if (!data?.length) {
      toast({ title: "Sin datos", description: "No hay datos para exportar", variant: "destructive" });
      return;
    }
    const headers = columns.map(c => `"${c.header}"`).join(',');
    const rows = data.map(item => columns.map(col => {
      let value = item[col.key];
      if (Array.isArray(value)) value = value.length;
      if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
      return `"${String(value ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast({ title: "CSV exportado", description: `${data.length} registros exportados` });
  };

  const handleExportUsersCSV = () => exportToCSV(rawData?.Users || [], `users-${assessment?.domain}-${new Date().toISOString().split('T')[0]}.csv`, [
    { key: 'SamAccountName', header: 'Usuario' }, { key: 'DisplayName', header: 'Nombre' },
    { key: 'EmailAddress', header: 'Email' }, { key: 'Enabled', header: 'Habilitado' },
    { key: 'LastLogonDate', header: 'Último Logon' }, { key: 'PasswordLastSet', header: 'Password Establecido' },
    { key: 'PasswordNeverExpires', header: 'Password No Expira' }, { key: 'Department', header: 'Departamento' },
  ]);

  const handleExportComputersCSV = () => exportToCSV(rawData?.Computers || [], `computers-${assessment?.domain}-${new Date().toISOString().split('T')[0]}.csv`, [
    { key: 'Name', header: 'Nombre' }, { key: 'DNSHostName', header: 'DNS Hostname' },
    { key: 'IPv4Address', header: 'IPv4' }, { key: 'OperatingSystem', header: 'Sistema Operativo' },
    { key: 'Enabled', header: 'Habilitado' }, { key: 'LastLogonDate', header: 'Último Logon' },
  ]);

  const handleExportGroupsCSV = () => exportToCSV(rawData?.Groups || [], `groups-${assessment?.domain}-${new Date().toISOString().split('T')[0]}.csv`, [
    { key: 'Name', header: 'Nombre' }, { key: 'SamAccountName', header: 'SamAccountName' },
    { key: 'GroupCategory', header: 'Categoría' }, { key: 'GroupScope', header: 'Alcance' },
    { key: 'MemberCount', header: 'Miembros' }, { key: 'Description', header: 'Descripción' },
  ]);

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

      toast({
        title: "Generando anexo técnico",
        description: "Por favor espera mientras se genera el documento PDF...",
      });

      // Generate formatted PDF document
      const blob = await generateRawDataPdf({
        domain: assessment?.domain || 'Unknown',
        rawData: rawData,
        date: assessment?.created_at || new Date().toISOString(),
      });

      // Download the PDF document
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const domainName = assessment?.domain || 'domain';
      const date = new Date(assessment?.created_at || Date.now()).toISOString().split('T')[0];
      a.download = `anexo-tecnico-${domainName}-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Anexo generado",
        description: "El documento PDF se ha descargado correctamente",
      });
    } catch (error) {
      console.error('Error downloading raw data:', error);
      toast({
        title: "Error",
        description: "Error al generar el anexo técnico",
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
      } catch (error: any) {
        // 404 is expected for new assessments without uploaded data
        if (error.message?.includes('404') || error.status === 404) {
          console.log('[INFO] Waiting for data upload... (404 expected)');
        } else {
          console.warn('Error fetching raw data:', error);
        }
        setRawData(null); // Ensure rawData is null if fetch fails
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


      <main className="container py-8">
        <div className="mb-6">
          <Link to="/dashboard">
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

              <Button
                onClick={() => {
                  if (window.confirm("¿Estás seguro de que quieres ELIMINAR este assessment permanentemente? Esta acción no se puede deshacer.")) {
                    api.deleteAssessment(id!)
                      .then(() => {
                        toast({ title: "Assessment eliminado", description: "Redirigiendo al dashboard..." });
                        navigate('/dashboard');
                      })
                      .catch(err => toast({ title: "Error", description: err.message, variant: "destructive" }));
                  }
                }}
                variant="destructive"
                size="lg"
                title="Eliminar Assessment Permanentemente"
              >
                <Trash2 className="h-5 w-5 mr-2" />
                Eliminar
              </Button>
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
                      title="Generar anexo técnico formateado en PDF"
                    >
                      <FileText className="h-5 w-5 mr-2" />
                      {downloading ? 'Generando...' : 'Anexo Técnico'}
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
                  title="Descargar anexo técnico formateado en PDF"
                >
                  <FileText className="h-5 w-5 mr-2" />
                  {downloading ? 'Generando...' : 'Anexo Técnico (PDF)'}
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
                      📎 Datos Disponibles para Exportar
                    </h3>
                    <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                      Exporta los datos del assessment en diferentes formatos. Para datasets grandes (353k+ usuarios), usa CSV.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleDownloadRawData} variant="outline" disabled={downloading} size="sm"
                        className="border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900">
                        <FileText className="h-4 w-4 mr-2" />
                        {downloading ? 'Generando...' : 'Anexo PDF'}
                      </Button>
                      <Button onClick={handleDownloadJsonRaw} variant="outline" size="sm"
                        className="border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900">
                        <Download className="h-4 w-4 mr-2" />
                        JSON Completo
                      </Button>
                      <Button onClick={handleExportUsersCSV} variant="outline" size="sm"
                        className="border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900">
                        <Users className="h-4 w-4 mr-2" />
                        Usuarios CSV
                      </Button>
                      <Button onClick={handleExportComputersCSV} variant="outline" size="sm"
                        className="border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900">
                        <Terminal className="h-4 w-4 mr-2" />
                        Equipos CSV
                      </Button>
                      <Button onClick={handleExportGroupsCSV} variant="outline" size="sm"
                        className="border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900">
                        <Shield className="h-4 w-4 mr-2" />
                        Grupos CSV
                      </Button>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                      📊 {rawData?.Users?.length?.toLocaleString() || 0} usuarios • {rawData?.Computers?.length?.toLocaleString() || 0} equipos • {rawData?.Groups?.length?.toLocaleString() || 0} grupos
                    </p>
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

          {/* New Visualizations Section */}
          {assessment.status === 'completed' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <SecurityScorecard findings={findings} />
              <MaturityRadar findings={findings} />
            </div>
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
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          ) : null}
        </div>
      </main >

      {/* Logs Modal */}
      {
        id && (
          <AssessmentLogs
            assessmentId={id}
            isOpen={logsOpen}
            onClose={() => setLogsOpen(false)}
          />
        )
      }
    </div >
  );
};

export default AssessmentDetail;
