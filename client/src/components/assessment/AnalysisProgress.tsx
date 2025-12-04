import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AnalysisProgressProps {
  status: string;
  createdAt: string;
  progress?: {
    categories: Array<{ id: string; name: string; status: 'pending' | 'processing' | 'completed' }>;
    current: string | null;
    completed: number;
    total: number;
    lastError?: string | null;
    batchInfo?: {
      totalChunks: number;
      totalBatches: number;
      currentBatch: number;
      chunksProcessed: number;
    };
  };
}

const AnalysisProgress = ({ status, createdAt, progress }: AnalysisProgressProps) => {
  const elapsedMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

  const getStatusMessage = () => {
    if (progress?.current) {
      return progress.current;
    }
    
    // Check if we're processing chunks
    const processingChunks = progress?.total && progress.total > 8;
    
    if (processingChunks) {
      return `Procesando archivo grande en ${progress.total} lotes...`;
    }
    
    if (elapsedMinutes < 1) {
      return "Iniciando análisis...";
    } else if (elapsedMinutes < 3) {
      return "Procesando datos de Active Directory...";
    } else {
      return "Generando hallazgos de seguridad...";
    }
  };

  const progressPercentage = progress && progress.completed !== undefined && progress.total !== undefined && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : Math.min(Math.floor((elapsedMinutes / 10) * 100), 95);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div>
            <CardTitle className="text-lg">Análisis en Progreso</CardTitle>
            <CardDescription>
              {getStatusMessage()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Tiempo transcurrido: {elapsedMinutes} minuto{elapsedMinutes !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progreso general</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            
            {progress?.batchInfo && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Lotes procesados:</span>
                  <span className="font-medium">{progress.batchInfo.currentBatch}/{progress.batchInfo.totalBatches}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chunks procesados:</span>
                  <span className="font-medium">{progress.batchInfo.chunksProcessed}/{progress.batchInfo.totalChunks}</span>
                </div>
              </div>
            )}
          </div>

          {progress?.categories && progress.categories.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-medium">Análisis por categorías:</h4>
              <div className="space-y-2">
                {progress.categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2 text-sm">
                    {category.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : category.status === 'processing' ? (
                      <Loader2 className="w-4 h-4 text-yellow-500 animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <span className={
                      category.status === 'completed' 
                        ? 'text-foreground' 
                        : category.status === 'processing'
                        ? 'text-yellow-600 font-medium'
                        : 'text-muted-foreground'
                    }>
                      {category.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {progress?.lastError && (
            <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
              <p className="text-xs text-orange-600 dark:text-orange-500 font-medium mb-1">
                ⚠️ Problema detectado
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-500">
                {progress.lastError}
              </p>
            </div>
          )}

          {elapsedMinutes > 10 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-xs text-yellow-600 dark:text-yellow-500">
                ⚠️ El análisis está tomando más tiempo de lo esperado debido al tamaño del dataset.
                El proceso continuará ejecutándose en segundo plano.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisProgress;