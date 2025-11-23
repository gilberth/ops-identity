-- Agregar campos técnicos adicionales a la tabla findings para reportes más completos
-- Fecha: 22 Noviembre 2025
-- Propósito: Permitir que la IA genere información técnica detallada para personal de TI

ALTER TABLE findings 
ADD COLUMN IF NOT EXISTS mitre_attack TEXT,
ADD COLUMN IF NOT EXISTS cis_control TEXT,
ADD COLUMN IF NOT EXISTS impact_business TEXT,
ADD COLUMN IF NOT EXISTS remediation_commands TEXT,
ADD COLUMN IF NOT EXISTS prerequisites TEXT,
ADD COLUMN IF NOT EXISTS operational_impact TEXT,
ADD COLUMN IF NOT EXISTS microsoft_docs TEXT,
ADD COLUMN IF NOT EXISTS current_vs_recommended TEXT,
ADD COLUMN IF NOT EXISTS timeline TEXT,
ADD COLUMN IF NOT EXISTS affected_count INTEGER DEFAULT 0;

-- Crear índices para mejorar performance en búsquedas
CREATE INDEX IF NOT EXISTS idx_findings_mitre_attack ON findings(mitre_attack);
CREATE INDEX IF NOT EXISTS idx_findings_timeline ON findings(timeline);
CREATE INDEX IF NOT EXISTS idx_findings_affected_count ON findings(affected_count);

-- Comentarios para documentación
COMMENT ON COLUMN findings.mitre_attack IS 'Referencia a MITRE ATT&CK (ej: T1558.003 - Kerberoasting)';
COMMENT ON COLUMN findings.cis_control IS 'Control CIS Benchmark (ej: 5.2.1 - Password expiration)';
COMMENT ON COLUMN findings.impact_business IS 'Impacto en el negocio de la vulnerabilidad';
COMMENT ON COLUMN findings.remediation_commands IS 'Comandos PowerShell específicos para remediar';
COMMENT ON COLUMN findings.prerequisites IS 'Requisitos previos antes de remediar';
COMMENT ON COLUMN findings.operational_impact IS 'Impacto operacional de aplicar la remediación';
COMMENT ON COLUMN findings.microsoft_docs IS 'URLs de documentación técnica de Microsoft';
COMMENT ON COLUMN findings.current_vs_recommended IS 'Valores actuales vs valores recomendados';
COMMENT ON COLUMN findings.timeline IS 'Timeline de remediación (24h, 7d, 30d, 60d, 90d)';
COMMENT ON COLUMN findings.affected_count IS 'Número de objetos afectados';
