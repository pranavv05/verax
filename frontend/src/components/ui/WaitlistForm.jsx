import { useState } from "react";
import { waitlistApi } from "../../api/waitlist-api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WaitlistForm = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!EMAIL_PATTERN.test(email.trim())) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const data = await waitlistApi.join({ email });
      setStatus("success");
      setMessage(data.message || "You've been added to the waitlist!");
      setEmail("");
    } catch (error) {
      console.error("Waitlist submission error:", error);
      setStatus("error");
      setMessage(error.data?.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="field h-12 pr-4 pl-4"
              disabled={status === "loading" || status === "success"}
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="btn-accent h-12 px-8 min-w-[140px] flex items-center justify-center"
          >
            {status === "loading" ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : status === "success" ? (
              "Joined!"
            ) : (
              "Join Waitlist"
            )}
          </button>
        </div>

        {message && (
          <div className={`absolute -bottom-8 left-0 right-0 text-center text-sm font-medium animate-fade-in ${
            status === "success" ? "text-mint-600" : "text-rose-500"
          }`}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
};

export default WaitlistForm;
