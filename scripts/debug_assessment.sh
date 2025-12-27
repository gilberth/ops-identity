#!/bin/zsh
# =============================================================================
# 🔍 AD360 Assessment Debug Suite
# =============================================================================
# Script automatizado para debugging completo de assessments
# Uso: ./debug_assessment.sh [ASSESSMENT_ID] [--full|--quick|--grounding]
# =============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuración
API_BASE="${AD360_API_URL:-https://ad360.gytech.com.pe}"
OUTPUT_DIR="${AD360_DEBUG_DIR:-./debug_output}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Funciones de utilidad
print_header() {
    echo ""
    echo "${PURPLE}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo "${PURPLE}║${NC} ${BOLD}${WHITE}$1${NC}"
    echo "${PURPLE}╚════════════════════════════════════════════════════════════════════╝${NC}"
}

print_section() {
    echo ""
    echo "${CYAN}┌──────────────────────────────────────────────────────────────────────┐${NC}"
    echo "${CYAN}│${NC} ${BOLD}$1${NC}"
    echo "${CYAN}└──────────────────────────────────────────────────────────────────────┘${NC}"
}

print_success() {
    echo "${GREEN}✓${NC} $1"
}

print_warning() {
    echo "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo "${RED}✗${NC} $1"
}

print_info() {
    echo "${BLUE}ℹ${NC} $1"
}

# Función para hacer requests con manejo de errores
api_call() {
    local endpoint=$1
    local output_file=$2
    local description=$3
    
    echo -n "${GRAY}  → Ejecutando: ${description}... ${NC}"
    
    local response=$(curl -s -w "\n%{http_code}" "${API_BASE}${endpoint}" 2>/dev/null)
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" == "200" ]]; then
        echo "${GREEN}OK${NC}"
        if [[ -n "$output_file" ]]; then
            echo "$body" > "$output_file"
            echo "     ${GRAY}Guardado en: ${output_file}${NC}"
        fi
        echo "$body"
        return 0
    else
        echo "${RED}ERROR (HTTP $http_code)${NC}"
        echo "$body"
        return 1
    fi
}

# Función para formatear JSON con jq si está disponible
format_json() {
    if command -v jq &> /dev/null; then
        jq '.'
    else
        cat
    fi
}

# Función para extraer y mostrar métricas clave
show_summary_metrics() {
    local json=$1
    
    if command -v jq &> /dev/null; then
        echo ""
        echo "${BOLD}📊 Métricas Clave:${NC}"
        echo "   ${GRAY}├─${NC} Health Score: $(echo "$json" | jq -r '.health.score // "N/A"')% ($(echo "$json" | jq -r '.health.grade // "N/A"'))"
        echo "   ${GRAY}├─${NC} Risk Level: $(echo "$json" | jq -r '.health.riskLevel // "N/A"')"
        echo "   ${GRAY}├─${NC} Total Findings: $(echo "$json" | jq -r '.findings.total // 0')"
        echo "   ${GRAY}├─${NC} Critical: $(echo "$json" | jq -r '.findings.distribution.critical // 0')"
        echo "   ${GRAY}├─${NC} High: $(echo "$json" | jq -r '.findings.distribution.high // 0')"
        echo "   ${GRAY}├─${NC} Medium: $(echo "$json" | jq -r '.findings.distribution.medium // 0')"
        echo "   ${GRAY}└─${NC} Total Objects: $(echo "$json" | jq -r '.data.totalObjects // 0')"
        
        # Debug Tips
        local tips=$(echo "$json" | jq -r '.debugTips[]? // empty')
        if [[ -n "$tips" ]]; then
            echo ""
            echo "${YELLOW}💡 Debug Tips:${NC}"
            echo "$tips" | while read tip; do
                echo "   $tip"
            done
        fi
    fi
}

# Función para mostrar resultados de grounding
show_grounding_results() {
    local json=$1
    
    if command -v jq &> /dev/null; then
        echo ""
        echo "${BOLD}🔗 Grounding Analysis:${NC}"
        echo "   ${GRAY}├─${NC} Grounding Score: $(echo "$json" | jq -r '.summary.groundingScore // "N/A"')%"
        echo "   ${GRAY}├─${NC} Verified: $(echo "$json" | jq -r '.summary.verified // 0')"
        echo "   ${GRAY}├─${NC} Partially Verified: $(echo "$json" | jq -r '.summary.partiallyVerified // 0')"
        echo "   ${GRAY}├─${NC} Unverified: $(echo "$json" | jq -r '.summary.unverified // 0')"
        echo "   ${GRAY}└─${NC} Global Findings: $(echo "$json" | jq -r '.summary.globalFindings // 0')"
        
        # Hallucinations
        local hallucinations=$(echo "$json" | jq -r '.hallucinations | length')
        if [[ "$hallucinations" -gt 0 ]]; then
            echo ""
            echo "${RED}🚨 Hallucinations Detected: $hallucinations${NC}"
            echo "$json" | jq -r '.hallucinations[:5][] | "   - \(.title) (\(.verificationRate)% verified)"'
        fi
        
        # Recommendations
        local recs=$(echo "$json" | jq -r '.recommendations[]? | "   [\(.priority)] \(.action)"')
        if [[ -n "$recs" ]]; then
            echo ""
            echo "${YELLOW}📋 Recommendations:${NC}"
            echo "$recs"
        fi
    fi
}

