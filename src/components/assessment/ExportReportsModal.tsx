import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileText, Shield, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { generatePDF } from "@/lib/pdfGenerator";

interface ExportReportsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessments: any[];
}

export function ExportReportsModal({ open, onOpenChange, assessments }: ExportReportsModalProps) {
  const [reportType, setReportType] = useState<string>("executive");
  const [selectedAssessments, setSelectedAssessments] = useState<string[]>([]);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (selectedAssessments.length === 0) {
      toast({
        title: "Selección requerida",
        description: "Por favor selecciona al menos un assessment para exportar.",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      // Obtener los assessments seleccionados
      const selectedAssessmentData = assessments.filter(a => 
        selectedAssessments.includes(a.id)
      );

      // Generar y descargar el PDF
      await generatePDF({
        reportType: reportType as 'executive' | 'technical' | 'compliance',
        assessments: selectedAssessmentData,
        options: {
          includeCharts,
          includeRecommendations,
        },
      });

      toast({
        title: "Reporte exportado",
        description: `Se ha generado exitosamente el reporte ${reportType === 'executive' ? 'ejecutivo' : reportType === 'technical' ? 'técnico' : 'de compliance'}.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el reporte. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const toggleAssessment = (id: string) => {
    setSelectedAssessments(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedAssessments.length === assessments.length) {
      setSelectedAssessments([]);
    } else {
      setSelectedAssessments(assessments.map(a => a.id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Reportes
          </DialogTitle>
          <DialogDescription>
            Genera reportes profesionales en PDF de tus assessments de seguridad
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tipo de Reporte */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Tipo de Reporte</Label>
            <RadioGroup value={reportType} onValueChange={setReportType}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                <RadioGroupItem value="executive" id="executive" />
                <Label htmlFor="executive" className="flex-1 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <div className="font-semibold">Reporte Ejecutivo</div>
                      <div className="text-sm text-muted-foreground">
                        Resumen de alto nivel con métricas clave y recomendaciones estratégicas
                      </div>
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                <RadioGroupItem value="technical" id="technical" />
                <Label htmlFor="technical" className="flex-1 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-purple-500 mt-0.5" />
                    <div>
                      <div className="font-semibold">Reporte Técnico</div>
                      <div className="text-sm text-muted-foreground">
                        Detalles técnicos completos con hallazgos, evidencia y pasos de remediación
                      </div>
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                <RadioGroupItem value="compliance" id="compliance" />
                <Label htmlFor="compliance" className="flex-1 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-semibold">Reporte de Compliance</div>
                      <div className="text-sm text-muted-foreground">
                        Enfocado en cumplimiento normativo (NIST, ISO 27001, SOC 2)
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Selección de Assessments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Assessments a Incluir</Label>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedAssessments.length === assessments.length ? "Deseleccionar" : "Seleccionar"} todos
              </Button>
            </div>
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {assessments.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No hay assessments disponibles
                </div>
              ) : (
                assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-accent cursor-pointer"
                    onClick={() => toggleAssessment(assessment.id)}
                  >
                    <Checkbox
                      checked={selectedAssessments.includes(assessment.id)}
                      onCheckedChange={() => toggleAssessment(assessment.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{assessment.domain}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(assessment.date).toLocaleDateString()} • 
                        {assessment.criticalFindings > 0 && ` ${assessment.criticalFindings} críticos`}
                        {assessment.highFindings > 0 && ` ${assessment.highFindings} high`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Opciones Adicionales */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Opciones de Contenido</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="charts"
                  checked={includeCharts}
                  onCheckedChange={(checked) => setIncludeCharts(checked as boolean)}
                />
                <Label htmlFor="charts" className="cursor-pointer font-normal">
                  Incluir gráficas y visualizaciones
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recommendations"
                  checked={includeRecommendations}
                  onCheckedChange={(checked) => setIncludeRecommendations(checked as boolean)}
                />
                <Label htmlFor="recommendations" className="cursor-pointer font-normal">
                  Incluir recomendaciones de remediación
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={exporting || selectedAssessments.length === 0}>
            {exporting ? (
              <>
                <Download className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
