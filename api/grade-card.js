export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { frontImage, backImage } = req.body || {};

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Missing frontImage or backImage payload." });
    }

    const cleanBase64 = (dataUrl) => {
      if (typeof dataUrl !== 'string') return '';
      if (dataUrl.includes(",")) {
        return dataUrl.split(",")[1].trim();
      }
      return dataUrl.trim();
    };

    const frontBase64Data = cleanBase64(frontImage);
    const backBase64Data = cleanBase64(backImage);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY is missing." });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const promptText = `You are a master TCG authenticator and professional grading director for PSA, BGS, and ACE. 
Carefully examine the provided front and back images of THIS specific trading card. Do not use placeholders or generic text. Extract and evaluate the actual card shown in the images.

MANDATORY INSTRUCTIONS:
1. Identify the exact card name, expansion set, card number, rarity, language, and finish variant visible in the images.
2. Provide realistic estimated grades for PSA, BGS, and ACE based on the visible condition, whitening, centering, and surface wear of THIS specific card.
3. For visual diagnostics, estimate the physical border widths in millimeters (mm) to one decimal place (e.g., "1.8 mm") for top, bottom, left, and right of both front and back images.
4. Provide comprehensive custom write-ups for condition summaries, corner flaws, edge flaws, and surface flaws based on what is physically observed. Never use dashes ("—") or blank spaces.

Return ONLY a valid JSON object matching this exact key structure:
{
  "cardName": "Exact character name or title visible on the card",
  "setName": "Exact name of the expansion set",
  "cardNumber": "Exact card number / set code (e.g. 025/198)",
  "rarity": "Exact rarity tier",
  "language": "Detected language (e.g. English, Japanese)",
  "variant": "Finish variant (e.g. Holofoil, Reverse Holo, Normal)",
  "confidence": "High",
  "psaGrade": "Estimated PSA Grade (e.g. PSA 9 or PSA 10)",
  "psaLabel": "Specific condition breakdown for PSA",
  "bgsGrade": "Estimated BGS Grade (e.g. 9.5)",
  "bgsSubgrades": "C: 9.5 | Cr: 9.0 | E: 9.5 | S: 9.0",
  "aceGrade": "Estimated ACE Grade (e.g. 10)",
  "aceLabel": "Specific condition breakdown for ACE",
  "recGrade": "PSA",
  "recLabel": "Specific recommendation rationale for this card",
  "conditionSummary": "Detailed custom paragraph summarizing this specific card's overall condition and eye appeal.",
  "frontTop": "1.8 mm",
  "frontBottom": "2.0 mm",
  "frontLeft": "1.9 mm",
  "frontRight": "1.9 mm",
  "frontRatio": "50/50",
  "backTop": "2.1 mm",
  "backBottom": "1.9 mm",
  "backLeft": "1.5 mm",
  "backRight": "2.5 mm",
  "backRatio": "45/55",
  "cornerFlaws": "Custom description of all 4 corners observed on this card",
  "edgeFlaws": "Custom description of front and back edges observed on this card",
  "surfaceFlaws": "Custom description of surface gloss, scratches, or print lines observed on this card"
}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: frontBase64Data
                }
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: backBase64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1
        }
      })
    });

    const responseText = await geminiResponse.text();

    if (!geminiResponse.ok) {
      console.error("Gemini API rejected request:", responseText);
      return res.status(502).json({ error: "Google API Failed: " + responseText });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      return res.status(500).json({ error: "Failed to parse JSON response envelope from Gemini." });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(500).json({ error: "No text generated from the Gemini model." });
    }

    const cleanJsonString = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    let parsedCardData;
    
    try {
      parsedCardData = JSON.parse(cleanJsonString);
    } catch (err) {
      console.error("JSON parse error on model text:", cleanJsonString);
      return res.status(500).json({ error: "Model failed to output clean JSON structure." });
    }

    return res.status(200).json(parsedCardData);

  } catch (error) {
    console.error("Server catch error:", error);
    return res.status(500).json({ error: error.message || "Internal server crash." });
  }
}
