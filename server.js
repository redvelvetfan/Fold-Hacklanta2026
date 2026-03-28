const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
console.log("API KEY LOADED:", process.env.GEMINI_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // serves your HTML/CSS/JS files

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

app.post("/api/reframe", async (req, res) => {
  const { intensity, trigger } = req.body;

  const prompt = `You are a compassionate CBT therapist helping someone in recovery from gambling addiction.

The user is experiencing a gambling urge with intensity ${intensity} out of 10.
Their trigger is: "${trigger}"

Respond with a warm, grounding 2-3 sentence CBT reframe to help them sit with this urge without acting on it.
Focus on cognitive reframing, not willpower. Be human, not clinical. Do not use bullet points or lists.`;

  try {
    console.log("Calling Gemini now...");
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    console.log("Gemini raw response:", JSON.stringify(data, null, 2));
    const reframe = data.candidates?.[0]?.content?.parts?.[0]?.text
      || "That urge is real, and so is your strength in pausing right now. Take three slow breaths — the urge will peak and pass, just like a wave.";

    res.json({ reframe });
  } catch (err) {
    console.error("Gemini error full details:", JSON.stringify(err, null, 2));
  console.error("Gemini error message:", err.message);
  res.status(500).json({ reframe: "That urge is real, and so is your strength in pausing right now. Take three slow breaths — the urge will peak and pass, just like a wave." });
  }
});

app.listen(3000, () => console.log("Fold server running at http://localhost:3000"));