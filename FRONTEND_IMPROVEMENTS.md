# Mejoras para el Frontend de Active Scan Insight SaaS

Este documento resume las mejoras sugeridas para elevar la calidad del SaaS "Active Scan Insight", basándose en un análisis de los líderes del mercado en auditoría de Active Directory como **PingCastle**, **Purple Knight**, **Tenable.ad** y **BloodHound**.

## 1. Visualización Avanzada (El factor "Wow")
Las herramientas líderes se diferencian por visualizar relaciones complejas de forma intuitiva, no solo con gráficos de barras.

### Gráficos de Grafos (Attack Paths)
*   **Concepto:** Un mapa interactivo de nodos y enlaces que muestra visualmente cómo un atacante o usuario puede escalar privilegios (ej. Usuario A -> Grupo B -> Admin Local en Servidor C).
*   **Referencia:** *BloodHound Enterprise* y *Tenable.ad*.
*   **Implementación:** "Mapa de Relaciones de Confianza" o "Ruta de Ataque a Domain Admins".
*   **Herramienta Sugerida:** `react-force-graph` o `cytoscape.js` (librerías potentes para grafos 2D/3D).

### Radar de Madurez (Spider Chart)
*   **Concepto:** Un gráfico pentagonal que muestra el nivel de madurez en áreas clave de seguridad.
*   **Áreas Sugeridas:** Gestión de Cuentas, GPOs, Infraestructura, Kerberos, DNS.
*   **Referencia:** *PingCastle*.
*   **Herramienta Sugerida:** `recharts` (componente `<RadarChart />`).

## 2. Gamificación y Scoring (Security Scorecard)
Los ejecutivos necesitan métricas simples y directas para entender el estado de seguridad.

### Sistema de Calificación (A-F)
*   **Concepto:** Asignar una nota global en lugar de solo un conteo de hallazgos.
    *   **A (90-100):** Seguro / Excelente.
    *   **C (70-79):** Riesgo Moderado / Aceptable.
    *   **F (<60):** Peligro Inminente / Crítico.
*   **Referencia:** *Purple Knight* y *SecurityScorecard*.
*   **Implementación:** Un componente visual prominente en el Dashboard (anillo de progreso con código de colores semáforo).

## 3. Remediación Activa (Playbooks)
Aportar valor inmediato ofreciendo la solución, no solo el problema.

### Generador de Scripts PowerShell
*   **Concepto:** Botón "Generar Script de Fix" en el detalle de cada hallazgo.
*   **Funcionalidad:** Muestra un bloque de código con los comandos exactos para remediar el problema específico (ej. script para deshabilitar usuarios inactivos detectados).
*   **Herramienta Sugerida:** `react-syntax-highlighter` o `@monaco-editor/react` (para una experiencia tipo VS Code con botón de copiar).

## 4. Comparativas y Tendencias (Diff View)
El valor de un SaaS recurrente es la visibilidad de la evolución en el tiempo.

### Vista de "Cambios desde el último escaneo"
*   **Concepto:** Una tabla o vista que resalte solo las diferencias.
*   **Ejemplo:** "+2 Nuevos Domain Admins", "-5 Usuarios Inactivos eliminados", "Nueva GPO detectada".
*   **Referencia:** *Netwrix Auditor*.

## 5. Compliance Mapping
Facilitar el uso de la herramienta para auditorías regulatorias.

### Vistas de Cumplimiento
*   **Concepto:** Filtros rápidos para ver hallazgos según normativas específicas.
*   **Opciones:** "Vista ISO 27001", "Vista NIST", "Vista GDPR", "Vista CIS Controls".
*   **Implementación:** Etiquetas (tags) en cada hallazgo que permitan filtrar la lista dinámicamente.

## Resumen de Stack Tecnológico Sugerido (React)

| Categoría | Herramienta Sugerida | Caso de Uso Principal |
| :--- | :--- | :--- |
| **Grafos** | `react-force-graph` | Visualizar relaciones de confianza, anidamiento de grupos y rutas de ataque. |
| **Mapas** | `react-simple-maps` | Visualización de geolocalización de IPs (si aplica). |
| **Editor de Código** | `@monaco-editor/react` | Mostrar scripts de remediación de forma profesional y editable. |
| **Animaciones UI** | `framer-motion` | Transiciones suaves, carga de tarjetas y feedback visual premium. |
| **Onboarding** | `react-joyride` | Tours guiados para nuevos usuarios ("Aquí está tu Score", "Cómo exportar"). |
| **Gráficos** | `recharts` | Gráficos de radar, líneas de tendencia y barras (ya en uso, expandir uso). |
