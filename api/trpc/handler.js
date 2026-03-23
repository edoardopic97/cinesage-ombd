const { findMoviesFromQuery, directTitleSearch } = require("../../lib/movieSearch");
const { getCachedResults, setCachedResults } = require("../../lib/cache");

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const input = req.body?.json || req.body;
    const query = input?.query;
    const category = input?.category || "all";
    const uid = input?.uid || null;
    const aiMode = input?.aiMode === true || input?.aiMode === 'true';

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({
        error: { message: "Query is required" },
      });
    }

    // Check Firestore cache (include aiMode in cache key)
    const cacheKey = aiMode ? query : `title:${query}`;
    const cached = await getCachedResults(cacheKey, category);
    if (cached) {
      return res.status(200).json({
        result: {
          data: {
            json: {
              success: true,
              movies: cached,
              count: cached.length,
              cached: true,
            },
          },
        },
      });
    }

    const movies = aiMode
      ? await findMoviesFromQuery(query.trim(), category)
      : await directTitleSearch(query.trim(), category);
    if (movies.length > 0) setCachedResults(cacheKey, category, movies, uid);

    return res.status(200).json({
      result: {
        data: {
          json: {
            success: true,
            movies,
            count: movies.length,
            cached: false,
          },
        },
      },
    });
  } catch (err) {
    console.error("[API] Search error:", err);
    return res.status(500).json({
      error: { message: err.message || "Search failed" },
    });
  }
};
