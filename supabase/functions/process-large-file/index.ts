import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declare EdgeRuntime global
declare const EdgeRuntime: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_USERS_PER_CHUNK = 10000; // Increased to reduce number of chunks for very large datasets
const BATCH_SIZE = 10; // Reduced batch size to avoid rate limits

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

// Define all analysis categories
const ALL_CATEGORIES = [
  { id: 'users', name: 'Análisis de Usuarios', dataKey: 'Users' },
  { id: 'gpos', name: 'Análisis de GPOs', dataKey: 'GPOs' },
  { id: 'domain', name: 'Configuración de Dominio', dataKey: 'DomainInfo' },
  { id: 'security', name: 'Políticas de Seguridad', dataKey: 'KerberosConfig' },
  { id: 'dc_health', name: 'Salud de Controladores de Dominio', dataKey: 'DomainControllers' },
  { id: 'forest_domain', name: 'Bosque y Dominio', dataKey: 'ForestInfo' },
  { id: 'dns', name: 'Configuración DNS', dataKey: 'DNSZones' },
  { id: 'dhcp', name: 'Configuración DHCP', dataKey: 'DHCPServers' }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assessmentId, filePath } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Start background processing with EdgeRuntime.waitUntil
    EdgeRuntime.waitUntil(processLargeFile(supabase, assessmentId, filePath));

    // Return immediate response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analysis started in background',
        assessmentId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// Memory-efficient category extraction
async function extractCategoryFromStream(
  url: string,
  categoryKey: string,
  supabase: any,
  assessmentId: string
): Promise<any> {
  await writeLog(supabase, assessmentId, `Extrayendo categoría: ${categoryKey}...`, 'info', categoryKey);
  
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let categoryData: any = null;
  let foundKey = false;
  let braceCount = 0;
  let categoryStart = -1;
  let bytesProcessed = 0;
  let lastProgressUpdate = Date.now();
  const totalSize = parseInt(response.headers.get('content-length') || '0');
  
  // Pattern to find: "CategoryKey": {...} or "CategoryKey": [...]
  const keyPattern = `"${categoryKey}"`;
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (value) {
        bytesProcessed += value.length;
        buffer += decoder.decode(value, { stream: !done });
        
        // Update progress every 2 seconds
        const now = Date.now();
        if (now - lastProgressUpdate > 2000) {
          const progress = totalSize > 0 ? Math.round((bytesProcessed / totalSize) * 100) : 0;
          await writeLog(
            supabase, 
            assessmentId, 
            `Procesando ${categoryKey}: ${progress}% leído (${Math.round(bytesProcessed / 1024 / 1024)}MB)`, 
            'info',
            categoryKey
          );
          lastProgressUpdate = now;
        }
        
        // Look for the category key
        if (!foundKey) {
          const keyIndex = buffer.indexOf(keyPattern);
          if (keyIndex !== -1) {
            foundKey = true;
            // Find the start of the value (after the colon)
            let valueStart = buffer.indexOf(':', keyIndex);
            if (valueStart !== -1) {
              valueStart++;
              // Skip whitespace
              while (valueStart < buffer.length && /\s/.test(buffer[valueStart])) {
                valueStart++;
              }
              categoryStart = valueStart;
            }
          } else if (buffer.length > 100000) {
            // Keep only last part to find key across chunks
            buffer = buffer.slice(-1000);
          }
        }
        
        // Extract category value
        if (foundKey && categoryStart !== -1) {
          let extractBuffer = buffer.slice(categoryStart);
          const firstChar = extractBuffer[0];
          let endChar = '';
          
          if (firstChar === '{') {
            braceCount = 1;
            endChar = '}';
          } else if (firstChar === '[') {
            braceCount = 1;
            endChar = ']';
          }
          
          // Find matching closing brace/bracket
          for (let i = 1; i < extractBuffer.length; i++) {
            if (extractBuffer[i] === firstChar) {
              braceCount++;
            } else if (extractBuffer[i] === endChar) {
              braceCount--;
              if (braceCount === 0) {
                // Found complete category
                const categoryJson = extractBuffer.slice(0, i + 1);
                try {
                  categoryData = JSON.parse(categoryJson);
                  await writeLog(supabase, assessmentId, `✓ Categoría ${categoryKey} extraída`, 'info');
                  return categoryData;
                } catch (e) {
                  const error = e instanceof Error ? e : new Error(String(e));
                  await writeLog(supabase, assessmentId, `Error parseando ${categoryKey}: ${error.message}`, 'error');
                  throw error;
                }
              }
            }
          }
        }
      }
      
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  
  if (!foundKey) {
    await writeLog(supabase, assessmentId, `Categoría ${categoryKey} no encontrada`, 'warn', categoryKey);
  } else {
    await writeLog(supabase, assessmentId, `✓ Categoría ${categoryKey} extraída exitosamente`, 'info', categoryKey);
  }
  
  return categoryData;
}

