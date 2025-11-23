import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration limits for data processing - REMOVED AGGRESSIVE LIMITS
// Only limit is chunk size for very large categories
const MAX_USERS_PER_ANALYSIS = 5000; // Process up to 5K users at once (no aggressive sampling)
const MAX_GPOS_PER_ANALYSIS = 500; // Process up to 500 GPOs at once
const MAX_DATA_SIZE_CHARS = 500000; // 500KB per category (reasonable for edge functions)
const MAX_FIELD_LENGTH = 500; // Reasonable field truncation for display

// Helper function to write logs to database
async function writeLog(supabase: any, assessmentId: string, message: string, level: string = 'info', categoryId: string | null = null) {
  try {
    await supabase.from('assessment_logs').insert({
      assessment_id: assessmentId,
      message,
      level,
      category_id: categoryId
    });
    console.log(`[${level.toUpperCase()}] ${message}`);
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const assessmentId = body.assessmentId;
    console.log('Starting categorized analysis for assessment:', assessmentId);

    // Start analysis in background using EdgeRuntime.waitUntil
    const analysisPromise = performAnalysis(assessmentId);
    
    // Use EdgeRuntime.waitUntil to continue execution after response
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(analysisPromise);
    } else {
      // Fallback: just start the promise without awaiting
      analysisPromise.catch(err => console.error('Background analysis error:', err));
    }

    // Return immediately
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analysis started in background',
        assessmentId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error starting analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function performAnalysis(assessmentId: string) {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await writeLog(supabase, assessmentId, 'Iniciando análisis completo del sistema antiguo (archivos normales)', 'info');

    // Define analysis categories with CIS and Microsoft best practices
    const categories = [
      { id: 'users', name: 'Análisis de Usuarios', weight: 0.15 },
      { id: 'gpos', name: 'Análisis de GPOs', weight: 0.15 },
      { id: 'domain', name: 'Configuración de Dominio', weight: 0.15 },
      { id: 'security', name: 'Políticas de Seguridad', weight: 0.15 },
      { id: 'dc_health', name: 'Salud de Controladores de Dominio', weight: 0.10 },
      { id: 'forest_domain', name: 'Bosque y Dominio - Mejores Prácticas', weight: 0.10 },
      { id: 'dns', name: 'Configuración DNS', weight: 0.10 },
      { id: 'dhcp', name: 'Configuración DHCP', weight: 0.10 }
    ];

    // Initialize progress
    await supabase
      .from('assessments')
      .update({ 
        status: 'analyzing',
        analysis_progress: {
          categories: categories.map(c => ({ id: c.id, name: c.name, status: 'pending' })),
          current: null,
          completed: 0,
          total: categories.length
        }
      })
      .eq('id', assessmentId);

    // First, get the assessment record to check for file_path
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('file_path')
      .eq('id', assessmentId)
      .single();

    if (assessmentError) {
      console.error('Error fetching assessment:', assessmentError);
      throw new Error('Failed to fetch assessment record');
    }

    // Fetch assessment data - try from storage first if file_path exists
    let assessmentData;
    
    if (assessment.file_path) {
      await writeLog(supabase, assessmentId, `Cargando datos desde storage: ${assessment.file_path}`, 'info');
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('assessment-files')
          .download(assessment.file_path);

        if (downloadError) {
          throw downloadError;
        }

        const fileText = await fileData.text();
        const parsedData = JSON.parse(fileText);
        // Wrap in array format to match assessment_data structure
        assessmentData = [{ data: parsedData }];
        await writeLog(supabase, assessmentId, `Datos cargados exitosamente (${(fileText.length / 1024).toFixed(2)} KB)`, 'info');
        
        // CRITICAL: Save to assessment_data for report generation (unified system)
        try {
          const { error: saveError } = await supabase
            .from('assessment_data')
            .upsert({
              assessment_id: assessmentId,
              data: parsedData
            });
          
          if (!saveError) {
            await writeLog(supabase, assessmentId, '✓ Datos también guardados en assessment_data para reportes', 'info');
          }
        } catch (saveErr) {
          // Non-critical error, just log it
          await writeLog(supabase, assessmentId, `Nota: ${saveErr}`, 'info');
        }
      } catch (storageError) {
        await writeLog(supabase, assessmentId, `Error cargando desde storage: ${storageError}`, 'error');
        throw new Error('Failed to load file from storage');
      }
    } else {
      // Fallback to database
      await writeLog(supabase, assessmentId, 'Cargando datos desde base de datos', 'info');
      const { data: dbData, error: fetchError } = await supabase
        .from('assessment_data')
        .select('data')
        .eq('assessment_id', assessmentId);

      if (fetchError || !dbData || dbData.length === 0) {
        await writeLog(supabase, assessmentId, `Error obteniendo datos: ${fetchError?.message}`, 'error');
        throw new Error('Failed to fetch assessment data');
      }
      assessmentData = dbData;
      await writeLog(supabase, assessmentId, `Datos cargados: ${dbData.length} entradas`, 'info');
    }

    console.log(`Found ${assessmentData.length} data entries for assessment`);
    
    // Get and log AI provider configuration for this analysis
    const { data: aiConfigData } = await supabase
      .from('ai_config')
      .select('provider')
      .single();
    
    const selectedProvider = aiConfigData?.provider || 'gemini';
    console.log(`╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║  🚀 Starting Analysis with AI Provider: ${selectedProvider.toUpperCase().padEnd(16)} ║`);
    console.log(`║  📊 Assessment ID: ${assessmentId.substring(0, 20)}... ║`);
    console.log(`║  📁 Categories to analyze: ${categories.length.toString().padEnd(27)} ║`);
    console.log(`╚═══════════════════════════════════════════════════════════╝`);
    
    await writeLog(supabase, assessmentId, `Iniciando análisis con proveedor AI: ${selectedProvider}`, 'info');
    await writeLog(supabase, assessmentId, `Se analizarán ${categories.length} categorías`, 'info');

    // Check which categories already have findings (resume from failure)
    const { data: existingFindings } = await supabase
      .from('findings')
      .select('category_id')
      .eq('assessment_id', assessmentId);
    
    const completedCategoryIds = new Set(
      existingFindings?.map(f => f.category_id).filter(Boolean) || []
    );
    
    console.log(`Found ${completedCategoryIds.size} already completed categories:`, Array.from(completedCategoryIds));

    const allFindings: any[] = [];

    // Process each category
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      
      // Skip if this category was already processed
      if (completedCategoryIds.has(category.id)) {
        console.log(`Skipping already completed category: ${category.name}`);
        await writeLog(supabase, assessmentId, `Omitiendo categoría ya completada: ${category.name}`, 'info', category.id);
        continue;
      }
      
      await writeLog(supabase, assessmentId, `Procesando categoría: ${category.name}`, 'info', category.id);

      // Update progress - current category
      await supabase
        .from('assessments')
        .update({ 
          analysis_progress: {
            categories: categories.map((c) => ({
              id: c.id,
              name: c.name,
              status: completedCategoryIds.has(c.id) ? 'completed' : c.id === category.id ? 'processing' : 'pending'
            })),
            current: category.name,
            completed: completedCategoryIds.size,
            total: categories.length
          }
        })
        .eq('id', assessmentId);

      // Prepare category-specific data
      let categoryData;
      try {
        categoryData = prepareCategoryData(assessmentData, category.id);
        
        if (!categoryData || categoryData.length === 0) {
          await writeLog(supabase, assessmentId, `Sin datos para categoría: ${category.name}, omitiendo`, 'warn', category.id);
          continue;
        }
        await writeLog(supabase, assessmentId, `Datos preparados para ${category.name}: ${categoryData.length} elementos`, 'info', category.id);
      } catch (error) {
        const errorMsg = `Error preparing data for ${category.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        await writeLog(supabase, assessmentId, errorMsg, 'error', category.id);
        
        // Update progress with error
        await supabase
          .from('assessments')
          .update({ 
            analysis_progress: {
              categories: categories.map((c) => ({
                id: c.id,
                name: c.name,
                status: completedCategoryIds.has(c.id) ? 'completed' : c.id === category.id ? 'processing' : 'pending'
              })),
              current: category.name,
              completed: completedCategoryIds.size,
              total: categories.length,
              lastError: errorMsg
            }
          })
          .eq('id', assessmentId);
        
        continue; // Skip this category and continue with next
      }

      let prompt;
      try {
        prompt = buildCategoryPrompt(category, categoryData);
      } catch (error) {
        const errorMsg = `Error building prompt for ${category.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        
        await supabase
          .from('assessments')
          .update({ 
            analysis_progress: {
              categories: categories.map((c) => ({
                id: c.id,
                name: c.name,
                status: completedCategoryIds.has(c.id) ? 'completed' : c.id === category.id ? 'processing' : 'pending'
              })),
              current: category.name,
              completed: completedCategoryIds.size,
              total: categories.length,
              lastError: errorMsg
            }
          })
          .eq('id', assessmentId);
        
        continue;
      }

      console.log(`Sending ${category.name} to AI (${JSON.stringify(categoryData).length} chars)`);
      
      // Get AI provider configuration
      const { data: configData } = await supabase
        .from('ai_config')
        .select('provider')
        .single();
      
      const provider = configData?.provider || 'gemini';
      const modelName = provider === 'lovable' ? 'google/gemini-2.5-flash via Lovable AI' : 'gemini-2.5-flash via Google API';
      console.log(`🤖 AI Provider: ${provider.toUpperCase()} | Model: ${modelName} | Category: ${category.name}`);
      
      const GOOGLE_GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (provider === 'gemini' && !GOOGLE_GEMINI_API_KEY) {
        throw new Error('GOOGLE_GEMINI_API_KEY not configured');
      }
      if (provider === 'lovable' && !LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      // Retry logic with detailed logging
      let aiResponse;
      let lastError = '';
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 5000; // 5 seconds
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Update progress with retry info
          await supabase
            .from('assessments')
            .update({ 
              analysis_progress: {
                categories: categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  status: completedCategoryIds.has(c.id) ? 'completed' : c.id === category.id ? 'processing' : 'pending'
                })),
                current: `${category.name}${attempt > 1 ? ` (Intento ${attempt}/${MAX_RETRIES})` : ''}`,
                completed: completedCategoryIds.size,
                total: categories.length,
                lastError: attempt > 1 ? `Reintentando después de error: ${lastError}` : null
              }
            })
            .eq('id', assessmentId);

          console.log(`📡 Attempt ${attempt}/${MAX_RETRIES} for ${category.name} using ${provider.toUpperCase()}`);
          
          if (provider === 'gemini') {
            console.log(`🔑 Using Google Gemini API (Direct)`);
            aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: prompt
                      }
                    ]
                  }
                ],
                generationConfig: {
                  temperature: 0.7,
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 8192,
                  responseMimeType: "application/json"
                }
              }),
            });
          } else {
            // Use Lovable AI
            console.log(`🔑 Using Lovable AI Gateway (model: google/gemini-2.5-flash)`);
            aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  {
                    role: 'user',
                    content: prompt
                  }
                ],
                response_format: { type: 'json_object' }
              }),
            });
          }

          if (aiResponse.ok) {
            console.log(`✅ Success for ${category.name} on attempt ${attempt} | Provider: ${provider.toUpperCase()} | Status: ${aiResponse.status}`);
            break; // Success, exit retry loop
          }

          const errorText = await aiResponse.text();
          lastError = `API ${aiResponse.status}: ${errorText.substring(0, 100)}`;
          console.error(`Attempt ${attempt} failed for ${category.name}:`, aiResponse.status, errorText);
          
          // Don't retry on auth errors
          if (aiResponse.status === 403) {
            throw new Error('Invalid API key or insufficient permissions.');
          }
          
          // If not last attempt and it's a retryable error, wait before retry
          if (attempt < MAX_RETRIES && (aiResponse.status === 503 || aiResponse.status === 429)) {
            const delay = RETRY_DELAY * attempt; // Exponential backoff
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else if (attempt === MAX_RETRIES) {
            // Last attempt failed
            throw new Error(`AI analysis failed after ${MAX_RETRIES} attempts: ${lastError}`);
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Exception on attempt ${attempt}:`, lastError);
          
          if (attempt === MAX_RETRIES) {
            // Update progress with final error before throwing
            await supabase
              .from('assessments')
              .update({ 
                analysis_progress: {
                  categories: categories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    status: completedCategoryIds.has(c.id) ? 'completed' : c.id === category.id ? 'processing' : 'pending'
                  })),
                  current: category.name,
                  completed: completedCategoryIds.size,
                  total: categories.length,
                  lastError: `Error en ${category.name}: ${lastError}`
                }
              })
              .eq('id', assessmentId);
            
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        }
      }

      if (!aiResponse || !aiResponse.ok) {
        throw new Error(`Failed to get valid response after ${MAX_RETRIES} attempts`);
      }

      const aiData = await aiResponse.json();
      console.log('AI API response structure:', JSON.stringify(aiData, null, 2).substring(0, 500));
      
      let content = '';
      if (provider === 'gemini') {
        content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // Lovable AI response format
        content = aiData.choices?.[0]?.message?.content || '';
      }
      
      if (!content) {
        console.error('No content in AI response:', JSON.stringify(aiData));
        throw new Error(`No content received from AI for ${category.name}`);
      }
      
      // Clean markdown code blocks if present
      content = content.trim();
      if (content.startsWith('```json')) {
        content = content.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
      } else if (content.startsWith('```')) {
        content = content.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
      }
      
      // Validate JSON completeness
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      const openBrackets = (content.match(/\[/g) || []).length;
      const closeBrackets = (content.match(/]/g) || []).length;
      
      if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
        console.error(`Incomplete JSON for ${category.name}:`, {
          openBraces,
          closeBraces,
          openBrackets,
          closeBrackets,
          contentLength: content.length,
          contentPreview: content.substring(0, 200) + '...' + content.substring(content.length - 200)
        });
        throw new Error(`Incomplete JSON response from Gemini for ${category.name}. Braces: ${openBraces}/${closeBraces}, Brackets: ${openBrackets}/${closeBrackets}`);
      }
      
      // Parse the JSON response
      let analysisResult;
      try {
        analysisResult = JSON.parse(content);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        console.error(`JSON parse error for ${category.name}:`, {
          error: errorMessage,
          contentLength: content.length,
          contentStart: content.substring(0, 500),
          contentEnd: content.substring(Math.max(0, content.length - 500))
        });
        throw new Error(`Failed to parse JSON response for ${category.name}: ${errorMessage}`);
      }
      const findings = analysisResult.findings || [];
      
      console.log(`Found ${findings.length} findings for ${category.name}`);
      
      // Save findings immediately after each category succeeds
      if (findings.length > 0) {
        const findingsToInsert = findings.map((finding: any) => ({
          assessment_id: assessmentId,
          category_id: category.id,  // Mark which category generated this finding
          title: finding.title,
          severity: finding.severity,
          description: finding.description,
          recommendation: finding.recommendation,
          evidence: finding.evidence || {}
        }));

        const { error: insertError } = await supabase
          .from('findings')
          .insert(findingsToInsert);

        if (insertError) {
          console.error(`Error inserting findings for ${category.name}:`, insertError);
          throw new Error(`Failed to insert findings for ${category.name}`);
        }
        
        console.log(`✓ Saved ${findings.length} findings for ${category.name}`);
      }
      
      allFindings.push(...findings);
      
      // Mark this category as completed
      completedCategoryIds.add(category.id);
    }

    // Update progress - all completed
    await supabase
      .from('assessments')
      .update({ 
        analysis_progress: {
          categories: categories.map(c => ({
            id: c.id,
            name: c.name,
            status: completedCategoryIds.has(c.id) ? 'completed' : 'pending'
          })),
          current: 'Análisis completado',
          completed: completedCategoryIds.size,
          total: categories.length
        }
      })
      .eq('id', assessmentId);

    console.log(`Total findings: ${allFindings.length}`);

    // Update assessment status to completed (findings already saved incrementally)
    await supabase
      .from('assessments')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', assessmentId);

    console.log(`╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║  ✅ Analysis Completed Successfully!                      ║`);
    console.log(`║  🤖 AI Provider Used: ${selectedProvider.toUpperCase().padEnd(32)} ║`);
    console.log(`║  📊 Total Findings: ${allFindings.length.toString().padEnd(36)} ║`);
    console.log(`║  ✓ All ${categories.length} categories processed                       ║`);
    console.log(`╚═══════════════════════════════════════════════════════════╝`);
  } catch (error) {
    console.error('Error in analyze-assessment background task:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update status to failed
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase
        .from('assessments')
        .update({ 
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', assessmentId);
    } catch (updateError) {
      console.error('Failed to update status to failed:', updateError);
    }
    
    throw error; // Re-throw to log in background task
  }
}

// Utility: truncate long strings
function truncateString(str: string | undefined, maxLength: number = MAX_FIELD_LENGTH): string {
  if (!str) return '';
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

// Utility: simplify user object to essential fields only
function simplifyUser(user: any) {
  return {
    Name: truncateString(user.Name || user.SamAccountName),
    Enabled: user.Enabled,
    PasswordNeverExpires: user.PasswordNeverExpires,
    PasswordNotRequired: user.PasswordNotRequired,
    PasswordLastSet: user.PasswordLastSet,
    LastLogonDate: user.LastLogonDate,
    AdminCount: user.AdminCount,
    HasSPN: (user.ServicePrincipalNames?.length || 0) > 0,
    DoesNotRequirePreAuth: user.DoesNotRequirePreAuth,
    MemberOfCount: user.MemberOf?.length || 0,
    IsPrivileged: user.MemberOf?.some((g: string) => 
      ['Domain Admins', 'Enterprise Admins', 'Schema Admins', 'Administrators'].some(pg => g.includes(pg))
    ) || false
  };
}

// Strategic sampling: prioritize critical users - REASONABLE LIMITS FOR SMALL FILES
function sampleUsers(users: any[]): any[] {
  if (!users || users.length === 0) return [];
  
  const priorityUsers: any[] = [];
  const normalUsers: any[] = [];
  
  const privilegedGroups = [
    'Domain Admins', 'Enterprise Admins', 'Schema Admins',
    'Administrators', 'Account Operators', 'Backup Operators',
    'Server Operators', 'Print Operators'
  ];
  
  users.forEach(user => {
    const isPrivileged = user.MemberOf?.some((group: string) => 
      privilegedGroups.some(pg => group.includes(pg))
    );
    const isServiceAccount = user.ServicePrincipalNames?.length > 0;
    const hasOldPassword = user.PasswordLastSet && 
      (Date.now() - new Date(user.PasswordLastSet).getTime()) > 365 * 24 * 60 * 60 * 1000;
    const isKerberoastable = user.ServicePrincipalNames?.length > 0;
    const isASREPRoastable = !user.DoesNotRequirePreAuth;
    
    if (isPrivileged || isServiceAccount || hasOldPassword || isKerberoastable || !isASREPRoastable) {
      priorityUsers.push(simplifyUser(user));
    } else if (normalUsers.length < 500) { // More normal users
      normalUsers.push(simplifyUser(user));
    }
  });
  
  // Take up to 5000 users total (much more reasonable)
  const maxPriority = Math.min(priorityUsers.length, 4500);
  const maxNormal = Math.min(normalUsers.length, 500);
  
  return [...priorityUsers.slice(0, maxPriority), ...normalUsers.slice(0, maxNormal)];
}

// Aggregate user statistics for efficient analysis
function aggregateUserStats(users: any[]) {
  if (!users || users.length === 0) return null;
  
  const stats = {
    total: users.length,
    enabled: users.filter(u => u.Enabled).length,
    disabled: users.filter(u => !u.Enabled).length,
    passwordNeverExpires: users.filter(u => u.PasswordNeverExpires).length,
    passwordNotRequired: users.filter(u => u.PasswordNotRequired).length,
    withSPN: users.filter(u => u.ServicePrincipalNames?.length > 0).length,
    asrepRoastable: users.filter(u => u.DoesNotRequirePreAuth).length,
    oldPasswords: users.filter(u => {
      if (!u.PasswordLastSet) return false;
      const daysSinceChange = (Date.now() - new Date(u.PasswordLastSet).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceChange > 365;
    }).length,
    neverLoggedIn: users.filter(u => !u.LastLogonDate).length,
    inactive90Days: users.filter(u => {
      if (!u.LastLogonDate) return true;
      const daysSinceLogin = (Date.now() - new Date(u.LastLogonDate).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLogin > 90;
    }).length,
  };
  
  return stats;
}

// Utility: simplify GPO object
function simplifyGPO(gpo: any) {
  return {
    DisplayName: truncateString(gpo.DisplayName),
    Name: truncateString(gpo.DisplayName),
    GpoStatus: gpo.GpoStatus || 'AllSettingsEnabled',
    CreationTime: gpo.CreationTime,
    ModificationTime: gpo.ModificationTime,
    Links: gpo.Links || [],
    LinksCount: gpo.Links?.length || 0,
    HasNote: !!gpo.Note,
    Path: truncateString(gpo.Path, 100)
  };
}

// Sample GPOs strategically - REASONABLE LIMITS FOR SMALL FILES
function sampleGPOs(gpos: any[]): any[] {
  if (!gpos || gpos.length === 0) return [];
  
  const priorityGPOs: any[] = [];
  const normalGPOs: any[] = [];
  
  const defaultGPONames = ['Default Domain Policy', 'Default Domain Controllers Policy'];
  
  gpos.forEach(gpo => {
    const isDefault = defaultGPONames.some(name => gpo.DisplayName?.includes(name));
    const hasMultipleLinks = gpo.Links && gpo.Links.length > 1;
    const hasWidePermissions = gpo.Permissions?.some((p: any) => 
      p.Trustee?.includes('Authenticated Users') || p.Trustee?.includes('Everyone')
    );
    
    if (isDefault) {
      priorityGPOs.push(simplifyGPO(gpo));
    } else if (hasMultipleLinks || hasWidePermissions) {
      priorityGPOs.push(simplifyGPO(gpo));
    } else if (normalGPOs.length < 200) { // More normal GPOs
      normalGPOs.push(simplifyGPO(gpo));
    }
  });
  
  // Take up to 500 GPOs total (much more reasonable)
  return [...priorityGPOs.slice(0, 300), ...normalGPOs.slice(0, 200)];
}

function prepareCategoryData(assessmentData: any[], categoryId: string) {
  let processed = assessmentData.map(entry => {
    const data = entry.data;
    
    switch (categoryId) {
      case 'users': {
        const allUsers = data.Users || [];
        const sampledUsers = sampleUsers(allUsers);
        const userStats = aggregateUserStats(allUsers);
        
        console.log(`Users: sampled ${sampledUsers.length} from ${allUsers.length} total`);
        
        return {
          DomainName: data.DomainName,
          Statistics: userStats,
          SampledUsers: sampledUsers,
          ProtectedUsers: data.ProtectedUsers,
          OldPasswords: data.OldPasswords,
          Note: sampledUsers.length < allUsers.length 
            ? `Dataset optimizado: mostrando ${sampledUsers.length} usuarios críticos de ${allUsers.length} totales. Estadísticas agregadas incluidas.`
            : null
        };
      }
      
      case 'gpos': {
        const allGPOs = data.GPOs || [];
        const sampledGPOs = sampleGPOs(allGPOs);
        
        console.log(`GPOs: sampled ${sampledGPOs.length} from ${allGPOs.length} total`);
        
        return {
          DomainName: data.DomainName,
          TotalGPOs: allGPOs.length,
          SampledGPOs: sampledGPOs,
          GPOPermissions: data.GPOPermissions,
          DCPolicy: data.DCPolicy,
          Note: sampledGPOs.length < allGPOs.length
            ? `Dataset optimizado: mostrando ${sampledGPOs.length} GPOs críticas de ${allGPOs.length} totales.`
            : null
        };
      }
      
      case 'domain':
        return {
          DomainName: data.DomainName,
          DomainInfo: data.DomainInfo,
          DomainControllers: data.DomainControllers,
          PasswordPolicies: data.PasswordPolicies,
          SiteTopology: data.SiteTopology,
        };
      
      case 'security':
        return {
          DomainName: data.DomainName,
          KerberosConfig: data.KerberosConfig,
          LAPS: data.LAPS,
          DCSyncPermissions: data.DCSyncPermissions,
          RC4EncryptionTypes: data.RC4EncryptionTypes,
          RecycleBinStatus: data.RecycleBinStatus,
          UnconstrainedDelegation: data.UnconstrainedDelegation,
          NTLMSettings: data.NTLMSettings,
          SMBv1Status: data.SMBv1Status,
        };

      case 'dc_health':
        return {
          DomainName: data.DomainName,
          DomainControllers: data.DomainControllers,
          DCHealth: data.DCHealth,
          ReplicationStatus: data.ReplicationStatus,
          BackupStatus: data.BackupStatus,
        };

      case 'forest_domain':
        return {
          DomainName: data.DomainName,
          DomainInfo: data.DomainInfo,
          Trusts: data.Trusts,
          OUStructure: data.OUStructure,
          AdminSDHolder: data.AdminSDHolder,
          RecycleBinStatus: data.RecycleBinStatus,
          TombstoneLifetime: data.TombstoneLifetime,
        };

      case 'dns':
        return {
          DomainName: data.DomainName,
          DNSConfiguration: data.DNSConfiguration,
          DNSScavenging: data.DNSScavenging,
        };

      case 'dhcp':
        return {
          DomainName: data.DomainName,
          DHCPConfiguration: data.DHCPConfiguration,
        };
      
      default:
        return {};
    }
  }).filter(item => Object.keys(item).length > 1);
  
  // AGGRESSIVE size check: progressive truncation
  let dataStr = JSON.stringify(processed);
  let attempts = 0;
  
  while (dataStr.length > MAX_DATA_SIZE_CHARS && attempts < 3) {
    attempts++;
    console.log(`Category ${categoryId} too large (${dataStr.length} chars), attempt ${attempts} to reduce`);
    
    if (attempts === 1) {
      // First attempt: remove half of items
      processed = processed.slice(0, Math.ceil(processed.length / 2));
    } else if (attempts === 2) {
      // Second attempt: keep only first item
      processed = [processed[0]];
    } else {
      // Last resort: heavily simplify first item
      const firstItem: any = processed[0];
      for (const key in firstItem) {
        if (Array.isArray(firstItem[key]) && firstItem[key].length > 5) {
          firstItem[key] = firstItem[key].slice(0, 5);
        }
      }
      processed = [firstItem];
    }
    
    dataStr = JSON.stringify(processed);
  }
  
  console.log(`Final data size for ${categoryId}: ${dataStr.length} chars`);
  return processed;
}

function sanitizeDataForPrompt(data: any): string {
  try {
    // Convert to JSON and sanitize problematic characters
    let jsonStr = JSON.stringify(data, null, 2);
    
    // Escape any unmatched brackets or special regex characters that could cause issues
    // but preserve valid JSON structure
    return jsonStr;
  } catch (error) {
    console.error('Error sanitizing data:', error);
    return JSON.stringify({ error: 'Data sanitization failed' });
  }
}

function buildCategoryPrompt(category: any, data: any) {
  const sanitizedData = sanitizeDataForPrompt(data);
  
  const basePrompt = `Eres un experto en seguridad de Active Directory con conocimiento profundo de las mejores prácticas de CIS Benchmarks y Microsoft.

IMPORTANTE: Analiza ${category.name} y proporciona hallazgos de seguridad detallados.

Datos a analizar:
${sanitizedData}

Para cada hallazgo debes:
1. Describir el control o práctica recomendada según CIS/Microsoft
2. Identificar el riesgo específico (Critical/High/Medium/Low)
3. Proporcionar comandos de verificación PowerShell o GUI cuando sea posible
4. Dar recomendaciones de remediación específicas y accionables

Devuelve SOLO un objeto JSON con esta estructura:
{
  "findings": [
    {
      "title": "Título claro del hallazgo",
      "severity": "critical|high|medium|low",
      "description": "Descripción del problema incluyendo el estándar CIS/Microsoft relevante, el estado actual encontrado, y por qué es un riesgo (máximo 300 palabras)",
      "recommendation": "Pasos específicos de remediación incluyendo comandos PowerShell, configuración GUI, o políticas a implementar (máximo 300 palabras)",
      "evidence": {
        "standard": "CIS Benchmark X.X.X o Microsoft Best Practice",
        "current_state": "Estado actual encontrado",
        "verification_command": "Comando PowerShell para verificar",
        "affected_items": "Lista de items afectados si aplica"
      }
    }
  ]
}`;

  switch (category.id) {
    case 'users':
      return `${basePrompt}

Enfócate en prácticas recomendadas de gestión de usuarios:
- Cuentas con contraseñas que nunca expiran (CIS: debe ser 0)
- Cuentas sin requisitos de pre-autenticación (AS-REP Roastable)
- Cuentas con SPN configurados (Kerberoastable) - revisar cifrado RC4
- Cuentas inactivas (>90 días sin uso) - riesgo de compromiso
- Contraseñas antiguas (>365 días) - forzar rotación
- Grupo "Protected Users" - verificar membresía de cuentas privilegiadas
- Separación de cuentas administrativas vs uso diario`;

    case 'gpos':
      return `${basePrompt}

Enfócate en configuración segura de GPOs según CIS:
- GPOs sin vincular a OUs (configuración inútil)
- Permisos excesivos en GPOs (Authenticated Users con GpoEdit)
- Default Domain Policy - verificar configuraciones de seguridad
- Default Domain Controllers Policy - auditoría y derechos de usuario
- Políticas de contraseña en GPO (complejidad, longitud, historial)
- Configuraciones de firewall y restricción de software
- Políticas de auditoría (logon events, account management, privilege use)`;

    case 'domain':
      return `${basePrompt}

Evalúa configuración del dominio según mejores prácticas:
- Nivel funcional de dominio/bosque (debe ser Windows Server 2016+)
- Configuración de controladores de dominio (OS version, roles)
- Política de contraseñas (CIS: min 14 caracteres, complejidad, historial 24)
- Política de bloqueo de cuenta (CIS: 5 intentos, 15 min duración)
- Topología de sitios y subredes (optimización replicación)
- Diseño de nombres DNS y sufijos UPN`;

    case 'security':
      return `${basePrompt}

Analiza controles de seguridad críticos:
- KRBTGT password age (CIS: rotar cada 180 días, crítico si >180)
- LAPS implementado (CIS requirement - gestión contraseñas locales)
- DCSync permissions (solo DCs deben tener DS-Replication-Get-Changes)
- RC4 encryption (deprecated - migrar a AES256)
- Delegación sin restricciones (critical risk - puede impersonar)
- NTLM authentication (CIS: desactivar SMBv1, usar NTLMv2 mínimo nivel 5)
- Recycle Bin habilitado (recuperación de objetos eliminados)
- AdminSDHolder protection (protección objetos privilegiados)`;

    case 'dc_health':
      return `${basePrompt}

Evalúa salud operacional de DCs según Microsoft best practices:
- Replicación AD (CIS: sin fallos, <60 min última replicación exitosa)
- Roles FSMO (ubicación óptima, no en RODC, disponibilidad)
- Event logs críticos últimos 7 días (errores sistema/aplicación)
- Parches y hotfixes (aplicación regular, vulnerabilidades conocidas)
- BitLocker en volumen sistema (CIS: encryption requerido para DCs)
- Time synchronization (w32time - PDC sincroniza con NTP externo confiable)
- Antivirus/Defender (habilitado, firmas actualizadas, protección real-time)
- Espacio en disco y recursos (monitoreo capacity planning)`;

    case 'forest_domain':
      return `${basePrompt}

Revisa diseño y configuración de bosque/dominio:
- Nivel funcional (Microsoft: Windows Server 2016+ recomendado)
- Trust relationships (tipo, dirección, SID filtering, selective auth)
- Diseño de OUs (estructura lógica, delegación administrativa, GPO inheritance)
- AdminSDHolder (SDProp process, orphaned adminCount objects)
- Delegación de permisos (principio de menor privilegio, auditoría)
- AD Recycle Bin (CIS: debe estar habilitado - recuperación sin backup)
- Tombstone lifetime (Microsoft: 180 días mínimo recomendado)
- Schema extensions (documentación, cambios controlados)`;

    case 'dns':
      return `${basePrompt}

Analiza seguridad y configuración DNS según CIS:
- Zonas integradas AD vs primarias (CIS: preferir AD-integrated para seguridad)
- Zone transfers (CIS: solo a servidores específicos, NUNCA "any server")
- Scavenging habilitado (prevenir registros obsoletos - 7 días no-refresh, 7 días refresh)
- Dynamic updates (CIS: "Secure Only" para zonas AD-integrated)
- Forwarders configurados (usar DNS recursivo confiable, ej: 1.1.1.1, 8.8.8.8)
- Zonas críticas (_msdcs, _sites, _tcp, _udp) - integridad y permisos
- DNS cache poisoning protections (source port randomization)
- ACLs en zonas DNS (solo administradores autorizados)`;

    case 'dhcp':
      return `${basePrompt}

Evalúa configuración DHCP según best practices:
- Servidores DHCP autorizados en AD (CIS: prevenir rogue DHCP servers)
- Configuración de scopes (utilización, rangos IP, máscara subred)
- Lease duration (Microsoft: 8 días default, ajustar según movilidad usuarios)
- DHCP failover configurado (alta disponibilidad, load balance 50/50 o hot standby)
- Reservas DHCP (servidores, impresoras, dispositivos críticos)
- Opciones DHCP (DNS servers, default gateway, dominio DNS)
- Backups DHCP (automatizados, restore testing)
- Auditoría de cambios (logging, quién modificó scopes/reservas)
- Conflict detection (prevenir direcciones IP duplicadas)`;

    default:
      return basePrompt;
  }
}