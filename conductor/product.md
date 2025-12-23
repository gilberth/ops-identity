# Product Guide - OpsIdentity (Active Scan Insight)

## Initial Concept
**Higiene Operativa, Arquitectura y Mejores Prácticas (Operational Health & Configuration Drift).**

El objetivo principal de esta herramienta SaaS es encontrar **configuraciones no realizadas de la mejor manera**. No se trata de una herramienta de Pentesting ofensivo puro (como buscar hackers), sino de identificar **desorden administrativo, mala arquitectura y deuda técnica** que hacen que la infraestructura sea ineficiente, inestable y difícil de mantener.

> "No busco hackers rusos. Busco desorden administrativo, mala arquitectura y configuraciones subóptimas. Quiero decirle al cliente: Tienes 100 Global Admins (mal), tu replicación tarda 8 horas (mal), tus GPOs son monolíticas (mal)."

**La seguridad es un resultado secundario de una buena higiene operativa.**

## Misión & Objetivos
Transformar la gestión de Active Directory de un estado de "supervivencia y desorden" a uno de "higiene operativa y eficiencia". La herramienta actúa como un auditor de arquitectura automatizado que expone la deuda técnica acumulada y el "Configuration Drift".

## Diferenciación Competitiva
- **vs PingCastle:** Enfoque puro en "Configuration Drift" operativo vs híbrido de seguridad.
- **vs Quest AD Health:** Modelo SaaS moderno con enfoque consultivo vs herramienta Enterprise tradicional.
- **vs Purple Knight:** Enfoque en higiene y arquitectura vs seguridad ofensiva.
- **Valor Único:** Assessment instantáneo y self-service que prioriza la eficiencia y estabilidad de la infraestructura.

## Target Audience
- **Equipos de IT e Infraestructura:** Responsables de la operación diaria que necesitan visibilidad sobre ineficiencias.
- **Arquitectos de Soluciones:** Profesionales que diseñan y validan topologías de directorio.
- **Consultores de Active Directory:** Expertos que realizan diagnósticos de salud y planes de remediación.
- **CTOs/CIOs:** Ejecutivos que requieren métricas claras sobre la deuda técnica y riesgos operativos.

## Core Features & Findings (Operational Health Focus)

La herramienta evalúa la salud del directorio a través de métricas críticas de industria, enfocándose en:

1.  **Arquitectura y Topología (Site Topology):**
    -   Identificación de **Sites sin Subnets** (clientes autenticando mal).
    -   Detección de **conexiones de replicación manuales** excesivas vs KCC.
    -   Análisis de latencia de replicación (>8 horas es crítico).
    -   Validación de la ubicación de Domain Controllers (ej. no usar "Default-First-Site-Name").

2.  **Gestión de Privilegios y Governance:**
    -   Detección de **"Admin Sprawl"**: Exceso de Global Admins (>100) y cuentas de servicio con altos privilegios.
    -   Identificación de **grupos vacíos** o sin managers responsables.
    -   Análisis de anidación circular de grupos y "Token Bloat".

3.  **Salud de GPOs (Configuration Drift):**
    -   Identificación de **GPOs monolíticas** (>50 settings) que mezclan propósitos.
    -   Detección de GPOs huérfanas (sin links) o vacías.
    -   Alertas sobre **Block Inheritance** en OUs (Shadow IT).
    -   Verificación de consistencia de versiones entre AD y Sysvol.

4.  **Infraestructura Core (DNS/DHCP/FSMO):**
    -   **FSMO Health:** Validación de roles en un solo DC (SPOF) y sincronización de tiempo del PDC (evitar VM IC).
    -   **DNS:** Registros obsoletos (stale records), zonas _msdcs dañadas y configuración de forwarders.
    -   **DHCP:** Agotamiento de scopes, detección de servidores rogue y auditoría de opciones críticas.
    -   **Trusts:** Validación funcional de relaciones de confianza y antigüedad de contraseñas de trust.

5.  **Higiene de Objetos y Limpieza:**
    -   Usuarios y equipos inactivos (stale >90 días).
    -   Objetos huérfanos (Foreign Security Principals).
    -   SPNs duplicados que causan fallos silenciosos de Kerberos.

## Sistema Anti-Alucinaciones (Smart Filtering)
Para garantizar la precisión y relevancia:
-   **Pre-filtrado Inteligente:** Solo se envían a la IA datos problemáticos (ej. usuarios con password que no expira, GPOs sin links), reduciendo el ruido y tokens.
-   **Regla de Oro de Grounding:** La IA tiene prohibido inventar nombres de objetos; todo hallazgo se valida contra los datos originales.
-   **Validación Post-IA:** Verificación recursiva para asegurar que cada objeto reportado existe realmente en el inventario.
