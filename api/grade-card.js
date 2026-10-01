const { GoogleGenAI } = require("@google/genai");

module.exports = async function handler(req, res) {
  // Direct response headers to eliminate CORS blocks on any origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing from environment variables." });
    }

    const { frontImage, backImage, sessionNonce } = req.body || {};

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Both frontImage and backImage are required." });
    }

    console.log("OTPTCG grading request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
You are a master trading card grading inspector. Analyze the provided front and back card images. 
Return ONLY a valid raw JSON object. Do not wrap the JSON in markdown code blocks like \`\`\`json. Match this exact schema precisely:

{
  "cardName": "string",
  "setName": "string",
  "cardNumber": "string",
  "rarity": "string",
  "language": "string",
  "variant": "string",
  "identificationConfidence": "string",
  "isAuthentic": true,
  "psaGrade": "string",
  "psaConfidence": "string",
  "psaReason": "string",
  "bgsGrade": "string",
  "bgsConfidence": "string",
  "bgsCenteringSub": "string",
  "bgsCornersSub": "string",
  "bgsEdgesSub": "string",
  "bgsSurfaceSub": "string",
  "bgsReason": "string",
  "aceGrade": "string",
  "aceConfidence": "string",
  "aceReason": "string",
  "recommendationService": "string",
  "recommendationVerdict": "string",
  "recommendationReason": "string",
  "gradeSummary": "string",
  "diagnostics": {
    "frontCentering": {
      "top": "string",
      "bottom": "string",
      "left": "string",
      "right": "string",
      "ratio": "string"
    },
    "backCentering": {
      "top": "string",
      "bottom": "string",
      "left": "string",
      "right": "string",
      "ratio": "string"
    },
    "cornerFlaws": ["array of detailed descriptions"],
    "edgeFlaws": ["array of detailed descriptions"],
    "surfaceFlaws": ["array of detailed descriptions"]
  }
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: cleanFront } },
            { inlineData: { mimeType: "image/jpeg", data: cleanBack } }
          ]
        }
      ]
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("No response received from the grading model.");
    }

    let cleanedJSON = rawText.trim();
    if (cleanedJSON.startsWith("```json")) {
      cleanedJSON = cleanedJSON.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanedJSON.startsWith("```")) {
      cleanedJSON = cleanedJSON.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsedResult = JSON.parse(cleanedJSON);
    return res.status(200).json(parsedResult);

  } catch (error) {
    console.error("OTPTCG grade-card error details:", error);
    return res.status(500).json({ error: error.message || "Card grading failed due to an internal server exception." });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};
