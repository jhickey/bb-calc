/**
 * Marks a gem that lives in the Hunter's Dream storage (rather than carried), to
 * help locate it in-game.
 */
export function StorageIcon({ className = '' }: { className?: string }) {
  return (
    <img
      src="/misc/storage.png"
      alt="In storage"
      title="In storage — retrieve it from the Hunter's Dream storage"
      className={`h-4 w-4 shrink-0 object-contain ${className}`}
    />
  );
}
