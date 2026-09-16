export function Spinner({ label = "Loading…" }) {
  return (
    <div className="empty">
      <div className="spinner" aria-hidden />
      <p>{label}</p>
    </div>
  );
}
