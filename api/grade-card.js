import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { frontImage, backImage, sessionNonce } = req.body || {};

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

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const promptText = `SESSION_NONCE: ${sessionNonce || Date.now()}
You are a forensic TCG grading scientist and senior authenticator. Perform a completely fresh, independent, analytical evaluation of the newly uploaded images. Do not carry over or assume any data from previous card uploads.

CLINICAL & ANALYTIC PROTOCOLS:
1. PRECISE MEASUREMENTS: Calculate front and back border widths down to the tenth of a millimeter (e.g., "1.9 mm") and compute precise centering ratios.
2. GRANULAR FLAW MAPPING: For corners, edges, and surface, specify the exact quadrant or location of any micro-defect. You are strictly forbidden from writing "None detected". Detail actual texture lines, micro-whitening, or fiber traits.
3. SUBGRADE MATHEMATICS: Provide rigorous sub-grades for BGS where Corners, Edges, Surface, and Centering dictate the score.
4. RIGOROUS JUSTIFICATIONS: Link every grade ceiling directly to physical evidence observed under simulated magnification.

Return ONLY a valid JSON object matching this exact key structure:
{
  "cardName": "Exact character name and designation",
  "setName": "Exact expansion set name",
  "cardNumber": "Exact card number / set code",
  "rarity": "Exact rarity tier",
  "language": "Detected language",
  "variant": "Finish variant description",
  "confidence": "99.8%",
  "psaGrade": "8",
  "psaLabel": "Clinical breakdown citing specific tolerance deviations and microscopic surface/corner restrictions.",
  "bgsGrade": "8.5",
  "bgsSubgrades": "C: 9.5 | Cr: 8.5 | E: 9.0 | S: 8.0",
  "aceGrade": "8",
  "aceLabel": "Analytical assessment detailing structural and finish limitations.",
  "recGrade": "PSA",
  "recLabel": "Strategic market liquidity vs. condition penalty analysis.",
  "conditionSummary": "An exhaustive, highly analytical paragraph detailing the card's micro-structural integrity and the exact clinical reasons capping its maximum grade.",
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
  "cornerFlaws": "Precise analytical breakdown of all 4 corners, specifying fiber compression, microscopic whitening, or die-cut sharpness.",
  "edgeFlaws": "Precise analytical breakdown of border edges, detailing factory knife track marks, silvering, or micro-chipping.",
  "surfaceFlaws": "Precise analytical breakdown of foil sheen, texture alignment, microscopic hairline scuffs, or refractive print lines."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
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
      config: {
        temperature: 0.3
      }
    });

    const rawText = response.text;
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
