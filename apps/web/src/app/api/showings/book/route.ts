import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { BookShowingInput } from '@/shared';
import { json, OPTIONS } from "../../_cors";

export { OPTIONS };

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("Missing required environment variable: RESEND_API_KEY");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function POST(request: NextRequest) {
  try {
    const body: BookShowingInput = await request.json();
    const { listing_id, slot_id, buyer_name, buyer_email, buyer_phone } = body;

    if (!listing_id || !slot_id || !buyer_name || !buyer_email) {
      return json(
        { error: "listing_id, slot_id, buyer_name, and buyer_email are required" },
        400
      );
    }

    // Fetch the availability slot
    const { data: slot, error: slotError } = await getSupabase()
      .from("showing_availability")
      .select("*")
      .eq("id", slot_id)
      .eq("listing_id", listing_id)
      .eq("is_booked", false)
      .single();

    if (slotError || !slot) {
      return json({ error: "Time slot is no longer available" }, 409);
    }

    // Fetch listing for seller info
    const { data: listing } = await getSupabase()
      .from("listings")
      .select("*, user_id")
      .eq("id", listing_id)
      .single();

    if (!listing) {
      return json({ error: "Listing not found" }, 404);
    }

    // Get seller profile for email + push notification
    const { data: seller } = await getSupabase()
      .from("profiles")
      .select("email, full_name, push_token")
      .eq("id", listing.user_id)
      .single();

    // Create the showing record
    const { data: showing, error: showingError } = await getSupabase()
      .from("showings")
      .insert({
        listing_id,
        seller_id: listing.user_id,
        availability_id: slot_id,
        buyer_name,
        buyer_email,
        buyer_phone: buyer_phone || null,
        showing_date: slot.date,
        showing_time_start: slot.start_time,
        showing_time_end: slot.end_time,
        status: "confirmed",
      })
      .select()
      .single();

    if (showingError) {
      return json({ error: "Failed to book showing" }, 500);
    }

    // Mark slot as booked
    await getSupabase()
      .from("showing_availability")
      .update({ is_booked: true })
      .eq("id", slot_id);

    // Push notification to the seller (fire-and-forget)
    if (seller?.push_token) {
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: seller.push_token,
          title: "New showing booked! 🏠",
          body: `${buyer_name} booked a showing for ${listing.address} on ${slot.date}`,
          data: { type: "showing", listingId: listing_id },
          sound: "default",
        }),
      }).catch(() => {});
    }

    // Format time for email
    const formatTime = (time: string) => {
      const [h, m] = time.split(":");
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${m} ${ampm}`;
    };

    // Send email notification to seller
    if (seller?.email) {
      try {
        await getResend().emails.send({
          from: "Chiavi <notifications@gochiavi.com>",
          to: seller.email,
          subject: `New Showing Booked — ${listing.address}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #111827; margin-bottom: 4px;">New Showing Booked</h2>
              <p style="color: #6B7280; margin-top: 0;">A buyer has scheduled a showing for your property.</p>

              <div style="background: #F9FAFB; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #E5E7EB;">
                <p style="margin: 0 0 8px; color: #111827; font-weight: 600;">${listing.address}</p>
                <p style="margin: 0 0 4px; color: #374151;"><strong>Date:</strong> ${slot.date}</p>
                <p style="margin: 0; color: #374151;"><strong>Time:</strong> ${formatTime(slot.start_time)} — ${formatTime(slot.end_time)}</p>
              </div>

              <div style="margin: 20px 0;">
                <p style="margin: 0 0 4px; color: #111827; font-weight: 600;">Buyer Contact</p>
                <p style="margin: 0 0 4px; color: #374151;">${escapeHtml(buyer_name)}</p>
                <p style="margin: 0 0 4px; color: #374151;">${escapeHtml(buyer_email)}</p>
                ${buyer_phone ? `<p style="margin: 0; color: #374151;">${escapeHtml(buyer_phone || '')}</p>` : ""}
              </div>

              <p style="color: #9CA3AF; font-size: 13px; margin-top: 24px;">— Chiavi FSBO Platform</p>
            </div>
          `,
        });
      } catch {
        // Email send failed silently — showing is still booked
      }
    }

    return json({ showing });
  } catch {
    return json({ error: "Failed to book showing" }, 500);
  }
}


