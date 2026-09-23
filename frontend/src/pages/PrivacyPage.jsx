import { Link } from "react-router-dom";
import LegalDocument, { List, Mail, P, Strong } from "../components/legal/LegalDocument";

/**
 * /privacy — written against what the product actually does (see CLAUDE.md
 * and FEATURE_STATUS.md): per-firm RLS isolation, documents in S3 (or local
 * disk in self-hosted setups), OCR + an LLM (Groq) for extraction, email via
 * Resend/SMTP, GSTIN/GSTR-2B lookups via a GSP, Sentry crash reports, one
 * httpOnly session cookie and no analytics or advertising trackers.
 * If any of those change, this page must change with them.
 */

const sections = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <P>
          Verax is software that reads the financial documents a CA firm receives — invoices, bank statements, purchase
          registers and GST data — and turns them into structured, reviewable data that can be exported to TallyPrime.
        </P>
        <P>
          This policy explains what personal data Verax handles, why, who it is shared with, and the choices you have.
          It covers our website, the Verax app used by CA firms, and the upload links and client portal used by their
          clients.
        </P>
      </>
    )
  },
  {
    id: "roles",
    title: "Our role and yours",
    body: (
      <>
        <P>
          When a CA firm uploads its clients&apos; documents to Verax, <Strong>the firm decides</Strong> what is
          collected and why. For that data, the firm is the data fiduciary (controller) and Verax processes it on the
          firm&apos;s behalf and on its instructions.
        </P>
        <P>
          For the data we collect to run our own business — accounts, demo requests, website usage — Verax is the data
          fiduciary.
        </P>
        <P>
          If you are a firm&apos;s client and have a question about your documents, the firm that invited you is usually
          the best first contact. You can always write to us too.
        </P>
      </>
    )
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <List
          items={[
            <>
              <Strong>Account details</Strong> — name, work email, firm name and a password (stored only as a one-way
              hash) for firm users.
            </>,
            <>
              <Strong>Client records</Strong> — the names, contact details and GSTINs a firm adds for its clients.
            </>,
            <>
              <Strong>Documents and extracted data</Strong> — the files uploaded to Verax and what is read from them:
              parties, GSTINs, invoice numbers, dates, line items, amounts, tax and bank transactions.
            </>,
            <>
              <Strong>Activity records</Strong> — an audit log of actions such as uploads, edits, approvals and exports,
              with the user and time.
            </>,
            <>
              <Strong>Demo requests</Strong> — the email address and details you give us when you ask for a demo.
            </>,
            <>
              <Strong>Technical data</Strong> — IP address, browser type and request logs our servers keep for security
              and troubleshooting, and error reports when something fails.
            </>
          ]}
        />
      </>
    )
  },
  {
    id: "how-we-use",
    title: "How we use it",
    body: (
      <>
        <List
          items={[
            "To provide the service: reading documents, running compliance checks, keeping review history and producing exports.",
            "To keep accounts secure: signing you in, rotating sessions and detecting misuse.",
            "To send service email: upload links, document requests, password resets and replies to your messages.",
            "To answer demo requests and support questions.",
            "To find and fix problems, and to understand how the product performs."
          ]}
        />
        <P>
          We do <Strong>not</Strong> sell personal data, use it for advertising, or use documents uploaded by a firm to
          train AI models.
        </P>
      </>
    )
  },
  {
    id: "processors",
    title: "Service providers",
    body: (
      <>
        <P>Verax relies on a small number of providers to run. Each receives only what its job needs:</P>
        <List
          items={[
            <>
              <Strong>Cloud storage (Amazon Web Services)</Strong> — stores uploaded documents and export files in
              private, per-firm locations.
            </>,
            <>
              <Strong>AI extraction (Groq)</Strong> — receives the text read from a document so the fields can be
              extracted, and returns structured data.
            </>,
            <>
              <Strong>Email delivery</Strong> — sends upload links, requests and account emails.
            </>,
            <>
              <Strong>GST Suvidha Provider</Strong> — used, where enabled, to verify GSTINs and fetch GSTR-2B data for
              reconciliation.
            </>,
            <>
              <Strong>Error monitoring (Sentry)</Strong> — receives technical details when something breaks, so we can
              fix it.
            </>
          ]}
        />
        <P>
          Some providers may process data outside India. Where they do, we rely on their contractual commitments to
          protect it.
        </P>
      </>
    )
  },
  {
    id: "isolation",
    title: "How data is kept separate and secure",
    body: (
      <>
        <P>
          Each firm&apos;s data is isolated at the database level with row-level security, so one firm&apos;s queries
          cannot return another firm&apos;s records. Files go straight from the browser to private storage through
          short-lived upload links; downloads use short-lived links too.
        </P>
        <P>
          Sessions use short-lived access tokens and a rotating refresh token kept in an httpOnly cookie. Client upload
          links are long random tokens that expire. More detail is on our{" "}
          <Link
            to="/security"
            className="text-brand-600 underline decoration-brand-600/30 underline-offset-2 hover:decoration-brand-600"
          >
            Security page
          </Link>
          .
        </P>
        <P>No system is perfectly secure; if we learn of a breach that affects your data, we will tell you.</P>
      </>
    )
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <P>
          Verax sets one essential cookie: an httpOnly session cookie that keeps you signed in. It cannot be read by
          scripts on the page and is not used for tracking.
        </P>
        <P>We do not use analytics, advertising or third-party tracking cookies.</P>
      </>
    )
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <P>
          We keep a firm&apos;s data for as long as its account is active. Deleting a client or document in the app
          removes it from view; it is kept for recovery until the firm asks for permanent deletion.
        </P>
        <P>
          When an account closes, or on a firm&apos;s written request, we delete its documents and data, except where we
          must keep records to meet a legal obligation or resolve a dispute. Demo requests are kept until you ask us to
          remove them.
        </P>
      </>
    )
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <P>Under India&apos;s Digital Personal Data Protection Act, 2023 and other applicable law, you can ask to:</P>
        <List
          items={[
            "see a summary of the personal data we hold about you and how it is used,",
            "correct or complete it,",
            "have it erased, and",
            "nominate someone to exercise these rights for you."
          ]}
        />
        <P>
          Write to <Mail />. If the data belongs to a CA firm&apos;s workspace, we may need to involve the firm. If you
          are not satisfied with our reply, you can complain to the Data Protection Board of India.
        </P>
      </>
    )
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <P>
        We will update this page when our practices change and revise the date at the top. If a change is significant,
        we will tell account holders by email before it takes effect.
      </P>
    )
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <P>
        For anything about privacy, including requests about your data, write to <Mail />.
      </P>
    )
  }
];

const PrivacyPage = () => (
  <LegalDocument
    title="Privacy Policy"
    updated="23 September 2026"
    intro="Verax exists to handle other people's financial paperwork, so how we treat that data is the product. This page says plainly what we collect, what we do with it and what we never do."
    sections={sections}
  />
);

export default PrivacyPage;
