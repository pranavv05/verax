const EmptyState = ({ title, description, action }) => (
  <div className="panel flex flex-col items-start gap-3 p-6">
    <h3 className="text-lg font-bold text-ink-900">{title}</h3>
    <p className="max-w-2xl text-sm text-[#67778d]">{description}</p>
    {action || null}
  </div>
);

export default EmptyState;
