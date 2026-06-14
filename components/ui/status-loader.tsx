export function StatusLoader() {
  return (
    <div className="status-loader" aria-label="Processing…" role="status">
      <div className="status-loader__circle" />
      <div className="status-loader__circle" />
      <div className="status-loader__circle" />
      <div className="status-loader__shadow" />
      <div className="status-loader__shadow" />
      <div className="status-loader__shadow" />
    </div>
  );
}