# Función para listar assessments disponibles
list_assessments() {
    print_header "📋 Assessments Disponibles"
    
    local response=$(curl -s "${API_BASE}/api/debug/assessments" 2>/dev/null)
    
    if command -v jq &> /dev/null; then
        echo ""
        echo "${BOLD}ID                                      | Domain              | Status     | Findings${NC}"
        echo "────────────────────────────────────────┼─────────────────────┼────────────┼──────────"
        echo "$response" | jq -r '.assessments[] | "\(.id) | \(.domain[:18]) | \(.status) | \(.findings)"' | head -20
        echo ""
        echo "${GRAY}Mostrando últimos 20 assessments. Total: $(echo "$response" | jq -r '.total')${NC}"
    else
        echo "$response"
    fi
}

# Función principal de debug
run_debug() {
    local assessment_id=$1
    local mode=${2:-"full"}
    
    print_header "🔍 AD360 Assessment Debug Suite"
    echo "${GRAY}Assessment ID: ${WHITE}$assessment_id${NC}"
    echo "${GRAY}Mode: ${WHITE}$mode${NC}"
    echo "${GRAY}API Base: ${WHITE}$API_BASE${NC}"
    echo "${GRAY}Timestamp: ${WHITE}$TIMESTAMP${NC}"
    
    # Crear directorio de output
    mkdir -p "$OUTPUT_DIR"
    local session_dir="$OUTPUT_DIR/${assessment_id}_${TIMESTAMP}"
    mkdir -p "$session_dir"
    
    # =========================================================================
    # 1. SUMMARY (Resumen Ejecutivo)
    # =========================================================================
    print_section "1️⃣  Resumen Ejecutivo (/summary)"
    
    local summary=$(curl -s "${API_BASE}/api/debug/assessments/${assessment_id}/summary" 2>/dev/null)
    echo "$summary" > "$session_dir/01_summary.json"
    
    if echo "$summary" | jq -e '.error' > /dev/null 2>&1; then
        print_error "$(echo "$summary" | jq -r '.error')"
    else
        print_success "Summary obtenido"
        show_summary_metrics "$summary"
    fi
    
    # =========================================================================
    # 2. VALIDATION (Detección de Alucinaciones)
    # =========================================================================
    print_section "2️⃣  Validación de Hallazgos (/validate)"
    
    local validation=$(curl -s "${API_BASE}/api/debug/assessments/${assessment_id}/validate" 2>/dev/null)
    echo "$validation" > "$session_dir/02_validation.json"
    
    if command -v jq &> /dev/null; then
        local total=$(echo "$validation" | jq -r '.totalFindings // 0')
        local valid=$(echo "$validation" | jq -r '.validFindings // 0')
        local hallucinations=$(echo "$validation" | jq -r '.hallucinationsDetected | length')
        
        echo "   ${GRAY}├─${NC} Total Findings: $total"
        echo "   ${GRAY}├─${NC} Valid Findings: $valid"
        echo "   ${GRAY}└─${NC} Hallucinations: $hallucinations"
        
        if [[ "$hallucinations" -gt 0 ]]; then
            print_warning "Se detectaron $hallucinations posibles alucinaciones"
        else
            print_success "No se detectaron alucinaciones"
        fi
    fi
    
    # =========================================================================
    # 3. DATA COVERAGE (Cobertura de Datos)
    # =========================================================================
    if [[ "$mode" == "full" || "$mode" == "data" ]]; then
        print_section "3️⃣  Cobertura de Datos (/data-coverage)"
        
        local coverage=$(curl -s "${API_BASE}/api/debug/assessments/${assessment_id}/data-coverage" 2>/dev/null)
        echo "$coverage" > "$session_dir/03_data_coverage.json"
        
        if command -v jq &> /dev/null; then
            local quality=$(echo "$coverage" | jq -r '.dataQuality.score // 0')
            local categories=$(echo "$coverage" | jq -r '.categories | length')
            local missing=$(echo "$coverage" | jq -r '.missingCategories | length')
            
            echo "   ${GRAY}├─${NC} Data Quality Score: $quality%"
            echo "   ${GRAY}├─${NC} Categories with Data: $categories"
            echo "   ${GRAY}└─${NC} Missing Categories: $missing"
            
            # Mostrar categorías con datos
            echo ""
            echo "   ${BOLD}Categorías con datos:${NC}"
            echo "$coverage" | jq -r '.categories[] | "   - \(.name): \(.count) objetos"' | head -10
            
            # Mostrar issues si existen
            local issues=$(echo "$coverage" | jq -r '.dataQuality.issues[]? // empty')
            if [[ -n "$issues" ]]; then
                echo ""
                print_warning "Issues de calidad de datos:"
                echo "$issues" | while read issue; do
                    echo "     - $issue"
                done
            fi
        fi
    fi
    
    # =========================================================================
    # 4. FINDINGS ANALYTICS
    # =========================================================================
    if [[ "$mode" == "full" || "$mode" == "findings" ]]; then
        print_section "4️⃣  Análisis de Hallazgos (/findings-analytics)"
        
        local analytics=$(curl -s "${API_BASE}/api/debug/assessments/${assessment_id}/findings-analytics" 2>/dev/null)
        echo "$analytics" > "$session_dir/04_findings_analytics.json"
        
        if command -v jq &> /dev/null; then
            local total=$(echo "$analytics" | jq -r '.overview.total // 0')
            local avg_affected=$(echo "$analytics" | jq -r '.overview.avg_affected_objects // 0')
            local quality=$(echo "$analytics" | jq -r '.quality.score // 0')
            
            echo "   ${GRAY}├─${NC} Total Findings: $total"
            echo "   ${GRAY}├─${NC} Avg Affected Objects: $avg_affected"
            echo "   ${GRAY}└─${NC} Quality Score: $quality%"
            
            # Distribución por severidad
            echo ""
            echo "   ${BOLD}Distribución por Severidad:${NC}"
            echo "$analytics" | jq -r '.distribution.bySeverity | to_entries[] | "   - \(.key): \(.value)"'
            
            # Patterns
            local duplicates=$(echo "$analytics" | jq -r '.patterns.duplicateTitles | length')
            local empty_evidence=$(echo "$analytics" | jq -r '.patterns.emptyEvidence | length')
            local suspicious=$(echo "$analytics" | jq -r '.patterns.suspiciousFindings | length')
            
            if [[ "$duplicates" -gt 0 || "$empty_evidence" -gt 0 || "$suspicious" -gt 0 ]]; then
                echo ""
                echo "   ${BOLD}⚠️ Patrones Detectados:${NC}"
                [[ "$duplicates" -gt 0 ]] && echo "   - Hallazgos duplicados: $duplicates"
                [[ "$empty_evidence" -gt 0 ]] && echo "   - Sin evidencia: $empty_evidence"
                [[ "$suspicious" -gt 0 ]] && echo "   - Sospechosos: $suspicious"
            fi
        fi
    fi
    
    # =========================================================================
    # 5. GROUNDING CHECK (Verificación Profunda)
    # =========================================================================
    if [[ "$mode" == "full" || "$mode" == "grounding" ]]; then
        print_section "5️⃣  Verificación de Grounding (/grounding-check)"
        
        local grounding=$(curl -s "${API_BASE}/api/debug/assessments/${assessment_id}/grounding-check" 2>/dev/null)
        echo "$grounding" > "$session_dir/05_grounding_check.json"
        
        show_grounding_results "$grounding"
    fi
    
    # =========================================================================
    # 6. DASHBOARD DATA
    # =========================================================================
    if [[ "$mode" == "full" ]]; then
        print_section "6️⃣  Dashboard Data (/dashboard-data)"
        
        local dashboard=$(curl -s "${API_BASE}/api/debug/assessments/${assessment_id}/dashboard-data" 2>/dev/null)
        echo "$dashboard" > "$session_dir/06_dashboard_data.json"
        
        if command -v jq &> /dev/null; then
            echo "   ${GRAY}├─${NC} Critical: $(echo "$dashboard" | jq -r '.scorecard.critical // 0')"
            echo "   ${GRAY}├─${NC} High: $(echo "$dashboard" | jq -r '.scorecard.high // 0')"
            echo "   ${GRAY}└─${NC} Total: $(echo "$dashboard" | jq -r '.scorecard.total // 0')"
            
            local top_risks=$(echo "$dashboard" | jq -r '.topRisks[:5][]? // empty')
            if [[ -n "$top_risks" ]]; then
                echo ""
                echo "   ${BOLD}Top Risks:${NC}"
                echo "$top_risks" | while read risk; do
                    echo "   - $risk"
                done
            fi
        fi
    fi
    
    # =========================================================================
    # 7. WORD DATA
    # =========================================================================
    if [[ "$mode" == "full" ]]; then
        print_section "7️⃣  Word Report Data (/word-data)"
        
        local word=$(curl -s "${API_BASE}/api/debug/assessments/${assessment_id}/word-data" 2>/dev/null)
        echo "$word" > "$session_dir/07_word_data.json"
        
        if command -v jq &> /dev/null; then
            echo "   ${GRAY}├─${NC} Findings Count: $(echo "$word" | jq -r '.findingsCount // 0')"
            echo "   ${GRAY}├─${NC} Users: $(echo "$word" | jq -r '.keyMetrics.users // 0')"
            echo "   ${GRAY}└─${NC} Computers: $(echo "$word" | jq -r '.keyMetrics.computers // 0')"
        fi
    fi
    
    # =========================================================================
    # RESUMEN FINAL
    # =========================================================================
    print_header "📁 Debug Session Complete"
    echo ""
    echo "${GREEN}✓${NC} Resultados guardados en: ${BOLD}$session_dir${NC}"
    echo ""
    echo "${GRAY}Archivos generados:${NC}"
    ls -la "$session_dir" 2>/dev/null | grep -v "^total" | awk '{print "  - " $NF}'
    echo ""
    
    # Generar reporte consolidado
    if command -v jq &> /dev/null; then
        echo "${CYAN}Generando reporte consolidado...${NC}"
        cat <<EOF > "$session_dir/00_REPORT.md"
# Debug Report: Assessment ${assessment_id}
Generated: $(date)

## Quick Summary
- **Health Score**: $(echo "$summary" | jq -r '.health.score // "N/A"')% ($(echo "$summary" | jq -r '.health.grade // "N/A"'))
- **Risk Level**: $(echo "$summary" | jq -r '.health.riskLevel // "N/A"')
- **Total Findings**: $(echo "$summary" | jq -r '.findings.total // 0')
- **Grounding Score**: $(echo "$grounding" | jq -r '.summary.groundingScore // "N/A"')%
- **Data Quality**: $(echo "$coverage" | jq -r '.dataQuality.score // "N/A"')%

## Severity Distribution
- Critical: $(echo "$summary" | jq -r '.findings.distribution.critical // 0')
- High: $(echo "$summary" | jq -r '.findings.distribution.high // 0')
- Medium: $(echo "$summary" | jq -r '.findings.distribution.medium // 0')
- Low: $(echo "$summary" | jq -r '.findings.distribution.low // 0')

## Issues Detected
$(echo "$coverage" | jq -r '.dataQuality.issues[]? // "None"' | sed 's/^/- /')

## Recommendations
$(echo "$grounding" | jq -r '.recommendations[]? | "- [\(.priority)] \(.action)"' 2>/dev/null || echo "- None")

---
*Generated by AD360 Debug Suite*
EOF
        print_success "Reporte generado: $session_dir/00_REPORT.md"
    fi
}