// Stream and extract all categories one by one
async function streamParseJSON(
  url: string,
  supabase: any,
  assessmentId: string
): Promise<Record<string, any>> {
  await writeLog(supabase, assessmentId, 'Extrayendo categorías de forma individual...', 'info');
  
  const result: Record<string, any> = {};
  
  // Extract each category separately to minimize memory usage
  for (const category of ALL_CATEGORIES) {
    const data = await extractCategoryFromStream(url, category.dataKey, supabase, assessmentId);
    if (data !== null) {
      result[category.dataKey] = data;
    }
  }
  
  await writeLog(supabase, assessmentId, '✓ Todas las categorías extraídas', 'info');
  return result;
}

async function processLargeFile(supabase: any, assessmentId: string, filePath: string) {
  try {
    await writeLog(supabase, assessmentId, 'Iniciando análisis con parser JSON nativo (mucho más rápido)', 'info');

    // Get signed URL for download
    await writeLog(supabase, assessmentId, `Obteniendo URL del archivo: ${filePath}`, 'info');
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('assessment-files')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (urlError || !signedUrlData) {
      await writeLog(supabase, assessmentId, `Error al obtener URL firmada: ${urlError?.message}`, 'error');
      throw new Error('Failed to get signed URL');
    }

    // Download and parse JSON using native fast parser
    let fullData;
    try {
      fullData = await streamParseJSON(signedUrlData.signedUrl, supabase, assessmentId);
      await writeLog(supabase, assessmentId, '✓ Archivo procesado exitosamente', 'info');
    } catch (parseError) {
      await writeLog(supabase, assessmentId, `Error al parsear JSON: ${parseError}`, 'error');
      throw new Error('Invalid JSON format');
    }

    // CRITICAL: Save raw data for report generation (unified system)
    await writeLog(supabase, assessmentId, '💾 Guardando datos raw para reportes...', 'info');
    try {
      const { error: dataError } = await supabase
        .from('assessment_data')
        .upsert({
          assessment_id: assessmentId,
          data: fullData
        });

      if (dataError) {
        await writeLog(supabase, assessmentId, `⚠️ Error guardando datos raw: ${dataError.message}`, 'warn');
      } else {
        await writeLog(supabase, assessmentId, '✓ Datos raw guardados exitosamente', 'info');
      }
    } catch (saveError) {
      await writeLog(supabase, assessmentId, `⚠️ Error guardando datos raw: ${saveError}`, 'warn');
    }

    // Detect which categories have data
    const availableCategories = ALL_CATEGORIES.filter(cat => {
      const hasData = fullData[cat.dataKey] && 
        (Array.isArray(fullData[cat.dataKey]) ? fullData[cat.dataKey].length > 0 : true);
      return hasData;
    });

    if (availableCategories.length === 0) {
      await writeLog(supabase, assessmentId, 'No se encontraron categorías válidas en el archivo JSON', 'error');
      throw new Error('No valid data categories found in uploaded file');
    }

    await writeLog(supabase, assessmentId, `Se procesarán ${availableCategories.length} categorías: ${availableCategories.map(c => c.name).join(', ')}`, 'info');

    // Initialize progress tracking
    let totalTasks = 0;
    const categoryTasks: { category: any; chunks?: string[] }[] = [];

    // Process Users category (may need chunking)
    const usersCategory = availableCategories.find(c => c.id === 'users');
    if (usersCategory) {
      const users = fullData.Users || [];
      
      if (users.length > MAX_USERS_PER_CHUNK) {
        const totalChunks = Math.ceil(users.length / MAX_USERS_PER_CHUNK);
        await writeLog(supabase, assessmentId, `Usuarios serán procesados en ${totalChunks} chunks de ${MAX_USERS_PER_CHUNK} usuarios`, 'info');
        
        const chunkFiles: string[] = [];
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * MAX_USERS_PER_CHUNK;
          const end = Math.min(start + MAX_USERS_PER_CHUNK, users.length);
          const chunk = users.slice(start, end);
          
          const chunkFileName = `${assessmentId}/chunk-users-${i}.json`;
          const chunkData = { Users: chunk };
          
          const { error: uploadError } = await supabase.storage
            .from('assessment-files')
            .upload(chunkFileName, JSON.stringify(chunkData), {
              contentType: 'application/json',
              upsert: true
            });

          if (uploadError) {
            await writeLog(supabase, assessmentId, `Error al subir chunk ${i}: ${uploadError.message}`, 'error');
            continue;
          }

          chunkFiles.push(chunkFileName);
        }

        categoryTasks.push({ category: usersCategory, chunks: chunkFiles });
        totalTasks += totalChunks;
      } else {
        // Upload single users file
        const usersData = { Users: users };
        const usersFileName = `${assessmentId}/category-users.json`;
        
        const { error: uploadError } = await supabase.storage
          .from('assessment-files')
          .upload(usersFileName, JSON.stringify(usersData), {
            contentType: 'application/json',
            upsert: true
          });

        if (uploadError) {
          await writeLog(supabase, assessmentId, `Error al subir archivo de usuarios: ${uploadError.message}`, 'error');
          throw new Error('Failed to upload users data');
        }

        categoryTasks.push({ category: usersCategory });
        totalTasks += 1;
      }
    }

    // Process other categories (non-chunked)
    const otherCategories = availableCategories.filter(c => c.id !== 'users');
    for (const category of otherCategories) {
      const categoryFileName = `${assessmentId}/category-${category.id}.json`;
      const categoryData = { [category.dataKey]: fullData[category.dataKey] };
      
      const { error: uploadError } = await supabase.storage
        .from('assessment-files')
        .upload(categoryFileName, JSON.stringify(categoryData), {
          contentType: 'application/json',
          upsert: true
        });

      if (uploadError) {
        await writeLog(supabase, assessmentId, `Error al subir archivo de categoría ${category.name}: ${uploadError.message}`, 'error');
        continue;
      }

      categoryTasks.push({ category });
      totalTasks += 1;
    }

    // Initialize assessment progress
    const { error: updateError } = await supabase
      .from('assessments')
      .update({
        status: 'analyzing',
        analysis_progress: {
          total: totalTasks,
          completed: 0,
          current: null,
          categories: availableCategories.map(c => ({ 
            id: c.id, 
            name: c.name, 
            status: 'pending' 
          }))
        }
      })
      .eq('id', assessmentId);

    if (updateError) {
      await writeLog(supabase, assessmentId, `Error al actualizar progreso inicial: ${updateError.message}`, 'error');
    }

    // Process all categories
    await processAllCategories(supabase, assessmentId, categoryTasks, totalTasks, fullData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await writeLog(supabase, assessmentId, `Error crítico en procesamiento: ${errorMessage}`, 'error');
    await supabase
      .from('assessments')
      .update({ status: 'failed' })
      .eq('id', assessmentId);
  }
}

