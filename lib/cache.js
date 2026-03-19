const cache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCachedResults(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.results;
}

function setCachedResults(key, results) {
  cache.set(key, { results, timestamp: Date.now() });
}

function clearCache() {
  cache.clear();
}

module.exports = { getCachedResults, setCachedResults, clearCache };
