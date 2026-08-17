import { createClient } from "@supabase/supabase-js";
import { json, OPTIONS } from "../_cors";

export { OPTIONS };

export const dynamic = "force-dynamic";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing Supabase env (SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Pinged daily by Vercel Cron so the free-tier Supabase project never
// pauses for inactivity (which is how the original database was lost).
export async function GET() {
  const { error } = await getSupabase()
    .from("waitlist")
    .select("id", { count: "exact", head: true });

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, pingedAt: new Date().toISOString() });
}