// Function to process all categories in batches
async function processAllCategories(supabase: any, assessmentId: string, categoryTasks: any[], totalTasks: number, fullData: any) {
  let completedTasks = 0;

  for (let i = 0; i < categoryTasks.length; i += BATCH_SIZE) {
    const batch = categoryTasks.slice(i, i + BATCH_SIZE);
    const batchPromises: Promise<void>[] = [];

    for (const task of batch) {
      if (task.chunks) {
        // Process chunked category (users)
        for (const chunkFile of task.chunks) {
          const chunkIndex = task.chunks.indexOf(chunkFile);
          const promise = (async () => {
            try {
              await writeLog(supabase, assessmentId, `Analizando ${task.category.name} - Chunk ${chunkIndex + 1}/${task.chunks.length}`, 'info', task.category.id);
              
              const { data, error } = await supabase.functions.invoke('analyze-category', {
                body: {
                  assessmentId,
                  categoryId: task.category.id,
                  categoryName: task.category.name,
                  categoryFilePath: chunkFile,
                  isChunk: true,
                  chunkInfo: {
                    chunkNumber: chunkIndex + 1,
                    totalChunks: task.chunks.length
                  }
                }
              });

              if (error) {
                await writeLog(supabase, assessmentId, `Error en análisis de ${task.category.name} chunk ${chunkIndex + 1}: ${error.message}`, 'error', task.category.id);
              } else {
                await writeLog(supabase, assessmentId, `Completado ${task.category.name} - Chunk ${chunkIndex + 1}/${task.chunks.length}`, 'info', task.category.id);
                completedTasks++;
              }
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              await writeLog(supabase, assessmentId, `Error procesando chunk ${chunkIndex + 1}: ${errorMessage}`, 'error', task.category.id);
            }

            // Update progress
            await supabase
              .from('assessments')
              .update({
                analysis_progress: {
                  total: totalTasks,
                  completed: completedTasks,
                  current: task.category.name,
                  categories: []
                }
              })
              .eq('id', assessmentId);
          })();
          
          batchPromises.push(promise);
        }
      } else {
        // Process non-chunked category
        const promise = (async () => {
          try {
            await writeLog(supabase, assessmentId, `Analizando ${task.category.name}`, 'info', task.category.id);
            
            const categoryData = buildCategoryData(fullData, task.category.id);
            
            const { data, error } = await supabase.functions.invoke('analyze-category', {
              body: {
                assessmentId,
                categoryId: task.category.id,
                categoryName: task.category.name,
                categoryData
              }
            });

            if (error) {
              await writeLog(supabase, assessmentId, `Error en análisis de ${task.category.name}: ${error.message}`, 'error', task.category.id);
            } else {
              await writeLog(supabase, assessmentId, `Completado ${task.category.name}`, 'info', task.category.id);
              completedTasks++;
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            await writeLog(supabase, assessmentId, `Error procesando ${task.category.name}: ${errorMessage}`, 'error', task.category.id);
          }

          // Update progress
          await supabase
            .from('assessments')
            .update({
              analysis_progress: {
                total: totalTasks,
                completed: completedTasks,
                current: task.category.name,
                categories: []
              }
            })
            .eq('id', assessmentId);
        })();
        
        batchPromises.push(promise);
      }
    }

    // Wait for all tasks in this batch to complete
    await Promise.all(batchPromises);
    await writeLog(supabase, assessmentId, `Batch ${Math.floor(i / BATCH_SIZE) + 1} completado`, 'info');
  }

  // Save raw data to assessment_data table
  try {
    await writeLog(supabase, assessmentId, 'Guardando datos raw en assessment_data', 'info');
    const { error: dataError } = await supabase
      .from('assessment_data')
      .insert({
        assessment_id: assessmentId,
        data: fullData
      });

    if (dataError) {
      await writeLog(supabase, assessmentId, `Error guardando datos raw: ${dataError.message}`, 'error');
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await writeLog(supabase, assessmentId, `Error al guardar datos raw: ${errorMessage}`, 'error');
  }

  // Update final status
  const { error: finalError } = await supabase
    .from('assessments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      analysis_progress: {
        total: totalTasks,
        completed: completedTasks,
        current: null,
        categories: []
      }
    })
    .eq('id', assessmentId);

  if (finalError) {
    await writeLog(supabase, assessmentId, `Error actualizando estado final: ${finalError.message}`, 'error');
  } else {
    await writeLog(supabase, assessmentId, `Análisis completado. Total de tareas: ${completedTasks}/${totalTasks}`, 'info');
  }
}

// Helper function to build category-specific data
function buildCategoryData(fullData: any, categoryId: string) {
  const category = ALL_CATEGORIES.find(c => c.id === categoryId);
  if (!category) return null;

  const categoryData: any = {
    [category.dataKey]: fullData[category.dataKey]
  };

  // Include domain info for all categories
  if (fullData.DomainInfo) {
    categoryData.DomainInfo = fullData.DomainInfo;
  }

  // Include forest info for relevant categories
  if (['domain', 'forest_domain', 'dc_health'].includes(categoryId) && fullData.ForestInfo) {
    categoryData.ForestInfo = fullData.ForestInfo;
  }

  return categoryData;
}
