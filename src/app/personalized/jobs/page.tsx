import type { Metadata } from "next";
import { ShopFrame } from "@/components/shop-frame";
import { formatJobSheet } from "@/lib/personalized";
import { listPersonalizedJobs } from "@/lib/server/personalized-jobs";
import { requireOperator } from "@/lib/server/require-operator";

export const metadata: Metadata = {
  title: "Personalized jobs · XV-AIsle",
  robots: { index: false, follow: false },
};

export default async function PersonalizedJobsPage() {
  await requireOperator();
  const jobs = listPersonalizedJobs();
  return (
    <ShopFrame>
      <article className="mx-auto max-w-[1280px] px-5 py-12 sm:px-10">
        <p className="eyebrow">Operator</p>
        <h1 className="mt-3 text-4xl">Job tickets</h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          A verified operator account opens this page. It does not create another account. A ticket lists the design,
          the letters, and production. It does not list a street or an email.
        </p>
        {jobs.length === 0 ? <p className="mt-6 text-sm">No personalized jobs.</p> : null}
        <ul className="mt-6 space-y-4">
          {jobs.map((job) => (
            <li key={job.id}>
              <pre className="whitespace-pre-wrap text-sm">{formatJobSheet(job)}</pre>
            </li>
          ))}
        </ul>
      </article>
    </ShopFrame>
  );
}
