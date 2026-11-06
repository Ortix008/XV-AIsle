import { personalizedProducts } from "@/data/personalized-products";
import { money } from "@/lib/money";

export function PersonalizedCards() {
  const physical = personalizedProducts.filter((item) => item.kind === "physical");
  const digital = personalizedProducts.filter((item) => item.kind === "digital");
  return (
    <div className="mt-10 space-y-10">
      <section aria-label="Physical items">
        <h2 className="text-2xl">Physical</h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {physical.map((item) => (
            <li key={item.id} className="border border-border bg-card p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">Physical</p>
              <h3 className="mt-1 text-lg">{item.title}</h3>
              <p className="mt-2 text-sm">{money(item.priceCents / 100)}</p>
              {item.packSize != null ? <p className="mt-1 text-sm text-muted-foreground">Set of {item.packSize}</p> : null}
              <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
              {item.lettering ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.lettering.label}, {item.lettering.maxChars} characters or fewer.
                </p>
              ) : null}
              {item.productionBusinessDays ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Stated production is {item.productionBusinessDays.min}–{item.productionBusinessDays.max} business days.
                  Postage is not set.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Postage and production time are not set.</p>
              )}
              <p className="mt-3 text-sm font-medium" role="status">
                Not available to purchase
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Digital items">
        <h2 className="text-2xl">Digital</h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {digital.map((item) => (
            <li key={item.id} className="border border-border bg-card p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">Digital. Not shipped.</p>
              <h3 className="mt-1 text-lg">{item.title}</h3>
              <p className="mt-2 text-sm">{money(item.priceCents / 100)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
              <p className="mt-3 text-sm font-medium" role="status">
                Not available to purchase
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
