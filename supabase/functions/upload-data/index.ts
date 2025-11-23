import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

serve(async (req) => {
  console.log('=== Upload Data Function Called ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Creating Supabase client...');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Parsing request body...');
    const body = await req.json();
    
    let requestData;
    let assessmentId;
    let skipDataStorage = false; // Flag to skip storing data if already in storage
    
    // Check if file was uploaded to Storage (for large files)
    if (body.fromStorage && body.storageFilePath && body.assessmentId) {
      console.log('File uploaded to Storage, skipping processing in upload-data');
      console.log('Storage path:', body.storageFilePath);
      assessmentId = body.assessmentId;
      skipDataStorage = true; // Don't try to store data again
      requestData = null; // Don't load the file here, too big
      
      // Update assessment with file path only
      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          status: 'uploaded',
          file_path: body.storageFilePath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId);
      
      if (updateError) {
        console.error('Error updating assessment with file path:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update assessment', details: updateError.message }),
          { status: 500, headers: corsHeaders }
        );
      }
      
      console.log('Assessment updated with file path, will process later');
      
      // Return early - don't try to process the file
      return new Response(
        JSON.stringify({ 
          success: true, 
          assessmentId,
          message: 'File uploaded successfully. Processing will start shortly.',
          needsProcessing: true
        }),
        { status: 200, headers: corsHeaders }
      );
    }
    // Check if data is sent as raw JSON string (from manual upload)
    else if (body.rawJson && body.assessmentId) {
      console.log('Processing raw JSON from manual upload');
      console.log('Raw JSON size:', body.rawJson.length, 'bytes');
      
      try {
        // Parse the JSON on backend instead of frontend
        requestData = JSON.parse(body.rawJson);
        assessmentId = body.assessmentId;
        console.log('Successfully parsed JSON on backend');
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON format' }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      // Data from PowerShell script (already parsed)
      console.log('Processing data from PowerShell script');
      requestData = body;
      assessmentId = body.AssessmentId;
    }
    
    console.log('Request data size:', JSON.stringify(requestData).length, 'bytes');
    
    // Only normalize critical fields
    const normalizeString = (str: string): string => {
      try {
        return str.normalize('NFC');
      } catch {
        return str;
      }
    };
    
    const normalizedData = {
      DomainName: normalizeString(requestData.DomainName || ''),
      AssessmentId: assessmentId
    };
    
    console.log('Received assessment data for domain:', normalizedData.DomainName);
    console.log('Assessment ID:', normalizedData.AssessmentId);

    let assessment;

    // If AssessmentId is provided, update existing assessment
    if (assessmentId) {
      console.log('Updating existing assessment:', assessmentId);
      // Verify assessment exists
      const { data: existingAssessment, error: fetchError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (fetchError || !existingAssessment) {
        console.error('Assessment not found:', assessmentId);
        return new Response(
          JSON.stringify({ error: 'Assessment not found', assessmentId }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Update existing assessment to analyzing status
      const { data: updatedAssessment, error: updateError } = await supabase
        .from('assessments')
        .update({
          status: 'analyzing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating assessment:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update assessment', details: updateError }),
          { status: 500, headers: corsHeaders }
        );
      }

      assessment = updatedAssessment;
      console.log('Updated existing assessment:', assessment.id);
    } else {
      // Create new assessment if no ID provided (backward compatibility)
      console.log('Creating new assessment for domain:', normalizedData.DomainName);
      const { data: newAssessment, error: assessmentError } = await supabase
        .from('assessments')
        .insert({
          domain: normalizedData.DomainName,
          status: 'analyzing',
        })
        .select()
        .single();

      if (assessmentError) {
        console.error('Error creating assessment:', assessmentError);
        return new Response(
          JSON.stringify({ error: 'Failed to create assessment', details: assessmentError }),
          { status: 500, headers: corsHeaders }
        );
      }

      assessment = newAssessment;
      console.log('Created new assessment:', assessment.id);
    }

    // Store raw data - use original to avoid memory duplication
    const { error: dataError } = await supabase
      .from('assessment_data')
      .insert({
        assessment_id: assessment.id,
        data: requestData,
      });

    if (dataError) {
      console.error('Error storing assessment data:', dataError);
      return new Response(
        JSON.stringify({ error: 'Failed to store data', details: dataError }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('Stored assessment data successfully');

    // Skip storage upload for now to avoid memory issues with large files
    // Data is already stored in assessment_data table
    console.log('Skipping storage upload to conserve memory');

    // Trigger analysis (call analyze function)
    const analyzeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-assessment`;
    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ assessmentId: assessment.id }),
    });

    if (!analyzeResponse.ok) {
      console.error('Failed to trigger analysis:', await analyzeResponse.text());
    } else {
      console.log('Analysis triggered successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        assessmentId: assessment.id,
        message: 'Data received successfully. Analysis in progress.' 
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('=== ERROR IN UPLOAD-DATA FUNCTION ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, details: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
