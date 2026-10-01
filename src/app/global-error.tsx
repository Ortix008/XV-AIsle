"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f4f5f7", color: "#1a1a1a", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 440, margin: "18vh auto", padding: 24 }}>
          <p style={{ letterSpacing: "0.16em", fontSize: 12, textTransform: "uppercase" }}>XVAIsle</p>
          <h1 style={{ fontSize: 28, marginTop: 8 }}>Something interrupted this page.</h1>
          <p style={{ lineHeight: 1.5 }}>Your account is still signed in on the server.</p>
          <button type="button" onClick={() => reset()} style={{ marginTop: 16 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
