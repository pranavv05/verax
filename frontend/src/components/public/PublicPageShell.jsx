import VeraxLogo from "../brand/VeraxLogo";

/**
 * Chrome for the unauthenticated magic-link pages (upload + status).
 *
 * These are opened by SME clients — usually on a phone, often from a WhatsApp
 * link — so the header stays minimal and the content column is narrow.
 */
const PublicPageShell = ({ children, badge, maxWidth = "max-w-3xl" }) => (
  <div className="vx-page flex min-h-screen flex-col">
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface/85 backdrop-blur-xl">
      <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-4 px-5 py-3.5 sm:px-6`}>
        <VeraxLogo size={30} />
        {badge ? (
          <span className="hidden rounded-full border border-hairline bg-black/[0.02] px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-zinc-500 sm:inline-flex">
            {badge}
          </span>
        ) : null}
      </div>
    </header>

    <main className={`mx-auto w-full flex-1 ${maxWidth} px-5 py-8 sm:px-6 sm:py-12`}>{children}</main>

    <footer className="border-t border-hairline bg-surface">
      <div className={`mx-auto flex ${maxWidth} flex-col items-center gap-2 px-5 py-6 text-center sm:flex-row sm:justify-between sm:text-left`}>
        <p className="text-xs text-zinc-500">
          Secured by Verax · Your documents are encrypted in transit and at rest.
        </p>
        <a
          className="text-xs font-semibold text-zinc-400 underline-offset-2 hover:text-zinc-100 hover:underline"
          href="mailto:verax.hello@gmail.com"
        >
          Need help?
        </a>
      </div>
    </footer>
  </div>
);

export default PublicPageShell;
