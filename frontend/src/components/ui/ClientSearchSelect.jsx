import { useEffect, useMemo, useRef, useState } from "react";

const ClientSearchSelect = ({ clients, value, onChange, placeholder = "Search client...", disabled = false }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === value) || null,
    [clients, value]
  );

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => (client.name || "").toLowerCase().includes(q));
  }, [clients, query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, open]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectClient = (client) => {
    onChange(client.id);
    setQuery("");
    setOpen(false);
  };

  const clearSelection = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filteredClients.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const client = filteredClients[highlightIndex];
      if (client) selectClient(client);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  if (selectedClient) {
    return (
      <div className="field flex items-center justify-between gap-2">
        <span className="truncate text-ink-900">{selectedClient.name}</span>
        <button
          type="button"
          aria-label="Clear selected client"
          className="text-ink-400 hover:text-ink-700"
          onClick={clearSelection}
          disabled={disabled}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        className="field"
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[#e4d8c4] bg-white shadow-lg">
          {filteredClients.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[#6f8097]">No clients found.</p>
          ) : (
            filteredClients.map((client, index) => (
              <button
                key={client.id}
                type="button"
                className={`block w-full truncate px-3 py-2 text-left text-sm ${
                  index === highlightIndex ? "bg-sand-100 text-ink-900" : "text-ink-700 hover:bg-sand-50"
                }`}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => selectClient(client)}
              >
                {client.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ClientSearchSelect;
