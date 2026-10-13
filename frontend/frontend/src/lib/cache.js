// Tiny in-memory cache so pages can show their last data instantly, then refresh in the background.
// Keys must include the user's email so one account never sees another's data after a log-out/log-in.
const store = new Map();
export const cacheGet = (key) => store.get(key);
export const cacheSet = (key, value) => store.set(key, value);
// Remove every entry whose key ends with one of the given suffixes (e.g. ":profile").
export const cacheClearSuffix = (...suffixes) => {
  for (const k of [...store.keys()]) {
    if (suffixes.some((s) => k.endsWith(s))) store.delete(k);
  }
};
