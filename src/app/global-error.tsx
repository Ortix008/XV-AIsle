"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#07080a", color: "#f2f3f1", fontFamily: "Inter, system-ui, sans-serif" }}>
        <main style={{ maxWidth: 440, margin: "18vh auto", padding: 24 }}>
          <p style={{ letterSpacing: "0.16em", fontSize: 12, textTransform: "uppercase", color: "#3ddc84" }}>XV-AIsle</p>
          <h1 style={{ fontSize: 28, marginTop: 8 }}>Something interrupted this page.</h1>
          <p style={{ lineHeight: 1.5, color: "#9aa09c" }}>Your account is still signed in on the server.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              background: "#3ddc84",
              color: "#04140a",
              border: 0,
              borderRadius: 999,
              padding: "12px 18px",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
