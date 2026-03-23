const axios = require("axios");
const { verifyAuth } = require("../../lib/auth");

const OMDB_API_KEY = process.env.OMDB_API_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { s } = req.query;
  if (!s) return res.status(400).json({ error: "Missing search query" });

  try {
    const r = await axios.get("http://www.omdbapi.com/", {
      params: { apikey: OMDB_API_KEY, s },
    });
    res.status(200).json(r.data);
  } catch (err) {
    res.status(500).json({ error: "OMDB request failed" });
  }
};
