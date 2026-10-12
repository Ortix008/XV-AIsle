"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-5">
      <div className="page-read">
        <p className="eyebrow">Market</p>
        <h1 className="page-title">Something interrupted this page.</h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
          Your account is still signed in on the server. Try the page again.
        </p>
        <button type="button" className="pill pill-primary mt-8" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
