import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, X, RefreshCw, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Log {
  timestamp: number;
  level: string;
  message: string;
}

interface AssessmentLogsProps {
  assessmentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AssessmentLogs = ({ assessmentId, isOpen, onClose }: AssessmentLogsProps) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      
      if (autoRefresh) {
        intervalRef.current = setInterval(() => {
          fetchLogs();
        }, 3000); // Refresh every 3 seconds
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, autoRefresh, assessmentId]);

  useEffect(() => {
    // Auto scroll to bottom when new logs arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-assessment-logs', {
        body: { assessmentId }
      });

      if (error) throw error;

      if (data?.logs) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadLogs = () => {
    const content = logs
      .map(log => `[${new Date(log.timestamp).toISOString()}] [${log.level}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-${assessmentId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-destructive';
      case 'warn':
        return 'text-severity-medium';
      case 'info':
        return 'text-primary';
      default:
        return 'text-muted-foreground';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col shadow-elegant">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Logs en Tiempo Real</h2>
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadLogs}
              disabled={logs.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Logs Content */}
        <ScrollArea className="flex-1 p-4">
          <div ref={scrollRef} className="space-y-1 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay logs disponibles
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="flex gap-2 py-1 hover:bg-accent/50 px-2 rounded">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    })}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`${getLevelColor(log.level)} text-xs px-1 py-0`}
                  >
                    {log.level}
                  </Badge>
                  <span className="text-foreground break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{logs.length} logs</span>
            <span>Assessment ID: {assessmentId.substring(0, 8)}...</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
