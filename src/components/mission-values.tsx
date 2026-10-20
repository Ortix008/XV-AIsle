const mission =
  "XV-AIsle exists to remove one of retail's oldest barriers, the cost of holding stock.";
const missionBody =
  "We're building one trusted US marketplace for established brands, independent resellers and everyday shoppers. Brands reach customers beyond their own channels. Soon, resellers will build a business on curation and service, not inventory.";
const vision =
  "Commerce where opportunity isn't limited to those who can afford inventory, and where anyone, from any background, can build a business of their own.";

export function MissionValues() {
  return (
    <>
    <section className="vm" aria-labelledby="mission">
      <div className="vm-floor" />
      <div className="vm-pool" />
      <div className="vm-haze" />
      <div className="vm-in">
        <div className="vm-eye">Our mission</div>
        <h2 className="vm-title" id="mission">
          {mission.split("the cost of holding stock.")[0]}
          <em>the cost of holding stock.</em>
        </h2>
        <p className="vm-body">{missionBody}</p>
        <div className="vm-vision">
          <div className="vm-eye">Our vision</div>
          <p>{vision}</p>
        </div>
        <div className="vm-eye vm-stand">What we stand for</div>
        <div className="vm-vals">
          <article className="vm-card">
            <svg viewBox="0 0 32 32" aria-hidden>
              <path d="M16 3l10 4v8c0 6.5-4.3 11-10 14-5.7-3-10-7.5-10-14V7z" />
              <path d="M11.5 16l3 3 6-6" />
            </svg>
            <b>Integrity</b>
            <p>we state only what we can back up, and we correct what we get wrong.</p>
          </article>
          <article className="vm-card">
            <svg viewBox="0 0 32 32" aria-hidden>
              <path d="M6 28V9l10-5 10 5v19" />
              <path d="M12 28v-9h8v9" />
            </svg>
            <b>Access</b>
            <p>starting a business should take a decision, not a warehouse.</p>
          </article>
          <article className="vm-card">
            <svg viewBox="0 0 32 32" aria-hidden>
              <circle cx="11" cy="16" r="6" />
              <circle cx="21" cy="16" r="6" />
            </svg>
            <b>Partnership</b>
            <p>we shape every policy so brands, resellers and shoppers all benefit.</p>
          </article>
          <article className="vm-card">
            <svg viewBox="0 0 32 32" aria-hidden>
              <rect x="7" y="5" width="18" height="23" rx="2" />
              <path d="M12 5V3h8v2" />
              <path d="M11 14l2.5 2.5L18 12" />
              <path d="M11 22h10" />
            </svg>
            <b>Accountability</b>
            <p>we stand behind every order, from listing to doorstep.</p>
          </article>
          <article className="vm-card">
            <svg viewBox="0 0 32 32" aria-hidden>
              <path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z" />
              <circle cx="16" cy="16" r="4" />
            </svg>
            <b>Transparency</b>
            <p>plain terms and visible pricing, with nothing hidden in the fine print.</p>
          </article>
        </div>
      </div>
    </section>
    </>
  );
}
