import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Use POST for card analysis."
    });
  }

  try {
    const {
      frontBase64,
      backBase64
    } = req.body || {};

    if (!frontBase64 || !backBase64) {
      return res.status(400).json({
        error: "Missing front or back image."
      });
    }

    console.log("Front received:", frontBase64.length);
    console.log("Back received:", backBase64.length);

    const prompt = `
You are an expert trading card grading pre-screening assistant.

Analyze the front and back photographs of the trading card.

Identify:
- Card name
- Set
- Card number
- Rarity
- Language
- Variant

Estimate:
- PSA grade
- BGS grade
- BGS centering
- BGS corners
- BGS edges
- BGS surface
- ACE grade

Also identify visible:
- Centering
- Corner flaws
- Edge flaws
- Surface flaws

Do NOT claim to use infrared, ultraviolet, blue-light,
millimeter measuring equipment, or any other equipment
that was not actually provided.

Only make observations supported by the photographs.

These are estimates and are NOT official PSA, BGS or ACE grades.

Return JSON ONLY using this structure:

{
  "cardIdentification": {
    "cardName": "",
    "setName": "",
    "cardNumber": "",
    "rarity": "",
    "language": "",
    "variant": "",
    "identificationConfidence": ""
  },

  "companyPredictions": {
    "PSA": {
      "predictedGrade": "",
      "confidence": "",
      "reasoning": ""
    },

    "BGS": {
      "predictedGrade": "",
      "confidence": "",
      "estimatedSubgrades": {
        "centering": "",
        "corners": "",
        "edges": "",
        "surface": ""
      },
      "reasoning": ""
    },

    "ACE": {
      "predictedGrade": "",
      "confidence": "",
      "reasoning": ""
    }
  },

  "subgrades": {
    "centeringFront": "",
    "centeringBack": "",
    "cornersFlaws": [],
    "edgesFlaws": [],
    "surfaceFlaws": []
  },

  "gradeSummary": "",

  "recommendation": {
    "service": "",
    "estimatedGrade": "",
    "verdict": "",
    "reason": ""
  }
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",

      contents: [
        {
          role: "user",

          parts: [
            {
              text: prompt
            },

            {
              inlineData: {
                mimeType: "image/jpeg",
                data: frontBase64
              }
            },

            {
              inlineData: {
                mimeType: "image/jpeg",
                data: backBase64
              }
            }
          ]
        }
      ],

      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const text = response.text;

    if (!text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    let clean = text.trim();

    if (clean.startsWith("```json")) {
      clean = clean
        .replace(/^```json/, "")
        .replace(/```$/, "")
        .trim();
    }

    if (clean.startsWith("```")) {
      clean = clean
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();
    }

    const result = JSON.parse(clean);

    return res.status(200).json(result);

  } catch (error) {

    console.error(
      "CARD GRADING ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Card analysis failed."
    });
  }
}
