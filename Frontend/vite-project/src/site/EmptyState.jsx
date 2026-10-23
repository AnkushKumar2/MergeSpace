/** Friendly placeholder for lists with nothing in them yet. */
export default function EmptyState({ icon = "◇", title, text, actionLabel, onAction }) {
  return <div className="empty-state">
    <span className="empty-state-icon" aria-hidden="true">{icon}</span>
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {actionLabel && <button type="button" className="primary-button" onClick={onAction}>{actionLabel}</button>}
  </div>
}
