import { Link } from "react-router-dom";
import LegalDocument, { List, Mail, P, Strong } from "../components/legal/LegalDocument";

/**
 * /terms — the terms a CA firm accepts when it uses Verax. Kept consistent
 * with /privacy and with what the product does: extraction is assistive and
 * every voucher is approved by a person before export.
 */

const sections = [
  {
    id: "agreement",
    title: "Agreeing to these terms",
    body: (
      <>
        <P>
          These terms govern your use of Verax — the website, the app used by CA firms, and the upload links and client
          portal used by their clients. By creating an account or using Verax, you agree to them.
        </P>
        <P>
          If you use Verax on behalf of a firm, you confirm you are authorised to accept these terms for it, and
          &quot;you&quot; means the firm.
        </P>
      </>
    )
  },
  {
    id: "the-service",
    title: "The service",
    body: (
      <>
        <P>
          Verax reads financial documents, extracts structured data, runs compliance checks (such as GSTIN validation,
          tax arithmetic and duplicate detection), supports GSTR-2B reconciliation and produces exports for TallyPrime.
        </P>
        <P>
          We improve Verax continuously, so features may change. We will not remove a core part of the service you rely
          on without reasonable notice.
        </P>
      </>
    )
  },
  {
    id: "accounts",
    title: "Accounts and access",
    body: (
      <List
        items={[
          "Give accurate details when you sign up, and keep them current.",
          "Keep passwords safe and do not share accounts; each team member should have their own login.",
          "You are responsible for what happens under your firm's accounts, and for the team members and clients you invite.",
          "Tell us promptly at the address below if you suspect unauthorised access."
        ]}
      />
    )
  },
  {
    id: "your-data",
    title: "Your data",
    body: (
      <>
        <P>
          <Strong>You own your data.</Strong> Documents you or your clients upload, and the data extracted from them,
          belong to you. You give us permission to store and process them only to provide the service to you.
        </P>
        <P>
          You confirm you have the right to upload the documents you send to Verax — including your clients&apos;
          consent or another lawful basis where one is needed. How we handle personal data is set out in our{" "}
          <Link
            to="/privacy"
            className="text-brand-600 underline decoration-brand-600/30 underline-offset-2 hover:decoration-brand-600"
          >
            Privacy Policy
          </Link>
          .
        </P>
      </>
    )
  },
  {
    id: "review",
    title: "Review before you rely on it",
    body: (
      <>
        <P>
          Verax uses OCR and AI to read documents. It is designed to be accurate and it flags what it is unsure of, but
          it can make mistakes — especially with poor scans or unusual layouts.
        </P>
        <P>
          <Strong>Verax is a tool that assists professionals; it is not accounting, tax or legal advice.</Strong> You
          remain responsible for reviewing extracted data and exports before they are posted to your books or used in
          any filing. Verax requires a person to approve each document before it can be exported for this reason.
        </P>
      </>
    )
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <P>You agree not to:</P>
        <List
          items={[
            "upload content you have no right to share, or anything unlawful or malicious;",
            "try to reach another firm's data, probe or break our security, or get around usage limits;",
            "reverse-engineer, copy or resell the service, or use it to build a competing product;",
            "overload the service or use it in a way that harms other users."
          ]}
        />
        <P>We may suspend access that breaks these rules, and will tell you why unless the law prevents us.</P>
      </>
    )
  },
  {
    id: "fees",
    title: "Plans and fees",
    body: (
      <P>
        Paid plans, their prices and what they include are shown on the{" "}
        <Link
          to="/pricing"
          className="text-brand-600 underline decoration-brand-600/30 underline-offset-2 hover:decoration-brand-600"
        >
          Pricing page
        </Link>{" "}
        or agreed with you in writing. Fees are exclusive of applicable taxes, including GST. We will give you notice
        before any price change applies to you.
      </P>
    )
  },
  {
    id: "ip",
    title: "Our intellectual property",
    body: (
      <P>
        Verax — its software, design and brand — belongs to us. These terms give you the right to use the service while
        your account is active; they do not transfer any ownership. If you send us feedback, we may use it to improve
        Verax without obligation to you.
      </P>
    )
  },
  {
    id: "availability",
    title: "Availability and warranties",
    body: (
      <P>
        We work to keep Verax available and secure, but we provide it &quot;as is&quot; and cannot promise it will be
        uninterrupted or error-free. To the extent the law allows, we disclaim warranties not stated in these terms,
        including fitness for a particular purpose.
      </P>
    )
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <P>
        To the extent the law allows, Verax is not liable for indirect or consequential losses — such as lost profits,
        penalties or lost data — and our total liability for any claim is limited to the fees you paid us in the twelve
        months before it arose. Nothing in these terms limits liability that cannot be limited by law.
      </P>
    )
  },
  {
    id: "ending",
    title: "Ending your use",
    body: (
      <>
        <P>
          You can stop using Verax and ask us to close your account at any time. We may end or suspend an account that
          seriously or repeatedly breaks these terms.
        </P>
        <P>
          After an account closes, you can ask us for an export of your data within 30 days; after that, we delete it as
          described in the Privacy Policy.
        </P>
      </>
    )
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <P>
        These terms are governed by the laws of India. We would rather resolve any disagreement by talking first;
        failing that, disputes are subject to the jurisdiction of the courts of India.
      </P>
    )
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <P>
        We may update these terms as the service changes. We will revise the date at the top and, for significant
        changes, email account holders before they take effect. Continuing to use Verax after that means you accept the
        updated terms.
      </P>
    )
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <P>
        Questions about these terms? Write to <Mail />.
      </P>
    )
  }
];

const TermsPage = () => (
  <LegalDocument
    title="Terms of Service"
    updated="23 September 2026"
    intro="The agreement between Verax and the firms that use it, in plain language: what we provide, what you are responsible for, and what happens if things go wrong."
    sections={sections}
  />
);

export default TermsPage;
