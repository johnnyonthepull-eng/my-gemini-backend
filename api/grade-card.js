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

    const promptText = `CRITICAL INSTRUCTIONS: You are an elite TCG card authenticator and professional grader for PSA, BGS, and ACE. You MUST analyze the attached front and back card images thoroughly. Do NOT return blank values, dashes, placeholders, or generic text. Every single field below must be populated with specific, accurate data derived directly from the card.

For all visual diagnostic border fields (top, bottom, left, right), you MUST estimate the physical border width in millimeters (mm) (e.g., "1.5 mm", "2.0 mm") assuming standard trading card dimensions (\(63 \times 88\text{ mm}\)).

Return ONLY a valid JSON object matching this exact structure:
{
  "cardName": "Exact character name or title of the card",
  "setName": "Exact name of the expansion set",
  "cardNumber": "Card number / set code (e.g. 025/198)",
  "rarity": "Rarity tier (e.g. Illustration Rare, Holofoil, Secret Rare)",
  "language": "Language of the card (e.g. English, Japanese, Simplified Chinese)",
  "variant": "Finish variant (e.g. Holofoil, Reverse Holo, Normal, Poké Ball Holo)",
  "confidence": "High",
  "psaGrade": "Estimated PSA Grade (e.g. PSA 9 or PSA 10)",
  "psaLabel": "Detailed breakdown of condition justifying the PSA estimate",
  "bgsGrade": "Estimated BGS Grade (e.g. 9.5 or 9)",
  "bgsSubgrades": "C: 9.5 | Cr: 9.5 | E: 9.5 | S: 9.0",
  "aceGrade": "Estimated ACE Grade (e.g. 10)",
  "aceLabel": "Detailed breakdown of condition justifying the ACE estimate",
  "recGrade": "PSA",
  "recLabel": "Rationale for why this grading house is optimal",
  "conditionSummary": "Comprehensive professional summary of the card's overall condition, centering, and eye appeal.",
  "frontTop": "e.g. 1.8 mm",
  "frontBottom": "e.g. 2.2 mm",
  "frontLeft": "e.g. 2.0 mm",
  "frontRight": "e.g. 2.0 mm",
  "frontRatio": "e.g. 48/52",
  "backTop": "e.g. 2.0 mm",
  "backBottom": "e.g. 2.0 mm",
  "backLeft": "e.g. 1.5 mm",
  "backRight": "e.g. 2.5 mm",
  "backRatio": "e.g. 40/60",
  "cornerFlaws": "Detailed description of all 4 corners (e.g. Clean, minor whitening on bottom-left rear)",
  "edgeFlaws": "Detailed description of edge condition (e.g. Clean front edges, minor silvering on rear top edge)",
  "surfaceFlaws": "Detailed description of surface condition (e.g. Clean gloss, no scratches or print lines)"
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
        ]
      })
    });

    const responseText = await geminiResponse.text();

    if (!geminiResponse.ok) {
      console.error("Gemini API rejected request:", responseText);
      const statusCode = geminiResponse.status;
      return res.status(502).json({ error: "Google API Failed with code " + statusCode + ": " + responseText });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      return res.status(500).json({ error: "Failed to parse JSON response from Gemini." });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(500).json({ error: "No text generated from the Gemini model." });
    }

    const cleanJsonString = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedCardData = JSON.parse(cleanJsonString);

    return res.status(200).json(parsedCardData);

  } catch (error) {
    console.error("Server catch error:", error);
    return res.status(500).json({ error: error.message || "Internal server crash." });
  }
}
