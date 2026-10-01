import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[50vh] place-items-center px-6 py-16">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">We cannot find that page.</h1>
        <p className="mt-2 text-base">Check the link, or go back to the shop.</p>
        <Link href="/shop" className="mt-4 inline-block text-base font-medium underline underline-offset-4">
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
