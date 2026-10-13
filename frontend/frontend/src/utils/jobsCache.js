const PREFIX = "jobMatches:";
export const FRESH_MS = 5 * 60 * 1000; // treat as fresh for 5 minutes

export function readJobsCache(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null; // { jobs, at }
  } catch {
    return null;
  }
}

export function writeJobsCache(key, jobs) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ jobs, at: Date.now() }));
  } catch {
    /* storage full or blocked: just skip caching */
  }
}

export function clearJobsCache() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
