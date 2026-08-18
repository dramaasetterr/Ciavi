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

export async function POST(request: NextRequest) {
  try {
    const { listing_id, name, phone, email, interested } = await request.json();

    if (!listing_id || !name?.trim()) {
      return json({ error: "listing_id and name are required" }, 400);
    }
    if (!phone?.trim() && !email?.trim()) {
      return json({ error: "Please provide a phone number or email" }, 400);
    }

    const { data: listing } = await getSupabase()
      .from("listings")
      .select("id, user_id, address")
      .eq("id", listing_id)
      .single();

    if (!listing) {
      return json({ error: "Listing not found" }, 404);
    }

    // Open-house sign-ins land in the seller's in-app Messages as a lead.
    const contactBits = [
      phone?.trim() ? `📞 ${phone.trim()}` : null,
      email?.trim() ? `✉️ ${email.trim()}` : null,
    ].filter(Boolean);

    const content = [
      `🚪 Open house sign-in`,
      `${name.trim()}`,
      ...contactBits,
      interested ? `Interest level: ${interested}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { error: insertError } = await getSupabase().from("messages").insert({
      listing_id,
      sender_id: null,
      receiver_id: listing.user_id,
      content,
      sender_name: name.trim(),
      sender_email: email?.trim() || "",
      read: false,
    });

    if (insertError) {
      return json({ error: "Could not save your sign-in. Please try again." }, 500);
    }

    // Push the seller a heads-up (fire-and-forget)
    const { data: seller } = await getSupabase()
      .from("profiles")
      .select("push_token")
      .eq("id", listing.user_id)
      .single();

    if (seller?.push_token) {
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: seller.push_token,
          title: "Open house visitor ✍️",
          body: `${name.trim()} just signed in at ${listing.address}`,
          data: { type: "message" },
          sound: "default",
        }),
      }).catch(() => {});
    }

    return json({ success: true });
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
}