# ============================================================================
# MAIN
# ============================================================================

show_usage() {
    echo ""
    echo "${BOLD}AD360 Assessment Debug Suite${NC}"
    echo ""
    echo "${BOLD}Uso:${NC}"
    echo "  $0 <ASSESSMENT_ID> [MODE]"
    echo "  $0 --list"
    echo ""
    echo "${BOLD}Modos disponibles:${NC}"
    echo "  full       - Ejecuta todos los checks (default)"
    echo "  quick      - Solo summary y validation"
    echo "  grounding  - Focus en verificación de grounding"
    echo "  data       - Focus en cobertura de datos"
    echo "  findings   - Focus en análisis de findings"
    echo ""
    echo "${BOLD}Opciones:${NC}"
    echo "  --list     - Lista todos los assessments disponibles"
    echo "  --help     - Muestra esta ayuda"
    echo ""
    echo "${BOLD}Variables de entorno:${NC}"
    echo "  AD360_API_URL    - URL base del API (default: https://ad360.gytech.com.pe)"
    echo "  AD360_DEBUG_DIR  - Directorio de output (default: ./debug_output)"
    echo ""
    echo "${BOLD}Ejemplos:${NC}"
    echo "  $0 abc123-def456 full"
    echo "  $0 abc123-def456 grounding"
    echo "  $0 --list"
    echo ""
}

# Parse arguments
case "$1" in
    --list|-l)
        list_assessments
        exit 0
        ;;
    --help|-h|"")
        show_usage
        exit 0
        ;;
    *)
        if [[ -z "$1" ]]; then
            show_usage
            exit 1
        fi
        run_debug "$1" "${2:-full}"
        ;;
esac
