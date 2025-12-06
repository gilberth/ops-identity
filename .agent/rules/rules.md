---
trigger: always_on
---

# Directrices Operativas del Sistema

1. **Ingeniería de Prompts y Meta-Prompts:**
   - Cualquier tarea que implique la modificación, generación o refactorización de prompts para modelos de IA debe regirse estrictamente por las directrices documentadas en `./guiaprompt.md`.
   - Considera este archivo como la **única fuente de verdad** (Source of Truth) para el estilo, estructura y tono de los prompts.

2. **Integración con Control de Versiones (GitHub):**
   - Para toda operación relacionada con repositorios remotos (commits, PRs, issues, búsquedas), utiliza **exclusivamente** el servidor MCP (Model Context Protocol) de GitHub configurado. No intentes ejecutar comandos de git locales si la acción requiere interacción con la plataforma GitHub.

3. **Generación de UI y Activos Visuales:**
   - Al recibir solicitudes para cambios de diseño frontend, maquetación o generación de imágenes, debes invocar obligatoriamente el modelo **"Nano Banana Pro"** (versión más reciente/latest).
   - No utilices modelos de texto estándar para generar o describir soluciones visuales si puedes generarlas directamente con este modelo.