import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session token
    const sessionToken = req.headers.get("x-session-token");
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "No session token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userId, error: sessionError } = await supabase
      .rpc("validate_session", { p_session_token: sessionToken });

    if (sessionError || !userId) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bucketType = formData.get("bucket_type") as string; // 'communities' or 'businesses'
    const entityId = formData.get("entity_id") as string;
    const imageType = formData.get("image_type") as string; // 'cover' or 'logo'

    if (!file || !bucketType || !entityId || !imageType) {
      return new Response(
        JSON.stringify({ error: "File, bucket_type, entity_id, and image_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate bucket type
    const validBuckets = ["communities", "businesses"];
    if (!validBuckets.includes(bucketType)) {
      return new Response(
        JSON.stringify({ error: "Invalid bucket type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "File must be less than 5MB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "Only JPEG, PNG, GIF, and WebP images are allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership based on bucket type
    if (bucketType === "communities") {
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("created_by")
        .eq("id", entityId)
        .single();

      if (communityError || !community || community.created_by !== userId) {
        return new Response(
          JSON.stringify({ error: "Not authorized to upload images for this community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (bucketType === "businesses") {
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("owner_id")
        .eq("id", entityId)
        .single();

      if (businessError || !business || business.owner_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Not authorized to upload images for this business" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate file path
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${entityId}/${imageType}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(bucketType)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketType)
      .getPublicUrl(fileName);

    // Update the entity with the image URL
    const updateField = imageType === "cover" ? "cover_image_url" : "logo_url";
    
    if (bucketType === "communities") {
      const { error: updateError } = await supabase
        .from("communities")
        .update({ [updateField]: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", entityId);

      if (updateError) {
        console.error("Community update error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (bucketType === "businesses") {
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ [updateField]: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", entityId);

      if (updateError) {
        console.error("Business update error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        image_url: urlData.publicUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
