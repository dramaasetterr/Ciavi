const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

/**
 * Fire-and-forget push notification to another Chiavi user.
 * Failures are swallowed — a missed push should never break the calling flow.
 */
export function sendPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): void {
  fetch(`${API_BASE}/api/send-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title, body, data }),
  }).catch(() => {});
}
