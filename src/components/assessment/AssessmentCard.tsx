import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, Building2, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import SeverityBadge from "./SeverityBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface AssessmentCardProps {
  id: string;
  domain: string;
  date: string;
  status: "pending" | "completed" | "analyzing";
  criticalFindings: number;
  highFindings: number;
  onDelete: (id: string) => void;
}

const AssessmentCard = ({ 
  id, 
  domain, 
  date, 
  status, 
  criticalFindings, 
  highFindings,
  onDelete 
}: AssessmentCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const statusLabels = {
    pending: "Pendiente",
    analyzing: "Analizando",
    completed: "Completado",
  };

  // Check if analyzing for more than 10 minutes
  const isStuck = status === 'analyzing' && 
    new Date().getTime() - new Date(date).getTime() > 10 * 60 * 1000;

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(id);
    setIsDeleting(false);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{domain}</CardTitle>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">{statusLabels[status]}</span>
            {isStuck && (
              <span className="text-xs text-severity-medium">
                Atascado - Haz clic en detalles para reintentar
              </span>
            )}
          </div>
        </div>
        <CardDescription className="flex items-center space-x-1">
          <Calendar className="h-3 w-3" />
          <span>{new Date(date).toLocaleString('es-ES', { 
            dateStyle: 'short', 
            timeStyle: 'short' 
          })}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {criticalFindings > 0 && (
              <div className="flex items-center space-x-1">
                <SeverityBadge severity="critical" />
                <span className="text-sm font-medium">{criticalFindings}</span>
              </div>
            )}
            {highFindings > 0 && (
              <div className="flex items-center space-x-1">
                <SeverityBadge severity="high" />
                <span className="text-sm font-medium">{highFindings}</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Link to={`/assessment/${id}`}>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Ver Detalles
              </Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar assessment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará permanentemente el assessment de <strong>{domain}</strong> y todos sus hallazgos asociados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssessmentCard;
