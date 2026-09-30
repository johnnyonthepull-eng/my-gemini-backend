export default async function handler(req, res) {
  // 1. CORS Headers
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
    const { frontImage, backImage } = req.body;

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Missing front or back image data." });
    }

    // Helper to clean base64 data URL prefix if present (e.g., "data:image/jpeg;base64,...")
    const cleanBase64 = (dataUrl) => {
      const parts = dataUrl.split(",");
      return parts.length > 1 ? parts[1] : dataUrl;
    };

    const frontBase64Data = cleanBase64(frontImage);
    const backBase64Data = cleanBase64(backImage);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured on Vercel.");
    }

    // 2. Direct REST API call to Gemini (No npm packages required!)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `You are an expert TCG archivist and identifier. Analyze these front and back card images with 100% precision. Ignore condition, wear, or grading—focus purely on reading the card for what it exactly is. 

Provide your response in strict JSON format with the following keys:
{
  "cardName": "Exact name of the card",
  "setNumber": "Card number / set code (e.g. 025/198, SWSH065)",
  "setName": "Name of the expansion set",
  "rarity": "Rarity symbol or tier (e.g. Secret Rare, Illustration Rare, Ultra Rare)",
  "language": "Language of the card (English, Japanese, Simplified Chinese, etc.)",
  "variantType": "Holo pattern, reverse holo, master ball reverse, 1st edition, promo, etc.",
  "extractedText": "Key text, attacks, abilities, or flavor text visible on the card",
  "additionalDetails": "Any unique markers, copyright info, or distinguishing features"
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

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      throw new Error(`Gemini API error (\({geminiResponse.status}):\){errorBody}`);
    }

    const data = await geminiResponse.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Received empty response from Gemini model.");
    }

    // Clean up potential markdown code blocks from the AI output
    const jsonString = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(jsonString);

    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("Card Reader Error:", error);
    return res.status(500).json({ error: error.message || "Failed to process card data." });
  }
}
