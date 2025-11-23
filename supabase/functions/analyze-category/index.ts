import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PROMPT = 8000; // 8KB prompt limit for AI
const MAX_CATEGORY_FILE = 300 * 1024 * 1024; // 300MB per category file for large Users chunks

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assessmentId, categoryId, categoryData, categoryFilePath, isChunk, chunkInfo, contextData } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Helper function to log to database
    const logToDb = async (level: string, message: string, metadata?: any) => {
      const { error } = await supabase.from('assessment_logs').insert({
        assessment_id: assessmentId,
        category_id: categoryId,
        level,
        message,
        metadata
      });
      if (error) console.error('Failed to log:', error);
    };

    await logToDb('info', `Starting analysis${isChunk ? ` (chunk ${chunkInfo.chunkNumber}/${chunkInfo.totalChunks})` : ''}`);

    let data;
    
    // Option 1: categoryData provided directly (new simple system)
    if (categoryData) {
      await logToDb('info', 'Using provided category data (direct)');
      data = categoryData;
      await logToDb('info', `Data elements: ${Array.isArray(data) ? data.length : 'object'}`);
    }
    // Option 2: categoryFilePath provided (legacy/fallback)
    else if (categoryFilePath) {
      await logToDb('info', `Downloading from: ${categoryFilePath}`);
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('assessment-files')
        .download(categoryFilePath);

      if (downloadError || !fileData) {
        await logToDb('error', `Download error: ${downloadError?.message || 'Unknown error'}`);
        throw new Error('Download failed');
      }

      const size = fileData.size;
      await logToDb('info', `File size: ${(size/1024).toFixed(1)}KB`);
      
      if (size > MAX_CATEGORY_FILE) {
        await logToDb('error', `File too large: ${(size/1024/1024).toFixed(1)}MB (max 300MB)`);
        throw new Error(`File too large: ${(size/1024/1024).toFixed(1)}MB (max 300MB)`);
      }

      await logToDb('info', 'Parsing JSON...');
      const text = await fileData.text();
      
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        await logToDb('error', `JSON parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        throw new Error('Invalid JSON format');
      }
    } else {
      await logToDb('error', 'Neither categoryData nor categoryFilePath provided');
      throw new Error('Missing category data or file path');
    }
    
    if (!data || (Array.isArray(data) && !data.length)) {
      await logToDb('info', 'No data found, skipping');
      return ok(categoryId, 0);
    }

    await logToDb('info', 'Starting AI analysis...');
    const findings = await analyze(categoryId, data, logToDb);
    await logToDb('info', `AI analysis complete: ${findings.length} findings`);

    if (findings?.length) {
      await logToDb('info', `Saving ${findings.length} findings to database...`);
      
      // Validate and ensure all required fields are present
      const validFindings = findings.map(f => ({
        assessment_id: assessmentId,
        category_id: categoryId,
        severity: f.severity || 'medium',
        title: f.title || 'Security Issue',
        description: f.description || 'No description provided',
        recommendation: f.recommendation || 'Review and assess this finding',
        evidence: f.evidence || null
      }));
      
      const { error: insertError } = await supabase.from('findings').insert(validFindings);
      
      if (insertError) {
        await logToDb('error', `Error saving findings: ${insertError.message}`);
        throw new Error(`Failed to save findings: ${insertError.message}`);
      }
      await logToDb('info', 'Findings saved successfully');
    } else {
      await logToDb('info', 'No findings to save');
    }

    await logToDb('info', 'Chunk processing complete');

    await logToDb('info', 'Cleaning up category file...');
    await supabase.storage.from('assessment-files').remove([categoryFilePath]).catch(err => 
      logToDb('warn', `Cleanup warning: ${err.message}`)
    );
    
    await logToDb('info', `✓ Complete with ${findings.length} findings`);
    return ok(categoryId, findings.length);

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function ok(cat: string, count: number) {
  return new Response(
    JSON.stringify({ success: true, categoryId: cat, findingsCount: count }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function analyze(cat: string, d: any, logToDb?: (level: string, message: string) => Promise<void>): Promise<any[]> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Get AI provider config
  const { data: configData } = await supabase
    .from('ai_config')
    .select('provider')
    .single();

  const provider = configData?.provider || 'lovable';
  if (logToDb) await logToDb('info', `Using AI provider: ${provider}`);

  const prompt = build(cat, d);
  if (prompt.length > MAX_PROMPT) {
    console.log(`Truncating ${prompt.length} to ${MAX_PROMPT}`);
  }

  try {
    if (provider === 'openai') {
      return await analyzeWithOpenAI(cat, prompt);
    } else {
      return await analyzeWithLovable(cat, prompt);
    }
  } catch (e) {
    console.error('AI failed:', e);
    return [];
  }
}

async function analyzeWithLovable(cat: string, prompt: string): Promise<any[]> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) {
    console.error('LOVABLE_API_KEY not found');
    return [];
  }

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Experto en seguridad AD. Reporta SOLO problemas críticos.' },
        { role: 'user', content: prompt.substring(0, MAX_PROMPT) }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'report_findings',
          parameters: {
            type: 'object',
            properties: {
              findings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    severity: { type: 'string', enum: ['critical','high','medium','low'] },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    recommendation: { type: 'string' },
                    evidence: { type: 'object' }
                  },
                  required: ['severity','title','description','recommendation']
                }
              }
            },
            required: ['findings']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'report_findings' } }
    })
  });

  if (!res.ok) {
    console.error(`Lovable AI error: ${res.status}`);
    return [];
  }

  const result = await res.json();
  const tc = result.choices?.[0]?.message?.tool_calls?.[0];
  if (tc?.function?.name === 'report_findings') {
    return JSON.parse(tc.function.arguments).findings || [];
  }
  return [];
}

async function analyzeWithOpenAI(cat: string, prompt: string): Promise<any[]> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) {
    console.error('OPENAI_API_KEY not found');
    return [];
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Experto en seguridad AD. Reporta SOLO problemas críticos.' },
        { role: 'user', content: prompt.substring(0, MAX_PROMPT) }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'report_findings',
          parameters: {
            type: 'object',
            properties: {
              findings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    severity: { type: 'string', enum: ['critical','high','medium','low'] },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    recommendation: { type: 'string' },
                    evidence: { type: 'object' }
                  },
                  required: ['severity','title','description','recommendation']
                }
              }
            },
            required: ['findings']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'report_findings' } }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`OpenAI error: ${res.status} - ${errorText}`);
    return [];
  }

  const result = await res.json();
  const tc = result.choices?.[0]?.message?.tool_calls?.[0];
  if (tc?.function?.name === 'report_findings') {
    return JSON.parse(tc.function.arguments).findings || [];
  }
  return [];
}

function build(cat: string, d: any): string {
  const str = (v: any, max: number) => JSON.stringify(v || []).substring(0, max);
  
  // Extract base category from chunk names
  const baseCategory = cat.includes('_chunk_') ? cat.split('_chunk_')[0] : cat;
  
  switch (baseCategory) {
    case 'users':
      // Handle chunk format: { Users: [...] }
      if (d.Users && Array.isArray(d.Users)) {
        const users = d.Users;
        const privileged = users.filter((u: any) => 
          u.AdminCount > 0 || 
          (u.MemberOf && Array.isArray(u.MemberOf) && u.MemberOf.some((g: string) => 
            g.toLowerCase().includes('admin') || g.toLowerCase().includes('domain admins') || g.toLowerCase().includes('enterprise admins')
          ))
        );
        const inactive = users.filter((u: any) => 
          u.Enabled === false || 
          (u.LastLogonTimestamp && new Date(u.LastLogonTimestamp) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
        );
        
        return `Usuarios AD (Chunk ${users.length} usuarios):
Privilegiados: ${privileged.length} - ${str(privileged.slice(0, 15), 1500)}
Inactivos: ${inactive.length} - ${str(inactive.slice(0, 10), 1000)}
Muestra: ${str(users.slice(0, 10), 1000)}`;
      }
      
      // Aggregated stats format
      return `Usuarios AD:
Total: ${d.total||0}
Privilegiados: ${str(d.privileged, 2000)}
Inactivos: ${str(d.inactive, 1000)}
Muestra: ${str(d.sample, 1000)}`;

    case 'gpos':
      return `GPOs - Detecta SOLO configs PELIGROSAS:
Total: ${d.total||0}
GPOs: ${str(d.gpos, 4000)}`;

    case 'domain':
      return `Dominio - Detecta SOLO problemas CRÍTICOS:
${str(d.domains, 2000)}`;

    case 'dc_health':
      return `DCs - Detecta SOLO problemas CRÍTICOS:
${str(d.controllers, 3000)}`;

    case 'forest_domain':
      return `Bosque - SOLO problemas CRÍTICOS:
Modo: ${d.forestMode||'?'}
Nombre: ${d.forestName||'?'}
Dominios: ${(d.domains||[]).join(',')}`;

    case 'security':
      return `Seguridad - SOLO crítico:
Password: ${str(d.passwordPolicy, 1500)}
Trusts: ${str(d.trusts, 1500)}`;

    case 'dns':
      return `DNS - SOLO crítico:
${str(d.zones, 2000)}`;

    case 'dhcp':
      return `DHCP - SOLO crítico:
Servers: ${str(d.servers, 1000)}
Scopes: ${str(d.scopes, 1500)}`;

    default:
      return 'Analiza y reporta problemas de seguridad.';
  }
}
