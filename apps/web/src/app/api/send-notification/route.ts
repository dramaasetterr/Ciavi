import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Service-role client: this route is called from the mobile app to notify a
// *different* user, whose push token is not readable under caller RLS.
let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase env");
    _supabase = createServiceClient(url, key);
  }
  return _supabase;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, title, body, data } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: "userId, title, and body are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Look up the user's push token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.push_token) {
      return NextResponse.json(
        { error: "User has no push token registered" },
        { status: 404 }
      );
    }

    // Send notification via Expo's push API
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: profile.push_token,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to send notification", details: result },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("send-notification error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
