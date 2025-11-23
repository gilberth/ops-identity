import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

const severityConfig: Record<Severity, { label: string; className: string }> = {
  critical: {
    label: "CRÍTICO",
    className: "bg-severity-critical text-white hover:bg-severity-critical/90",
  },
  high: {
    label: "ALTO",
    className: "bg-severity-high text-white hover:bg-severity-high/90",
  },
  medium: {
    label: "MEDIO",
    className: "bg-severity-medium text-white hover:bg-severity-medium/90",
  },
  low: {
    label: "BAJO",
    className: "bg-severity-low text-white hover:bg-severity-low/90",
  },
  info: {
    label: "INFO",
    className: "bg-severity-info text-white hover:bg-severity-info/90",
  },
};

const SeverityBadge = ({ severity, className }: SeverityBadgeProps) => {
  const config = severityConfig[severity];
  
  return (
    <Badge className={cn(config.className, "font-semibold", className)}>
      {config.label}
    </Badge>
  );
};

export default SeverityBadge;
