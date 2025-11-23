import { Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Assessment {
  id: string;
  domain: string;
  date: string;
  status: string;
  criticalFindings: number;
  highFindings: number;
}

interface RecentActivityTimelineProps {
  assessments: Assessment[];
}

export const RecentActivityTimeline = ({ assessments }: RecentActivityTimelineProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En progreso';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-4">
      {assessments.map((assessment, index) => (
        <div
          key={assessment.id}
          className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
        >
          <div className="flex-shrink-0 mt-1">
            {getStatusIcon(assessment.status)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{assessment.domain}</p>
                <p className="text-sm text-muted-foreground">
                  {getStatusText(assessment.status)} • {formatDate(assessment.date)}
                </p>
              </div>
              <Link to={`/assessment/${assessment.id}`}>
                <Button variant="ghost" size="sm">
                  Ver detalles
                </Button>
              </Link>
            </div>
            
            {assessment.status === 'completed' && (
              <div className="flex gap-4 mt-2">
                {assessment.criticalFindings > 0 && (
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                    {assessment.criticalFindings} Critical
                  </span>
                )}
                {assessment.highFindings > 0 && (
                  <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                    {assessment.highFindings} High
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};


