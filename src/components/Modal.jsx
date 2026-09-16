export function Modal({ title, onClose, children, footer }) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose ? onClose : undefined}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          {onClose ? (
            <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
              Close
            </button>
          ) : (
            <span className="badge warn">In progress</span>
          )}
        </header>
        <div>{children}</div>
        {footer ? <div style={{ marginTop: "1rem" }}>{footer}</div> : null}
      </div>
    </div>
  );
}
