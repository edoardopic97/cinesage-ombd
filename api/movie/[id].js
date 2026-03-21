const axios = require("axios");

const OMDB_API_KEY = process.env.OMDB_API_KEY;

module.exports = async (req, res) => {
  const { id } = req.query;
  if (!id || !id.startsWith("tt")) {
    res.status(400).send("Invalid movie ID");
    return;
  }

  let movie = null;
  try {
    const r = await axios.get("http://www.omdbapi.com/", {
      params: { apikey: OMDB_API_KEY, i: id },
    });
    if (r.data.Response === "True") movie = r.data;
  } catch {}

  const title = movie?.Title || "Movie";
  const year = movie?.Year || "";
  const poster = movie?.Poster && movie.Poster !== "N/A" ? movie.Poster : "";
  const rating = movie?.imdbRating && movie.imdbRating !== "N/A" ? movie.imdbRating : "";
  const genre = movie?.Genre && movie.Genre !== "N/A" ? movie.Genre : "";
  const plot = movie?.Plot && movie.Plot !== "N/A" ? movie.Plot : "";
  const runtime = movie?.Runtime && movie.Runtime !== "N/A" ? movie.Runtime : "";
  const director = movie?.Director && movie.Director !== "N/A" ? movie.Director : "";
  const deepLink = `cinesage://movie/${id}`;
  const ogDesc = plot || `${genre}${year ? ` • ${year}` : ""}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}${year ? ` (${year})` : ""} — CineSage</title>
  <meta property="og:title" content="${title}${year ? ` (${year})` : ""}"/>
  <meta property="og:description" content="${ogDesc}"/>
  ${poster ? `<meta property="og:image" content="${poster}"/>` : ""}
  <meta property="og:type" content="website"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0d0204;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{max-width:420px;width:90%;text-align:center;padding:32px 24px}
    .poster{width:200px;height:300px;object-fit:cover;border-radius:12px;margin:0 auto 24px;display:block;box-shadow:0 8px 40px rgba(200,30,30,0.3)}
    .no-poster{width:200px;height:300px;border-radius:12px;margin:0 auto 24px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:48px;color:rgba(255,255,255,0.15)}
    h1{font-size:24px;font-weight:800;margin-bottom:6px}
    .meta{color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:16px}
    .rating{display:inline-flex;align-items:center;gap:4px;background:rgba(245,197,24,0.12);border:1px solid rgba(245,197,24,0.3);border-radius:20px;padding:4px 12px;font-size:14px;font-weight:700;color:#f5c518;margin-bottom:16px}
    .plot{color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin-bottom:24px}
    .open-btn{display:inline-block;background:linear-gradient(135deg,#c0392b,#e74c3c);color:#fff;font-size:16px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:12px;box-shadow:0 4px 20px rgba(200,40,40,0.4)}
    .store{color:rgba(255,255,255,0.35);font-size:13px;margin-top:8px}
    .logo{font-size:13px;color:rgba(255,255,255,0.25);margin-top:32px;letter-spacing:1px}
    .imdb{color:#f5c518;text-decoration:none;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:4px;margin-top:12px}
  </style>
</head>
<body>
  <div class="card">
    ${poster ? `<img class="poster" src="${poster}" alt="${title}"/>` : `<div class="no-poster">🎬</div>`}
    <h1>${title}</h1>
    <div class="meta">${[year, genre, runtime, director].filter(Boolean).join(" · ")}</div>
    ${rating ? `<div class="rating">⭐ ${rating} IMDb</div>` : ""}
    ${plot ? `<p class="plot">${plot}</p>` : ""}
    <a class="open-btn" href="${deepLink}" id="openApp">Open in CineSage</a>
    <p class="store">Coming soon to the Play Store & App Store</p>
    <a class="imdb" href="https://www.imdb.com/title/${id}" target="_blank">View on IMDb →</a>
    <div class="logo">CINESAGE</div>
  </div>
  <script>
    // Try deep link, if it fails the user stays on this page
    setTimeout(function(){ window.location.href="${deepLink}"; }, 100);
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
};
