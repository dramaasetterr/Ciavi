"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const GOLD = "#C4A265";
const CREAM = "#FEF7E4";
const NAVY = "#1C1C28";

const INTEREST_OPTIONS = ["Very interested", "Somewhat interested", "Just looking"];

export default function OpenHouseSignInPage() {
  const params = useParams<{ listingId: string }>();
  const listingId = params?.listingId;

  const [address, setAddress] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [interested, setInterested] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) return;
    fetch(`/api/open-house-listing?listing_id=${listingId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.address && setAddress(d.address))
      .catch(() => {});
  }, [listingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Please add a phone number or email so the seller can follow up.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/open-house-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, name, phone, email, interested }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error || "Something went wrong. Please try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.85rem",
    fontSize: "1rem",
    borderRadius: 10,
    border: "1.5px solid #ddd",
    boxSizing: "border-box",
    backgroundColor: "#fff",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: CREAM,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 440, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: 2, color: NAVY }}>
            CHIAVI
          </div>
          <div style={{ color: GOLD, fontSize: 12, letterSpacing: 1 }}>OPEN HOUSE SIGN-IN</div>
        </div>

        {done ? (
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: "2rem",
              textAlign: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🏡</div>
            <h1 style={{ fontSize: "1.4rem", color: NAVY, marginBottom: "0.5rem" }}>
              Thanks for stopping by!
            </h1>
            <p style={{ color: "#555", lineHeight: 1.5 }}>
              You're signed in. Enjoy the tour — the seller has your info and
              can answer any questions.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: "1.5rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "0.9rem",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: "1.3rem", color: NAVY, margin: 0 }}>Welcome!</h1>
              {address && (
                <p style={{ color: "#777", margin: "0.25rem 0 0", fontSize: 14 }}>{address}</p>
              )}
              <p style={{ color: "#777", margin: "0.25rem 0 0", fontSize: 14 }}>
                Please sign in before touring the home.
              </p>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: "#FDECEC",
                  color: "#8A2C2C",
                  borderRadius: 8,
                  padding: "0.6rem 0.8rem",
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            <input
              style={inputStyle}
              placeholder="Full name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            <input
              style={inputStyle}
              placeholder="Phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <input
              style={inputStyle}
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {INTEREST_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setInterested(interested === opt ? null : opt)}
                  style={{
                    padding: "0.5rem 0.9rem",
                    borderRadius: 999,
                    border: `1.5px solid ${interested === opt ? GOLD : "#ddd"}`,
                    backgroundColor: interested === opt ? GOLD : "#fff",
                    color: interested === opt ? "#fff" : NAVY,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "0.9rem",
                backgroundColor: GOLD,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: "1.05rem",
                fontWeight: 700,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>

            <p style={{ color: "#999", fontSize: 12, textAlign: "center", margin: 0 }}>
              Your info goes only to the home seller so they can follow up.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
