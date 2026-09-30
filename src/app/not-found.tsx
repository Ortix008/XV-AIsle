import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[50vh] place-items-center px-6 py-16">
      <div className="max-w-md">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Market</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">That page is not on the floor.</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          The market, the SI Team, and membership are the pages that open.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline">
          Back to the market
        </Link>
      </div>
    </div>
  );
}
