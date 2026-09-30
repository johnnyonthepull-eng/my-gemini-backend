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
Carefully examine the provided front and back images of THIS specific trading card. Conduct a thorough condition and centering audit. Do not use placeholders or generic text. Every property must contain detailed, custom information specific to the uploaded card.

MANDATORY RULES:
1. Identify the exact card name, expansion set, card number, rarity, language, and finish variant visible in the images. Provide an identification confidence percentage (e.g. "99%").
2. Provide realistic estimated numeric or tier grades for PSA, BGS, and ACE along with accompanying confidence percentages and detailed explanatory labels for why each grade was assigned.
3. For BGS, provide specific subgrades formatted cleanly (e.g., "C: 9.5 | Cr: 8.5 | E: 9.0 | S: 8.0").
4. Provide a professional grading recommendation (e.g. "PSA", "BGS", or "Keep Raw") with a custom rationale label.
5. Provide a comprehensive condition summary paragraph detailing eye appeal and why the card is locked out of or achieves higher tiers.
6. For visual diagnostics, estimate physical border widths in millimeters (mm) to one decimal place (e.g., "1.9 mm") for top, bottom, left, and right on both front and back, alongside centering ratios (e.g., "55/45").
7. Provide extensive, professional text descriptions for corner flaws, edge flaws, and surface flaws observed on the card. Never use dashes ("—") or blank spaces.

Return ONLY a valid JSON object matching this exact key structure:
{
  "cardName": "Exact character name or title visible on the card",
  "setName": "Exact name of the expansion set",
  "cardNumber": "Exact card number / set code",
  "rarity": "Exact rarity tier",
  "language": "Detected language",
  "variant": "Finish variant description",
  "confidence": "99%",
  "psaGrade": "8",
  "psaLabel": "Detailed explanation for PSA grade based on wear",
  "bgsGrade": "8.5",
  "bgsSubgrades": "C: 9.5 | Cr: 8.5 | E: 9.0 | S: 8.0",
  "aceGrade": "8",
  "aceLabel": "Detailed explanation for ACE grade",
  "recGrade": "PSA",
  "recLabel": "Specific recommendation rationale for this card",
  "conditionSummary": "Detailed custom paragraph summarizing this specific card's overall condition and eye appeal.",
  "frontTop": "1.9 mm",
  "frontBottom": "2.1 mm",
  "frontLeft": "2.2 mm",
  "frontRight": "1.8 mm",
  "frontRatio": "55/45",
  "backTop": "1.8 mm",
  "backBottom": "2.2 mm",
  "backLeft": "2.0 mm",
  "backRight": "2.4 mm",
  "backRatio": "45/55",
  "cornerFlaws": "Detailed description of corner wear, whitening, or chipping across all 4 corners.",
  "edgeFlaws": "Detailed description of edge wear, silvering, or rough cuts on front and back.",
  "surfaceFlaws": "Detailed description of surface gloss, print lines, scratches, or texture disruptions."
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
