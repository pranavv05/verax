const EmptyState = ({ title, description, action }) => (
  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#d9c9a8] bg-sand-50/40 p-8 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-ink-900/5 to-ink-900/10 text-ink-500">
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    </div>
    <h3 className="text-lg font-bold text-ink-900">{title}</h3>
    <p className="max-w-sm text-sm text-ink-500">{description}</p>
    {action || null}
  </div>
);

export default EmptyState;
