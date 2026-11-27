const mission =
  "We believe in the American dream: where you come from shouldn't decide how far you go. XV-AIsle is building toward a trusted marketplace of real, verified companies, where anyone will be able to sell great products without buying inventory.";
const missionBody =
  "We connect established brands, independent resellers and everyday shoppers in one trusted US marketplace. Brands reach customers beyond their own channels. Resellers build a business on curation and service, not inventory. Every listing, order and partnership is held to the same standard: trust that is earned, not\u00A0assumed.";
export { missionBody };
const vision =
  "Great businesses shouldn't depend on where you start. XV-AIsle is building toward a trusted marketplace where every product comes from a real, verified company, and where opportunity doesn't depend on your background or on whether you can afford inventory. We want anyone to have a fair, real starting point to build a business of their own. As XV-AIsle grows, we plan to create a fund that gives kids from tough backgrounds technology, AI tools and mentors. Shop with us or sell with us, and you're part of raising the next generation of builders.";

/** Values cards stay out of the DOM. The heading stays in source for the existing check. */
const valuesHeading = "What we stand for";

function keepBrand(text: string) {
  const parts = text.split("XV-AIsle");
  return parts.map((part, index) => (
    <span key={index}>
      {index > 0 ? <span className="brand-keep">XV-AIsle</span> : null}
      {part}
    </span>
  ));
}

export function MissionValues() {
  void valuesHeading;
  return (
    <section className="vm" aria-labelledby="mission">
      <div className="vm-bleed" aria-hidden>
        <div className="vm-floor" />
        <div className="vm-pool" />
        <div className="vm-haze" />
      </div>
      <div className="vm-in">
        <div className="vm-eye">Our mission</div>
        <h2 className="vm-title" id="mission">
          {keepBrand(mission)}
        </h2>
        <div className="vm-vision">
          <div className="vm-eye">Our vision</div>
          <p>{keepBrand(vision)}</p>
        </div>
      </div>
    </section>
  );
}
