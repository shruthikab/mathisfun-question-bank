const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
    return;
  }

  try {
    const { fileName, isImage, isPdf, content } = req.body || {};
    if (!fileName || !content) {
      res.status(400).json({ error: "Missing file payload." });
      return;
    }

    const userContent = isImage
      ? [
          { type: "input_text", text: `File name: ${fileName}` },
          { type: "input_image", image_url: content },
        ]
      : isPdf
      ? [
          { type: "input_text", text: `File name: ${fileName}` },
          { type: "input_file", file_data: content, filename: fileName },
        ]
      : [
          { type: "input_text", text: `File name: ${fileName}` },
          { type: "input_text", text: String(content) },
        ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Extract math questions from the uploaded paper. Return ONLY a JSON array. Each object must contain: question (required), and optionally paper, category, hint, answer, id.",
              },
            ],
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: errText.slice(0, 500) });
      return;
    }

    const json = await response.json();
    const output = String(json.output_text || "").trim();
    if (!output) {
      res.status(502).json({ error: "OpenAI returned empty output." });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch {
      const match = output.match(/\[[\s\S]*\]/);
      if (!match) {
        res.status(502).json({ error: "Could not parse JSON array from AI response." });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    if (!Array.isArray(parsed)) {
      res.status(502).json({ error: "AI output was not a JSON array." });
      return;
    }

    res.status(200).json({ questions: parsed });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

module.exports = router;
