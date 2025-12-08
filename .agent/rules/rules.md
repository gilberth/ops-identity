---
trigger: always_on
---

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase
# Directrices Operativas del Sistema

1. **Ingeniería de Prompts y Meta-Prompts:**
   - Cualquier tarea que implique la modificación, generación o refactorización de prompts para modelos de IA debe regirse estrictamente por las directrices documentadas en `./guiaprompt.md`.
   - Considera este archivo como la **única fuente de verdad** (Source of Truth) para el estilo, estructura y tono de los prompts.

2. **Integración con Control de Versiones (GitHub):**
   - Para toda operación relacionada con repositorios remotos (commits, PRs, issues, búsquedas), utiliza **exclusivamente** el servidor MCP (Model Context Protocol) de GitHub configurado. No intentes ejecutar comandos de git locales si la acción requiere interacción con la plataforma GitHub.

3. **Generación de UI y Activos Visuales:**
   - Al recibir solicitudes para cambios de diseño frontend, maquetación o generación de imágenes, debes invocar obligatoriamente el modelo **"Nano Banana Pro"** (versión más reciente/latest).
   - No utilices modelos de texto estándar para generar o describir soluciones visuales si puedes generarlas directamente con este modelo.

# CONTEXTO DEL PROYECTO: HIGIENE OPERATIVA DE AD

Enfoque: Higiene Operativa, Arquitectura y Mejores Prácticas (Operational Health & Configuration Drift).
Objetivo: Detectar desorden administrativo y mala arquitectura que hacen al Directorio Activo ineficiente e inestable.
NO es un enfoque de Red Team/Hacking.

Competencia: PingCastle (salud), Quest, ManageEngine.
Excluir enfoque de: Purple Knight (seguridad ofensiva).

Nota: Priorizar la detección de "Deuda Técnica" (Replicación, GPOs Monolíticas) sobre vectores de ataque.

