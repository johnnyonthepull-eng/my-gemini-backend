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

    const promptText = `CRITICAL INSTRUCTIONS: Look closely at the attached front and back trading card images. You MUST extract real data. Do NOT return blank values, dashes, or placeholders. If you are unsure, make your best expert estimation.

Return ONLY a valid JSON object matching this exact structure:
{
  "cardName": "Name of the character or subject",
  "setName": "Name of the expansion set",
  "cardNumber": "Card number string (e.g. 025/198)",
  "rarity": "Rarity tier (e.g. Illustration Rare, Holofoil, Secret Rare)",
  "language": "Language (e.g. English, Japanese, Simplified Chinese)",
  "variant": "Finish variant (e.g. Holofoil, Reverse Holo, Normal, Master Ball)",
  "confidence": "High",
  "psaGrade": "Estimated PSA Grade (e.g. PSA 9 or PSA 10)",
  "psaLabel": "Brief note on PSA condition",
  "bgsGrade": "Estimated BGS Grade (e.g. 9.5)",
  "bgsSubgrades": "C: 9.5 | Cr: 9.5 | E: 9.5 | S: 9.5",
  "aceGrade": "Estimated ACE Grade (e.g. 10)",
  "aceLabel": "Brief note on ACE condition",
  "recGrade": "PSA",
  "recLabel": "Recommended grading house rationale",
  "conditionSummary": "Detailed description of overall condition based on front and back visuals.",
  "frontTop": "48%",
  "frontBottom": "52%",
  "frontLeft": "50%",
  "frontRight": "50%",
  "frontRatio": "50/50",
  "backTop": "50%",
  "backBottom": "50%",
  "backLeft": "49%",
  "backRight": "51%",
  "backRatio": "50/50",
  "cornerFlaws": "Describe corner condition or state clean",
  "edgeFlaws": "Describe edge condition or state clean",
  "surfaceFlaws": "Describe surface condition or state clean"
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
