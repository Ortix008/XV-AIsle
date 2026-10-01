"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-6 py-16">
      <div className="max-w-md">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Market</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Something interrupted this page.</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Your account is still signed in on the server. Try the page again.
        </p>
        <button
          type="button"
          className="mt-4 text-sm font-medium underline-offset-4 hover:underline"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
