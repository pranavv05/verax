import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center overflow-hidden">
    {/* Background Orbs */}
    <div className="absolute top-1/4 left-1/4 h-48 w-48 rounded-full bg-mint-500/10 blur-[80px] animate-float" />
    <div className="absolute bottom-1/4 right-1/4 h-40 w-40 rounded-full bg-indigo-500/10 blur-[60px] animate-float-delayed" />

    {/* 404 Visual */}
    <div className="relative mb-6">
      <div className="text-[120px] font-extrabold leading-none text-ink-900/5 sm:text-[160px]">
        404
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 p-4 text-white shadow-elevated">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
      </div>
    </div>

    <p className="text-xs font-bold uppercase tracking-[0.25em] text-mint-500">Page Not Found</p>
    <h1 className="mt-3 text-3xl font-extrabold text-ink-900 sm:text-4xl">
      Oops! This page doesn't exist
    </h1>
    <p className="mt-3 max-w-md text-sm text-ink-500">
      The page you're looking for might have been moved or doesn't exist in this workspace.
    </p>
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Link to="/dashboard" className="btn-primary px-6 py-2.5">
        Go to Dashboard
      </Link>
      <Link to="/" className="btn-secondary px-6 py-2.5">
        Back to Home
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
