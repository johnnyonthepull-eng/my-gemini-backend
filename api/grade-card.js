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

    // Using Gemini 3.8 Flash vision endpoint
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const promptText = `You are a professional trading card grader and archivist. Perform a rigorous condition and authenticity analysis on these front and back card images. 

Provide your response in strict JSON format with these exact keys:
{
  "cardName": "Exact name of the card",
  "setNumber": "Card number / set code (e.g. 025/198)",
  "setName": "Name of the expansion set",
  "rarity": "Rarity tier (e.g. Illustration Rare, Ultra Rare)",
  "language": "Language of the card",
  "variantType": "Holo pattern, reverse holo, promo, etc.",
  "estimatedGrade": "Estimated grade range (e.g. PSA 9-10, Mint, Near Mint, Lightly Played)",
  "centering": "Analysis of front/back centering borders (e.g. 50/50, slight left bias)",
  "corners": "Condition breakdown of all 4 corners (whitening, dings, clean)",
  "edges": "Condition breakdown of the edges (silvering, chipping, clean)",
  "surface": "Surface condition check (scratches, print lines, holo scuffs)",
  "extractedText": "Key text or attacks visible on the card",
  "additionalDetails": "Any unique markers, centering notes, or flaws"
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
      const errorMessage = "Google API Failed with code " + statusCode + ": " + responseText;
      return res.status(502).json({ error: errorMessage });
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
