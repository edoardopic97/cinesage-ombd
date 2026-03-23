const { db } = require("../../lib/firebase");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Simple secret to prevent accidental runs
  if (req.body?.secret !== "migrate-ratings-2025") {
    return res.status(403).json({ error: "Invalid secret" });
  }

  try {
    const usersSnap = await db.collection("users").get();
    let totalMigrated = 0;
    let usersProcessed = 0;

    for (const userDoc of usersSnap.docs) {
      const moviesSnap = await db.collection("users").doc(userDoc.id).collection("movies").get();
      const ops = [];
      moviesSnap.forEach(d => {
        const rating = d.data().rating;
        if (rating && rating > 0 && rating <= 5) {
          ops.push(d.ref.update({ rating: rating * 2 }));
        }
      });
      if (ops.length > 0) {
        await Promise.all(ops);
        totalMigrated += ops.length;
      }
      usersProcessed++;
    }

    res.status(200).json({ success: true, usersProcessed, totalMigrated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
