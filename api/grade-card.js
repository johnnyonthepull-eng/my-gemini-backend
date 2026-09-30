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

    const promptText = `You are an elite, strict professional trading card authenticator and grader (PSA, BGS, ACE). 
Analyze the provided front and back card images with maximum depth and precision. 

MANDATORY RULES:
1. You are strictly forbidden from leaving any field blank, using dashes ("—"), or outputting placeholders. Every single property in the JSON schema must contain a rich, detailed, real technical assessment based directly on what you see in the images.
2. For visual diagnostics (frontTop, frontBottom, frontLeft, frontRight, backTop, backBottom, backLeft, backRight), you MUST estimate the border width in millimeters (mm) to one decimal place (e.g., "1.8 mm") assuming a standard card size (63x88mm).
3. Provide comprehensive analysis for summaries, flaws, and condition rationales.`;

    // Enforcing strict structured JSON output schema via the API config
    const requestBody = {
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
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            cardName: { type: "STRING", description: "Exact character name or title of the card" },
            setName: { type: "STRING", description: "Exact name of the expansion set" },
            cardNumber: { type: "STRING", description: "Card number / set code (e.g. 025/198)" },
            rarity: { type: "STRING", description: "Rarity tier (e.g. Illustration Rare, Holofoil)" },
            language: { type: "STRING", description: "Language of the card (e.g. English, Japanese)" },
            variant: { type: "STRING", description: "Finish variant (e.g. Holofoil, Reverse Holo, Normal)" },
            confidence: { type: "STRING", description: "Identification confidence level (e.g. High)" },
            psaGrade: { type: "STRING", description: "Estimated PSA Grade (e.g. PSA 9 or PSA 10)" },
            psaLabel: { type: "STRING", description: "Detailed breakdown justifying the PSA estimate" },
            bgsGrade: { type: "STRING", description: "Estimated BGS Grade (e.g. 9.5 or 9)" },
            bgsSubgrades: { type: "STRING", description: "Detailed subgrades format (e.g. C: 9.5 | Cr: 9.5 | E: 9.5 | S: 9.0)" },
            aceGrade: { type: "STRING", description: "Estimated ACE Grade (e.g. 10)" },
            aceLabel: { type: "STRING", description: "Detailed breakdown justifying the ACE estimate" },
            recGrade: { type: "STRING", description: "Recommended grading house target (e.g. PSA)" },
            recLabel: { type: "STRING", description: "Rationale for why this grading house is optimal" },
            conditionSummary: { type: "STRING", description: "Comprehensive professional summary of overall condition" },
            frontTop: { type: "STRING", description: "Front top border measurement in mm (e.g. 1.8 mm)" },
            frontBottom: { type: "STRING", description: "Front bottom border measurement in mm (e.g. 2.0 mm)" },
            frontLeft: { type: "STRING", description: "Front left border measurement in mm (e.g. 2.0 mm)" },
            frontRight: { type: "STRING", description: "Front right border measurement in mm (e.g. 2.0 mm)" },
            frontRatio: { type: "STRING", description: "Front centering ratio estimate (e.g. 50/50)" },
            backTop: { type: "STRING", description: "Back top border measurement in mm (e.g. 2.0 mm)" },
            backTop: { type: "STRING", description: "Back top border measurement in mm (e.g. 2.0 mm)" },
            backBottom: { type: "STRING", description: "Back bottom border measurement in mm (e.g. 2.0 mm)" },
            backLeft: { type: "STRING", description: "Back left border measurement in mm (e.g. 1.5 mm)" },
            backRight: { type: "STRING", description: "Back right border measurement in mm (e.g. 2.5 mm)" },
            backRatio: { type: "STRING", description: "Back centering ratio estimate (e.g. 45/55)" },
            cornerFlaws: { type: "STRING", description: "Detailed description of all 4 corners and any wear" },
            edgeFlaws: { type: "STRING", description: "Detailed description of front and back edges and any wear" },
            surfaceFlaws: { type: "STRING", description: "Detailed description of surface gloss, scratches, or print lines" }
          },
          required: [
            "cardName", "setName", "cardNumber", "rarity", "language", "variant", 
            "confidence", "psaGrade", "psaLabel", "bgsGrade", "bgsSubgrades", 
            "aceGrade", "aceLabel", "recGrade", "recLabel", "conditionSummary", 
            "frontTop", "frontBottom", "frontLeft", "frontRight", "frontRatio", 
            "backTop", "backBottom", "backLeft", "backRight", "backRatio", 
            "cornerFlaws", "edgeFlaws", "surfaceFlaws"
          ]
        }
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
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

    const parsedCardData = JSON.parse(rawText);

    return res.status(200).json(parsedCardData);

  } catch (error) {
    console.error("Server catch error:", error);
    return res.status(500).json({ error: error.message || "Internal server crash." });
  }
}
