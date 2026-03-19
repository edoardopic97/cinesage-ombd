const axios = require("axios");
const { invokeLLM } = require("./llm");

const OMDB_API_KEY = process.env.OMDB_API_KEY;

const KNOWLEDGE_CUTOFF_YEAR = parseInt(process.env.KNOWLEDGE_CUTOFF_YEAR || "2024", 10);

function needsSearch(query) {
  const yearMatch = query.match(/\b(19|20)\d{2}\b/g);
  if (yearMatch && yearMatch.some(y => parseInt(y, 10) > KNOWLEDGE_CUTOFF_YEAR)) return true;
  return /\b(latest|recent|new|current|this year|now playing)\b/i.test(query);
}

async function identifyMoviesFromQuery(userQuery, category) {
  const mediaType = category === "tv" ? "TV shows" : category === "movie" ? "movies" : "movies or TV shows";

  const systemPrompt = `You are a movie and TV expert. Given a user's query, return the most accurate matching ${mediaType}.

Return JSON with an array of results (up to 20):
{
  "movies": [
    {"title": "Movie Title", "year": 2019, "type": "movie"},
    {"title": "TV Show Title", "year": 2020, "type": "series"}
  ]
}

CRITICAL RULES:
- ALWAYS return results. Never return an empty array.
- Use exact official titles as they appear on IMDb.
- ALWAYS include the release year.
- ALWAYS specify "type" as either "movie" or "series".

GROUNDING RULES (VERY IMPORTANT):
- If external search/grounding data is available, you MUST rely on it as the primary source of truth.
- Prefer real, current data (ratings, rankings, critic scores) over assumptions.
- Do NOT invent rankings or approximate if grounded data provides clear answers.

RANKING / "TOP" QUERIES:
- If the query involves "top", "best", or "ranked":
  → Use grounded data such as IMDb ratings, critic scores, or reputable rankings when available.
  → Return results ordered by actual quality signals (highest first).

FUTURE YEAR HANDLING:
- If the query refers to a future year AND no grounded ranking data exists:
  → Return only high-quality, credible films expected for that year.
  → Base selection on director reputation, franchise quality, and early critical signals.
  → DO NOT treat this as "most anticipated" unless explicitly asked.

QUALITY FILTER:
- Exclude low-rated, poorly reviewed, or controversial films when better options exist.
- Do NOT include titles unless there is strong evidence they belong.

TYPE FILTER:
- If user asks for movies → ONLY return "movie"
- If user asks for TV shows → ONLY return "series"

OUTPUT RULES:
- Return ONLY the JSON, no explanation.`;

  const useSearch = needsSearch(userQuery);
  let content = await invokeLLM(systemPrompt, userQuery, { useSearch });

  let clean = content.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
  }
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) clean = jsonMatch[0];
  clean = clean.replace(/,\s*([}\]])/g, "$1");

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // If search response isn't valid JSON, retry without search
    if (useSearch) {
      content = await invokeLLM(systemPrompt, userQuery, { useSearch: false });
      clean = content.trim();
      if (clean.startsWith("```")) {
        clean = clean.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
      }
      const retry = clean.match(/\{[\s\S]*\}/);
      if (retry) clean = retry[0];
      clean = clean.replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(clean);
    } else {
      throw new Error("Failed to parse LLM response as JSON");
    }
  }
  return { movies: parsed.movies || [], llmRaw: content };
}

async function searchOMDB(title, year, type) {
  if (!OMDB_API_KEY) throw new Error("OMDB API key not configured");

  // Try exact match first
  const params = { apikey: OMDB_API_KEY, t: title };
  if (year) params.y = year;
  if (type) params.type = type;

  const res = await axios.get("http://www.omdbapi.com/", { params });
  if (res.data.Response === "True") return res.data;

  // Fallback: search by name and pick best match
  const searchParams = { apikey: OMDB_API_KEY, s: title };
  if (type) searchParams.type = type;

  const searchRes = await axios.get("http://www.omdbapi.com/", { params: searchParams });
  if (searchRes.data.Response !== "True" || !searchRes.data.Search?.length) return null;

  const match = searchRes.data.Search[0];
  const fullRes = await axios.get("http://www.omdbapi.com/", { params: { apikey: OMDB_API_KEY, i: match.imdbID } });
  return fullRes.data.Response === "True" ? fullRes.data : null;
}

async function findMoviesFromQuery(userQuery, category = "all") {
  const { movies: identified, llmRaw } = await identifyMoviesFromQuery(userQuery, category);
  const omdbLog = [];

  const results = await Promise.all(
    identified.map(async ({ title, year, type }) => {
      try {
        const result = await searchOMDB(title, year, type);
        omdbLog.push({ title, year, type, found: !!result, omdbType: result?.Type || null });
        if (result && result.Type === type) {
          let poster = result.Poster && result.Poster !== "N/A"
            ? result.Poster
            : result.imdbID
              ? `https://img.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${result.imdbID}`
              : "N/A";
          return {
            Title: result.Title,
            Year: result.Year,
            Poster: poster,
            Genre: result.Genre,
            Plot: result.Plot,
            imdbRating: result.imdbRating,
            Runtime: result.Runtime,
            Country: result.Country,
            Type: result.Type,
            Director: result.Director,
            Actors: result.Actors,
            Language: result.Language,
            Awards: result.Awards !== "N/A" ? result.Awards : undefined,
            imdbID: result.imdbID,
            Rated: result.Rated !== "N/A" ? result.Rated : undefined,
            Ratings: result.Ratings,
          };
        }
      } catch (err) {
        console.error(`[MovieSearch] Error fetching ${title}:`, err.message);
      }
      return null;
    })
  );

  const final = results.filter(Boolean).sort((a, b) => parseFloat(b.imdbRating || 0) - parseFloat(a.imdbRating || 0)).slice(0, 20);
  return {
    movies: final,
    debug: { llmRaw, llmCount: identified.length, omdbLog },
  };
}

module.exports = { findMoviesFromQuery };
