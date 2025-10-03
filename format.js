// utils/format.js
function msToTime(ms) {
  if (!ms || ms < 0) ms = 0;
  const sec = Math.floor((ms / 1000) % 60);
  const min = Math.floor((ms / (1000 * 60)) % 60);
  const hrs = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hrs) parts.push(`${hrs}h`);
  if (min) parts.push(`${min}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}
function niceTimestamp(d) {
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
}
module.exports = { msToTime, niceTimestamp };
