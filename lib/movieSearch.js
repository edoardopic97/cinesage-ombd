const axios = require("axios");
const { invokeLLM } = require("./llm");

const OMDB_API_KEY = process.env.OMDB_API_KEY;

async function identifyMoviesFromQuery(userQuery, category) {
  const mediaType = category === "tv" ? "TV shows" : category === "movie" ? "movies" : "movies or TV shows";

  const systemPrompt = `You are a movie and TV expert with encyclopedic knowledge. Given a user's query, return the most accurate matching ${mediaType}.

Return JSON with an array of results (up to 20):
{
  "movies": [
    {"title": "Movie Title", "year": 2019, "type": "movie"},
    {"title": "TV Show Title", "year": 2020, "type": "series"}
  ]
}

CRITICAL RULES:
- ALWAYS return results. Never return an empty array.
- Be FACTUALLY ACCURATE for awards, nominees, or official lists — only return titles that genuinely belong. Do NOT guess.
- For ranking, rating, or "top/best" queries, return popular, well-reviewed titles. Treat these as recommendation requests, NOT as requests for a verified ranked list.
- If you are unsure whether a title belongs to a specific official list, OMIT it rather than risk being wrong.
- Use exact official titles as they appear on IMDb.
- ALWAYS include the release year.
- ALWAYS specify "type" as either "movie" or "series".
- If user asks for movies, only return type "movie".
- If user asks for TV shows, only return type "series".
- For mood/vibe queries, focus on popular and critically acclaimed matches.
- Return ONLY the JSON, no extra text.`;

  const content = await invokeLLM(systemPrompt, userQuery);

  let clean = content.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
  }
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) clean = jsonMatch[0];
  clean = clean.replace(/,\s*([}\]])/g, "$1");

  const parsed = JSON.parse(clean);
  return { movies: parsed.movies || [], llmRaw: content };
}

async function searchOMDB(title, year, type) {
  if (!OMDB_API_KEY) throw new Error("OMDB API key not configured");

  const params = { apikey: OMDB_API_KEY, t: title };
  if (year) params.y = year;
  if (type) params.type = type;

  const res = await axios.get("http://www.omdbapi.com/", { params });
  return res.data.Response === "True" ? res.data : null;
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

  const final = results.filter(Boolean).slice(0, 20);
  return {
    movies: final,
    debug: { llmRaw, llmCount: identified.length, omdbLog },
  };
}

module.exports = { findMoviesFromQuery };
