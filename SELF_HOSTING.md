# Guía de Self-Hosting para AD Security Assessment

Esta guía detalla los pasos necesarios para alojar esta aplicación en tu propia infraestructura.

## Tabla de Contenidos

- [Requisitos Previos](#requisitos-previos)
- [Configuración de Supabase](#configuración-de-supabase)
- [Configuración de la Aplicación](#configuración-de-la-aplicación)
- [Reemplazo de Lovable AI](#reemplazo-de-lovable-ai)
- [Despliegue del Frontend](#despliegue-del-frontend)
- [Configuración de Edge Functions](#configuración-de-edge-functions)
- [Consideraciones de Escalabilidad](#consideraciones-de-escalabilidad)

---

## Requisitos Previos

### Hardware Mínimo Recomendado

Para manejar archivos grandes (>100MB) de manera eficiente:

- **CPU**: 4 cores mínimo (8 cores recomendado)
- **RAM**: 16GB mínimo (32GB recomendado para análisis de archivos grandes)
- **Almacenamiento**: 100GB SSD mínimo
- **Ancho de banda**: 100Mbps mínimo

### Software Necesario

- Node.js 18+ o Bun
- Docker y Docker Compose
- Git
- Cuenta de Supabase (auto-hospedada o cloud)
- Cuenta de OpenAI o Google Cloud (para Gemini)

---

## Configuración de Supabase

### Opción 1: Supabase Cloud

1. Crea una cuenta en [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Guarda las credenciales:
   - URL del proyecto
   - Anon/Public key
   - Service role key

### Opción 2: Supabase Self-Hosted

```bash
# Clonar el repositorio de Supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus configuraciones

# Iniciar servicios
docker-compose up -d
```

### Configuración de la Base de Datos

Ejecuta las migraciones SQL ubicadas en `supabase/migrations/`:

```bash
# Si usas Supabase CLI
supabase db push

# O ejecuta manualmente cada archivo de migración en orden
```

### Configuración de Storage

1. Crea un bucket llamado `assessment-files`
2. Configura las políticas de acceso:

```sql
-- Permitir uploads autenticados
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assessment-files');

-- Permitir service role para todo
CREATE POLICY "Service role can do anything"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'assessment-files');
```

3. **IMPORTANTE**: Para archivos grandes, aumenta los límites:
   - En Supabase Cloud: Settings → Storage → Aumentar límites
   - Self-hosted: Edita `docker-compose.yml`:

```yaml
storage:
  environment:
    FILE_SIZE_LIMIT: 524288000 # 500MB
    UPLOAD_FILE_SIZE_LIMIT: 524288000
```

---

## Configuración de la Aplicación

### 1. Clonar el Repositorio

```bash
git clone [URL-DE-TU-REPO]
cd ad-security-assessment
```

### 2. Instalar Dependencias

```bash
npm install
# o
bun install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# OpenAI (recomendado para self-hosting)
OPENAI_API_KEY=tu-openai-key

# O Google Gemini
GOOGLE_GEMINI_API_KEY=tu-gemini-key

# Configuración de la aplicación
VITE_MAX_FILE_SIZE=524288000
```

---

## Reemplazo de Lovable AI

### ⚠️ Paso Crítico: Eliminar Dependencia de Lovable AI

La aplicación actualmente usa Lovable AI Gateway. Para self-hosting, debes reemplazarlo con tu propia implementación.

### 1. Actualizar la Configuración de AI

Edita `src/pages/AdminPanel.tsx` y elimina la opción "Lovable AI":

```tsx
// ANTES
<Select onValueChange={handleProviderChange} defaultValue={currentProvider}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="lovable">Lovable AI (Gemini 2.5 Flash)</SelectItem>
    <SelectItem value="gemini">Google Gemini</SelectItem>
    <SelectItem value="openai">OpenAI GPT-4o-mini</SelectItem>
  </SelectContent>
</Select>

// DESPUÉS
<Select onValueChange={handleProviderChange} defaultValue={currentProvider}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="gemini">Google Gemini 2.5 Flash</SelectItem>
    <SelectItem value="openai">OpenAI GPT-4o-mini</SelectItem>
  </SelectContent>
</Select>
```

### 2. Actualizar ai_config en la Base de Datos

```sql
-- Actualizar el proveedor por defecto
UPDATE ai_config 
SET provider = 'openai' -- o 'gemini'
WHERE id = (SELECT id FROM ai_config LIMIT 1);
```

### 3. Modificar Edge Function analyze-category

Edita `supabase/functions/analyze-category/index.ts`:

```typescript
// ELIMINAR la función analyzeWithLovable completamente
// ELIMINAR estas líneas:
// } else {
//   return await analyzeWithLovable(cat, prompt);
// }

// MODIFICAR la función analyze para usar solo OpenAI o Gemini:
async function analyze(cat: string, d: any, logToDb?: (level: string, message: string) => Promise<void>): Promise<any[]> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: configData } = await supabase
    .from('ai_config')
    .select('provider')
    .single();

  const provider = configData?.provider || 'openai'; // Cambiar default
  if (logToDb) await logToDb('info', `Using AI provider: ${provider}`);

  const prompt = build(cat, d);
  if (prompt.length > MAX_PROMPT) {
    console.log(`Truncating ${prompt.length} to ${MAX_PROMPT}`);
  }

  try {
    if (provider === 'openai') {
      return await analyzeWithOpenAI(cat, prompt);
    } else if (provider === 'gemini') {
      return await analyzeWithGemini(cat, prompt);
    } else {
      throw new Error(`Provider no soportado: ${provider}`);
    }
  } catch (e) {
    console.error('AI failed:', e);
    return [];
  }
}
```

### 4. Agregar Función para Gemini (si no existe)

```typescript
async function analyzeWithGemini(cat: string, prompt: string): Promise<any[]> {
  const key = Deno.env.get('GOOGLE_GEMINI_API_KEY');
  if (!key) {
    console.error('GOOGLE_GEMINI_API_KEY not found');
    return [];
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt.substring(0, MAX_PROMPT) }]
      }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: {
          type: "object",
          properties: {
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ['critical','high','medium','low'] },
                  title: { type: "string" },
                  description: { type: "string" },
                  recommendation: { type: "string" },
                  evidence: { type: "object" }
                },
                required: ['severity','title','description','recommendation']
              }
            }
          },
          required: ['findings']
        }
      }
    })
  });

  if (!res.ok) {
    console.error(`Gemini API error: ${res.status}`);
    return [];
  }

  const result = await res.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text) {
    const parsed = JSON.parse(text);
    return parsed.findings || [];
  }
  return [];
}
```

### 5. Eliminar Referencias a LOVABLE_API_KEY

Busca y elimina cualquier referencia a `LOVABLE_API_KEY` en:
- Edge functions
- Variables de entorno
- Documentación

---

## Despliegue del Frontend

### Opción 1: Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Opción 2: Netlify

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### Opción 3: Self-Hosted con Nginx

```bash
# Build de producción
npm run build

# Copiar archivos al servidor
scp -r dist/* user@server:/var/www/ad-assessment/

# Configuración de Nginx
cat > /etc/nginx/sites-available/ad-assessment << 'EOF'
server {
    listen 80;
    server_name tu-dominio.com;
    
    root /var/www/ad-assessment;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Aumentar límites para archivos grandes
    client_max_body_size 500M;
    client_body_buffer_size 10M;
}
EOF

# Activar sitio
ln -s /etc/nginx/sites-available/ad-assessment /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Configuración de Edge Functions

### Despliegue de Edge Functions

Si usas Supabase self-hosted, necesitas configurar Deno Deploy o usar el runtime local:

```bash
# Usando Supabase CLI
supabase functions deploy analyze-category
supabase functions deploy get-assessment-logs
supabase functions deploy upload-data
supabase functions deploy process-large-file

# O configura variables de entorno en cada función
supabase secrets set OPENAI_API_KEY=tu-key
supabase secrets set GOOGLE_GEMINI_API_KEY=tu-key
```

### Alternativa: Edge Functions Locales

Si prefieres no usar Deno Deploy, puedes convertir las edge functions a endpoints Express.js o similar.

---

## Consideraciones de Escalabilidad

### 1. Procesamiento de Archivos Grandes

Para archivos >200MB, considera:

#### Opción A: Worker Node Dedicado

```javascript
// worker.js - Procesa archivos en un proceso separado
const { Worker } = require('worker_threads');

function processLargeFile(filePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./file-processor.js', {
      workerData: { filePath }
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

#### Opción B: Queue System (Recomendado)

Usa BullMQ o similar para procesar archivos en background:

```bash
# Instalar Redis y BullMQ
npm install bullmq ioredis
```

```typescript
// queue.ts
import { Queue, Worker } from 'bullmq';

const analysisQueue = new Queue('file-analysis', {
  connection: { host: 'localhost', port: 6379 }
});

// Agregar trabajo
await analysisQueue.add('analyze', {
  assessmentId: 'xxx',
  filePath: 'path/to/file'
});

// Worker
const worker = new Worker('file-analysis', async job => {
  const { assessmentId, filePath } = job.data;
  // Procesar archivo
}, {
  connection: { host: 'localhost', port: 6379 }
});
```

### 2. Límites de Rate para APIs de AI

Implementa rate limiting y retry logic:

```typescript
import pRetry from 'p-retry';

async function callAIWithRetry(prompt: string) {
  return pRetry(
    async () => {
      const response = await fetch('https://api.openai.com/...');
      if (response.status === 429) {
        throw new Error('Rate limited');
      }
      return response;
    },
    {
      retries: 5,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 30000,
      onFailedAttempt: error => {
        console.log(`Attempt ${error.attemptNumber} failed. Retrying...`);
      }
    }
  );
}
```

### 3. Monitoreo

Implementa logging y alertas:

```bash
# Usar Grafana + Prometheus
docker-compose up -d prometheus grafana

# O servicios cloud
# - Sentry para errores
# - LogRocket para sesiones
# - DataDog para métricas
```

---

## Solución de Problemas Comunes

### Error: "Function exceeded timeout"

**Causa**: Archivos muy grandes o procesamiento lento de AI

**Solución**:
1. Aumenta el timeout en `supabase/config.toml`:
```toml
[functions.analyze-category]
verify_jwt = false
timeout_sec = 300  # 5 minutos
```

2. O implementa procesamiento por chunks más pequeños

### Error: "Out of memory"

**Causa**: Carga de archivo completo en memoria

**Solución**: Usa streaming:

```typescript
import { Readable } from 'stream';

async function processFileStream(filePath: string) {
  const stream = createReadStream(filePath);
  const chunks: any[] = [];
  
  for await (const chunk of stream) {
    // Procesar cada chunk
    await processChunk(chunk);
  }
}
```

### Error: "API quota exceeded"

**Causa**: Límite de cuota de OpenAI/Gemini alcanzado

**Solución**:
1. Implementa rate limiting en la aplicación
2. Usa múltiples API keys con load balancing
3. Implementa cola de procesamiento con delays

---

## Costos Estimados Mensuales

### Escenario 1: Uso Bajo (<100 assessments/mes)

- **Supabase Cloud**: $25/mes (Pro plan)
- **OpenAI API**: ~$50/mes
- **Hosting (Vercel)**: $20/mes
- **Total**: ~$95/mes

### Escenario 2: Uso Medio (500 assessments/mes)

- **Supabase Cloud**: $25/mes (Pro plan)
- **OpenAI API**: ~$250/mes
- **Hosting (VPS)**: $50/mes
- **Total**: ~$325/mes

### Escenario 3: Uso Alto (Self-hosted completo)

- **VPS (32GB RAM)**: $80-150/mes
- **OpenAI API**: ~$500+/mes
- **Monitoreo**: $30/mes
- **Total**: ~$610-680/mes

---

## Checklist de Despliegue

- [ ] Base de datos Supabase configurada
- [ ] Migraciones SQL aplicadas
- [ ] Storage bucket creado con políticas correctas
- [ ] Variables de entorno configuradas
- [ ] API keys de AI configuradas (OpenAI o Gemini)
- [ ] **Lovable AI removido completamente**
- [ ] Edge functions desplegadas
- [ ] Frontend construido y desplegado
- [ ] Dominios y DNS configurados
- [ ] SSL/TLS certificados instalados
- [ ] Monitoreo y logging configurados
- [ ] Backups automatizados configurados
- [ ] Pruebas de carga realizadas

---

## Soporte y Recursos

- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de OpenAI](https://platform.openai.com/docs)
- [Documentación de Gemini](https://ai.google.dev/docs)
- [Guía de Self-Hosting de Supabase](https://supabase.com/docs/guides/self-hosting)

---

## Licencia

[Especifica tu licencia aquí]

## Contribuciones

[Instrucciones para contribuir al proyecto]
