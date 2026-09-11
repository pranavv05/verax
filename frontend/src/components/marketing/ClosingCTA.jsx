import { Reveal } from "../public/motion";
import DemoRequestForm from "./DemoRequestForm";
import { Rail } from "./ledger";

/**
 * The close, on near-black — the page's only other full-bleed dark moment
 * besides the engine and the export section, so arriving here reads as an
 * ending rather than as another section.
 *
 * The form posts to the existing public waitlist route; nothing new was added
 * to the API for the redesign. `tone="onDark"` is the inverted variant added
 * for this section — the two pre-existing tones are both light-ground.
 */

const ClosingCTA = () => (
  <section id="demo" className="vx-dark scroll-mt-16">
    <div className="vx-shell vx-section">
      <Reveal className="mx-auto max-w-[54rem] text-center">
        <Rail dark className="mx-auto mb-14 w-24" />

        <h2 className="vx-display-xl text-white">
          Your staff shouldn&apos;t spend
          <br />
          tomorrow entering invoices.
        </h2>

        <p className="vx-body mx-auto mt-8 max-w-[34rem] text-carbon-300">
          Send us a few of your own documents and we&apos;ll run them through
          Verax with you. Fifteen minutes, no slide deck.
        </p>

        <div className="mt-11 flex justify-center">
          <DemoRequestForm tone="onDark" />
        </div>

        <p className="mt-12 text-[0.875rem] text-carbon-400">
          Or write to us:{" "}
          <a
            href="mailto:verax.hello@gmail.com"
            className="rounded text-carbon-200 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-carbon-950"
          >
            verax.hello@gmail.com
          </a>
        </p>
      </Reveal>
    </div>
  </section>
);

export default ClosingCTA;
