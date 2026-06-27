/** Format a millisecond playtime as `H:MM:SS`, matching the in-game display. */
export function formatPlaytime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}
