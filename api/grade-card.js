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

    const promptText = `You are an elite, brutally strict master TCG authenticator and head grading director for PSA, BGS, and ACE. 
Carefully examine the provided front and back images of THIS specific trading card. Apply professional industry-standard grading rigor without leniency. 

STRICT GRADING RULES & PENALTIES:
1. GEM MINT 10 REQUIREMENT: A Gem Mint 10 requires flawless sub-grades (centering 50/50 to 55/45, pristine uncompromised corners, zero edge silvering, and absolute zero surface flaws or print lines). Any flaw automatically locks the card out of a 10.
2. SURFACE & PRINT LINE PENALTIES: Even a single faint print line, minor scratch, or texture disruption on the foil/holo layer immediately caps PSA/ACE at a maximum grade of 8 or 9, and pulls BGS Surface subgrade down to 8.0 or 8.5.
3. CORNER & EDGE PENALTIES: Any micro-whitening, chipping, or corner softness on the back or front forces a strict grade reduction. Edge silvering or rough factory cuts must result in lower edge subgrades.
4. DETAILED JUSTIFICATIONS: You must write extensive, thorough explanations for EVERY grade label, detailing exact micro-flaws observed and explaining precisely why the card achieved or failed to achieve higher tiers.

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
  "psaLabel": "Exhaustive breakdown explaining why it is capped at this grade, detailing specific surface and corner limitations.",
  "bgsGrade": "8.5",
  "bgsSubgrades": "C: 9.5 | Cr: 8.5 | E: 9.0 | S: 8.0",
  "aceGrade": "8",
  "aceLabel": "Strict breakdown detailing why modern factory/wear defects restricted this card from Gem Mint status.",
  "recGrade": "PSA",
  "recLabel": "Comprehensive strategic rationale advising whether to grade or keep raw based on current market liquidity vs. condition penalties.",
  "conditionSummary": "A comprehensive, highly detailed professional paragraph evaluating the card's overall eye appeal, structural integrity, and exact reasonings why higher tier grades are unreachable.",
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
  "cornerFlaws": "Exhaustive description of corner wear, micro-whitening, or fiber softness across all 4 corners.",
  "edgeFlaws": "Exhaustive description of edge silvering, rough cuts, or chipping on front and back boundaries.",
  "surfaceFlaws": "Exhaustive description of surface gloss integrity, print lines, hairline scratches, or foil disruptions."
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
