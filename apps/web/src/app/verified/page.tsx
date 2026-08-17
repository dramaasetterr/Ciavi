import Link from "next/link";

export const metadata = {
  title: "Email Verified — Chiavi",
};

export default function VerifiedPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEF7E4",
        padding: "1rem",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem", color: "#1a1a1a" }}>
          Your email is verified!
        </h1>
        <p style={{ color: "#555", marginBottom: "2rem", lineHeight: 1.5 }}>
          Your Chiavi account is ready. If you signed up on your phone, head
          back to the Chiavi app and log in. Otherwise, log in right here.
        </p>

        <Link
          href="/login"
          style={{
            display: "block",
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "#C4A265",
            color: "#fff",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: 600,
            textDecoration: "none",
            boxSizing: "border-box",
          }}
        >
          Log in on the web
        </Link>
      </div>
    </div>
  );
}
