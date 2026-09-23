import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "../public/motion";
import { waitlistApi } from "../../api/waitlist-api";

/**
 * Posts to the existing public `POST /api/waitlist/join` endpoint — the only
 * unauthenticated lead-capture route the backend exposes. Any well-formed
 * email is accepted (Gmail, Outlook, company domains, etc.) — malformed
 * addresses are rejected server-side with a 400.
 *
 * Two-step so the landing page keeps its original single-field look: step 1
 * only asks for email (unchanged from before); step 2 reveals two more
 * inputs — firm name and contact name — only once someone has committed to
 * requesting a demo, so Verax can tell who the lead actually is instead of
 * just an inbox address.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DemoRequestForm = ({ tone = "light" }) => {
  // The form now appears twice on the homepage (hero + closing CTA), so the
  // label/input ids have to be unique per instance.
  const uid = useId();
  const [step, setStep] = useState("email"); // email | details
  const [email, setEmail] = useState("");
  const [firmName, setFirmName] = useState("");
  const [contactName, setContactName] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  const resetFeedback = () => {
    if (status === "error") {
      setStatus("idle");
      setMessage("");
    }
  };

  const onEmailSubmit = (event) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }
    setStatus("idle");
    setMessage("");
    setStep("details");
  };

  const onDetailsSubmit = async (event) => {
    event.preventDefault();
    if (!firmName.trim() || !contactName.trim()) {
      setStatus("error");
      setMessage("Please add your firm name and your name so we know who to reach out to.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const data = await waitlistApi.join({
        email: email.trim(),
        firmName: firmName.trim(),
        contactName: contactName.trim()
      });
      setStatus("success");
      setMessage(data.message || "Thanks — we'll be in touch within one business day.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Couldn't reach the server. Please email verax.hello@gmail.com instead.");
    }
  };

  const editEmail = () => {
    setStep("email");
    setStatus("idle");
    setMessage("");
  };

  // `tone` is unfortunately named for historical reasons: "dark" and "light"
  // both describe *light-ground* variants (the old dark-canvas pass inverted
  // the meaning and the names never got fixed). "onDark" is the genuinely
  // inverted variant, added for the V2 closing CTA, which sits on near-black —
  // the other two put teal-600 success text and graphite hint text on carbon,
  // neither of which passes contrast.
  const onDark = tone === "dark";
  // "hero": Mercury-style — the email field and its button share one pill.
  // Only the email step differs; the details step reuses the light fields.
  const hero = tone === "hero";
  const inverted = tone === "onDark";
  const busy = status === "loading" || status === "success";

  if (inverted) {
    return (
      <div className="w-full max-w-lg">
        {step === "email" ? (
          <form onSubmit={onEmailSubmit} className="flex flex-col gap-2.5 sm:flex-row">
            <label htmlFor={`${uid}-email`} className="sr-only">
              Work email
            </label>
            <input
              id={`${uid}-email`}
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                resetFeedback();
              }}
              placeholder="you@yourfirm.com"
              className="h-[3.25rem] flex-1 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm
                         font-medium text-white outline-none transition placeholder:text-carbon-400
                         focus:border-brand-400 focus:ring-4 focus:ring-brand-500/20 disabled:opacity-60"
            />
            <motion.button
              type="submit"
              whileHover={{ opacity: 0.88 }}
              transition={{ duration: 0.15, ease: EASE }}
              className="h-[3.25rem] min-w-[11rem] rounded-full bg-white px-7 text-sm font-medium text-carbon-900
                         transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            >
              Request a demo
            </motion.button>
          </form>
        ) : (
          <form onSubmit={onDetailsSubmit} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs text-carbon-400">
              <span>{email}</span>
              {!busy && (
                <button
                  type="button"
                  onClick={editEmail}
                  className="rounded text-carbon-300 underline decoration-white/25 underline-offset-2 hover:text-white"
                >
                  Edit
                </button>
              )}
            </div>
            <label htmlFor={`${uid}-firm`} className="sr-only">
              Firm name
            </label>
            <input
              id={`${uid}-firm`}
              type="text"
              required
              value={firmName}
              disabled={busy}
              onChange={(event) => {
                setFirmName(event.target.value);
                resetFeedback();
              }}
              placeholder="Firm / company name"
              className="h-[3.25rem] rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm
                         font-medium text-white outline-none transition placeholder:text-carbon-400
                         focus:border-brand-400 focus:ring-4 focus:ring-brand-500/20 disabled:opacity-60"
            />
            <label htmlFor={`${uid}-contact`} className="sr-only">
              Your name
            </label>
            <input
              id={`${uid}-contact`}
              type="text"
              required
              value={contactName}
              disabled={busy}
              onChange={(event) => {
                setContactName(event.target.value);
                resetFeedback();
              }}
              placeholder="Your name"
              className="h-[3.25rem] rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm
                         font-medium text-white outline-none transition placeholder:text-carbon-400
                         focus:border-brand-400 focus:ring-4 focus:ring-brand-500/20 disabled:opacity-60"
            />
            <motion.button
              type="submit"
              disabled={busy}
              whileHover={busy ? undefined : { opacity: 0.88 }}
              transition={{ duration: 0.15, ease: EASE }}
              className="h-[3.25rem] rounded-full bg-white px-7 text-sm font-medium text-carbon-900
                         transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === "loading" ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Sending
                </span>
              ) : status === "success" ? (
                "Request received"
              ) : (
                "Send request"
              )}
            </motion.button>
          </form>
        )}

        <AnimatePresence mode="wait">
          <motion.p
            key={message || "hint"}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={
              message
                ? `mt-3.5 text-sm font-medium ${
                    status === "success" ? "text-verify-300" : "text-red-300"
                  }`
                : "mt-3.5 text-xs text-carbon-400"
            }
            role={status === "error" ? "alert" : undefined}
          >
            {message ||
              "No spam, no card."}
          </motion.p>
        </AnimatePresence>
      </div>
    );
  }

  const fieldClass = `h-[3.25rem] rounded-full border px-5 text-sm font-medium outline-none transition disabled:opacity-60 ${
    onDark
      ? "border-hairline bg-black/[0.03] text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
      : "border-graphite-300 bg-white text-graphite-900 placeholder:text-graphite-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12"
  }`;
  const buttonClass = `h-[3.25rem] rounded-full px-7 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
    onDark ? "bg-indigo-500 text-white" : "bg-brand-600 text-white shadow-brandGlow hover:bg-brand-700"
  }`;

  return (
    <div className="w-full max-w-lg">
      {step === "email" && hero ? (
        <form
          onSubmit={onEmailSubmit}
          className="flex items-center gap-1.5 rounded-full border border-graphite-300 bg-white/85 p-1.5
                     shadow-[0_18px_40px_-28px_rgba(14,16,19,0.45)] backdrop-blur transition
                     focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/12"
        >
          <label htmlFor={`${uid}-email`} className="sr-only">
            Work email
          </label>
          <input
            id={`${uid}-email`}
            type="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              resetFeedback();
            }}
            placeholder="you@yourfirm.com"
            className="h-11 min-w-0 flex-1 bg-transparent pl-4 text-sm font-medium text-graphite-900
                       outline-none placeholder:text-graphite-400"
          />
          <motion.button
            type="submit"
            whileHover={{ opacity: 0.86 }}
            transition={{ duration: 0.15, ease: EASE }}
            className="h-11 flex-none rounded-full bg-carbon-900 px-5 text-sm font-medium text-white sm:px-6"
          >
            Request a demo
          </motion.button>
        </form>
      ) : step === "email" ? (
        <form onSubmit={onEmailSubmit} className="flex flex-col gap-2.5 sm:flex-row">
          <label htmlFor={`${uid}-email`} className="sr-only">
            Work email
          </label>
          <input
            id={`${uid}-email`}
            type="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              resetFeedback();
            }}
            placeholder="you@yourfirm.com"
            className={`flex-1 ${fieldClass}`}
          />
          <motion.button
            type="submit"
            whileHover={{ opacity: 0.82 }}
            transition={{ duration: 0.15, ease: EASE }}
            className={`min-w-[11rem] ${buttonClass}`}
          >
            Request a Demo
          </motion.button>
        </form>
      ) : (
        <form onSubmit={onDetailsSubmit} className="flex flex-col gap-2.5">
          <div className={`flex items-center justify-between text-xs ${onDark ? "text-zinc-500" : "text-graphite-400"}`}>
            <span>{email}</span>
            {!busy && (
              <button type="button" onClick={editEmail} className="underline underline-offset-2 hover:opacity-80">
                Edit
              </button>
            )}
          </div>
          <label htmlFor={`${uid}-firm`} className="sr-only">
            Firm name
          </label>
          <input
            id={`${uid}-firm`}
            type="text"
            required
            value={firmName}
            disabled={busy}
            onChange={(event) => {
              setFirmName(event.target.value);
              resetFeedback();
            }}
            placeholder="Firm / company name"
            className={fieldClass}
          />
          <label htmlFor={`${uid}-contact`} className="sr-only">
            Your name
          </label>
          <input
            id={`${uid}-contact`}
            type="text"
            required
            value={contactName}
            disabled={busy}
            onChange={(event) => {
              setContactName(event.target.value);
              resetFeedback();
            }}
            placeholder="Your name"
            className={fieldClass}
          />
          <motion.button
            type="submit"
            disabled={busy}
            whileHover={busy ? undefined : { opacity: 0.82 }}
            transition={{ duration: 0.15, ease: EASE }}
            className={buttonClass}
          >
            {status === "loading" ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-white" />
                Sending
              </span>
            ) : status === "success" ? (
              "Request received"
            ) : (
              "Send request"
            )}
          </motion.button>
        </form>
      )}

      <AnimatePresence mode="wait">
        {message ? (
          <motion.p
            key={message}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={`mt-3 text-sm font-medium ${
              status === "success"
                ? onDark
                  ? "text-verify-700"
                  : "text-verify-600"
                : onDark
                  ? "text-red-600"
                  : "text-rose-600"
            }`}
          >
            {message}
          </motion.p>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`mt-3 text-xs ${onDark ? "text-zinc-600" : "text-graphite-400"}`}
          >
            No spam, no card.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DemoRequestForm;
