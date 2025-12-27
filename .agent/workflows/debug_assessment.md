---
description: Run full debug suite on an assessment (Validate, Dashboard Data, Word Data, JSON, Trigger Analysis)
---

# 🔍 AD360 Assessment Debug Workflow

Este workflow ejecuta una suite completa de debugging para validar assessments y detectar alucinaciones.

## 📋 Prerequisitos

1. **Assessment ID**: Necesitas el UUID del assessment a debuggear
2. **jq instalado**: Para formateo de JSON (opcional pero recomendado)
3. **Acceso a la API**: El servidor debe estar corriendo

---

## 🚀 Método Rápido: Script Automatizado

El método más eficiente es usar el script de debugging:

```bash
# Dar permisos de ejecución
chmod +x scripts/debug_assessment.sh

# Listar assessments disponibles
./scripts/debug_assessment.sh --list

# Ejecutar debug completo
./scripts/debug_assessment.sh <ASSESSMENT_ID> full

# Ejecutar solo verificación de grounding
./scripts/debug_assessment.sh <ASSESSMENT_ID> grounding

# Ver ayuda
./scripts/debug_assessment.sh --help
```

### Modos Disponibles

| Modo | Descripción |
|------|-------------|
| `full` | Ejecuta todos los checks (default) |
| `quick` | Solo summary y validation |
| `grounding` | Focus en verificación de grounding |
| `data` | Focus en cobertura de datos |
| `findings` | Focus en análisis de findings |

### Output

El script genera:

- Archivos JSON individuales por cada endpoint
- Reporte consolidado en `00_REPORT.md`
- Todo guardado en `./debug_output/<ASSESSMENT_ID>_<TIMESTAMP>/`

---

## 📖 Método Manual: Endpoints Individuales

Si prefieres ejecutar manualmente, estos son los endpoints disponibles:

### 1️⃣ Listar Assessments Disponibles

```bash
curl -s "https://ad360.gytech.com.pe/api/debug/assessments" | jq
```

### 2️⃣ Resumen Ejecutivo (Nuevo ⭐)

Obtiene un resumen completo del assessment con health score, métricas y tips de debug:

```bash
curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/summary" | jq
```

**Incluye:**

- Health Score y Grade (A-F)
- Distribución de severidades
- Categorías de datos procesadas
- Tips de debugging automáticos
- Últimos 10 logs del proceso

### 3️⃣ Validación de Alucinaciones

Verifica que los objetos mencionados en findings existan en los datos:

```bash
curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/validate" | jq
```

**Output:**

```json
{
  "totalFindings": 25,
  "validFindings": 23,
  "hallucinationsDetected": [
    {
      "findingId": "...",
      "title": "...",
      "invalidObjects": ["objeto_inventado"]
    }
  ]
}
```

### 4️⃣ Cobertura de Datos (Nuevo ⭐)

Analiza qué datos fueron recolectados y su calidad:

```bash
curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/data-coverage" | jq
```

**Incluye:**

- Lista de categorías con datos
- Campos disponibles por categoría
- Categorías faltantes
- Score de calidad de datos
- Sample de datos por categoría

### 5️⃣ Análisis de Findings (Nuevo ⭐)

Analítica detallada de los hallazgos generados:

```bash
curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/findings-analytics" | jq
```

**Detecta:**

- Títulos duplicados
- Findings sin evidencia
- Findings sin remediación
- Patrones sospechosos

### 6️⃣ Verificación de Grounding (Nuevo ⭐)

Deep check de grounding - verifica cada objeto afectado contra los datos originales:

```bash
curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/grounding-check" | jq
```

**Output:**

```json
{
  "summary": {
    "totalFindings": 25,
    "verified": 20,
    "partiallyVerified": 3,
    "unverified": 2,
    "groundingScore": 86
  },
  "hallucinations": [...],
  "recommendations": [...]
}
```

### 7️⃣ Dashboard Data

Simula los datos que se muestran en el dashboard:

```bash
curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/dashboard-data" | jq
```

### 8️⃣ Word Report Data

Preview de los datos que van al reporte Word:

```bash
curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/word-data" | jq
```

### 9️⃣ Raw JSON Data

Ver el JSON original (primeros 1000 caracteres):

```bash
curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/json" | head -c 1000
```

### 🔟 Re-Ejecutar Análisis (⚠️ DESTRUCTIVO)

> **WARNING**: Esta acción borra los findings existentes y re-ejecuta el análisis.

```bash
curl -X POST "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/analyze"
```

---

## 🎯 Flujo de Debugging Recomendado

### Cuando hay pocos o cero findings

1. `/summary` → Verificar si hay datos cargados
2. `/data-coverage` → Verificar qué categorías tienen datos
3. Revisar logs en el summary para errores

### Cuando hay hallazgos sospechosos

1. `/validate` → Detectar alucinaciones básicas
2. `/grounding-check` → Verificación profunda
3. `/findings-analytics` → Buscar patrones problemáticos

### Cuando el reporte Word está mal

1. `/word-data` → Ver qué datos va a usar
2. `/summary` → Verificar métricas generales
3. Comparar con `/json` para diferencias

---

## 🛠️ Variables de Entorno

```bash
# Cambiar URL del API
export AD360_API_URL="http://localhost:3000"

# Cambiar directorio de output del script
export AD360_DEBUG_DIR="./my_debug_output"
```

---

## 📊 Interpretación de Scores

| Métrica | Bueno | Aceptable | Problemático |
|---------|-------|-----------|--------------|
| Health Score | 75-100% | 50-74% | <50% |
| Grounding Score | 85-100% | 70-84% | <70% |
| Data Quality | 60-100% | 40-59% | <40% |
| Findings Quality | 80-100% | 60-79% | <60% |

---

## 🐛 Troubleshooting Común

### "No findings to analyze"

- Verificar que el análisis completó (`/summary` → status)
- Revisar logs para errores de IA
- Usar `/analyze` para re-ejecutar

### "High hallucination count"

- Revisar prompts de IA en `server.js`
- Verificar que grounding está habilitado
- Comparar `/grounding-check` con `/validate`

### "Data quality score bajo"

- Revisar script de recolección PowerShell
- Verificar permisos en el dominio AD
- Buscar categorías críticas faltantes en `/data-coverage`
