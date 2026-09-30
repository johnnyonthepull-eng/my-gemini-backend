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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server configuration error: GEMINI_API_KEY is missing." });
    }

    const cleanBase64 = (dataUrl) => {
      if (typeof dataUrl !== 'string') return '';
      const parts = dataUrl.split(",");
      return parts.length > 1 ? parts[1] : dataUrl;
    };

    const frontBase64Data = cleanBase64(frontImage);
    const backBase64Data = cleanBase64(backImage);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const promptText = `You are a master TCG authenticator and professional grading director for PSA, BGS, and ACE. Analyze the uploaded front and back images of THIS specific trading card. Do not generalize. Extract exact details.

MANDATORY RULES:
1. Identify the exact card name, expansion set, card number, rarity, language, and finish variant visible in the images.
2. Perform a strict condition audit. Provide realistic estimated grades for PSA, BGS, and ACE based on visible wear.
3. For visual diagnostics, estimate the physical border widths in millimeters (mm) to one decimal place (e.g., "1.8 mm", "2.2 mm") for the top, bottom, left, and right of both the front and back images, assuming standard trading card dimensions (63x88mm).
4. NEVER return dashes ("—"), empty strings, or placeholders. Every property must contain a precise, custom description generated specifically for this card.

Return ONLY a valid JSON object matching this exact key structure:
{
  "cardName": "Exact name of this specific card",
  "setName": "Exact expansion set name",
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
  "frontTop": "e.g. 1.8 mm",
  "frontBottom": "e.g. 2.0 mm",
  "frontLeft": "e.g. 1.9 mm",
  "frontRight": "e.g. 1.9 mm",
  "frontRatio": "e.g. 50/50",
  "backTop": "e.g. 2.1 mm",
  "backBottom": "e.g. 1.9 mm",
  "backLeft": "e.g. 1.5 mm",
  "backRight": "e.g. 2.5 mm",
  "backRatio": "e.g. 45/55",
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
              { inlineData: { mimeType: "image/jpeg", data: frontBase64Data } },
              { inlineData: { mimeType: "image/jpeg", data: backBase64Data } }
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
