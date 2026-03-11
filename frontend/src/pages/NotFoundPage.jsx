import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#72839a]">404</p>
    <h1 className="mt-2 text-3xl font-extrabold text-ink-900">Page not found</h1>
    <p className="mt-2 text-sm text-[#66778f]">The page you requested does not exist in this workspace.</p>
    <Link to="/dashboard" className="btn-primary mt-5">
      Go to dashboard
    </Link>
  </div>
);

export default NotFoundPage;
