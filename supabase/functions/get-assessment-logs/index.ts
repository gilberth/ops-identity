import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assessmentId } = await req.json();

    if (!assessmentId) {
      throw new Error('Assessment ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '');
    
    // Fetch logs from the assessment_logs table
    const { data: logsData, error: logsError } = await supabase
      .from('assessment_logs')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('created_at', { ascending: true })
      .limit(500);

    if (logsError) {
      console.error('Error fetching logs:', logsError);
      throw new Error(`Failed to fetch logs: ${logsError.message}`);
    }

    const logs = (logsData || []).map((log: any) => ({
      timestamp: new Date(log.created_at).getTime(),
      level: log.level || 'info',
      message: log.message || '',
      category: log.category_id || null
    }));

    return new Response(
      JSON.stringify({ logs }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error fetching logs:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: []
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
