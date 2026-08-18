import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { json, OPTIONS } from "../_cors";

export { OPTIONS };

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase env");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Public: returns just the address line for the open-house sign-in header.
export async function GET(request: NextRequest) {
  const listingId = request.nextUrl.searchParams.get("listing_id");
  if (!listingId) return json({ error: "listing_id required" }, 400);

  const { data } = await getSupabase()
    .from("listings")
    .select("address, city, state")
    .eq("id", listingId)
    .single();

  if (!data) return json({ error: "Not found" }, 404);

  const address = [data.address, [data.city, data.state].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ");
  return json({ address });
}
