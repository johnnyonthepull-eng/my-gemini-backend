import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: false, // Disables default parser to manually handle raw stream safely
  },
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Manually read the incoming request stream chunks
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawBody = Buffer.concat(buffers).toString("utf8");
    
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      return res.status(400).json({ error: "Invalid JSON payload sent to server." });
    }

    const frontImage = body?.frontImage;
    const backImage = body?.backImage;

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Missing front or back image." });
    }

    function parseDataUrl(dataUrl) {
      const matches = dataUrl.match(/^data:(.+?);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error("Invalid image data URL format.");
      }
      return {
        mimeType: matches[1],
        data: matches[2],
      };
    }

    const frontParsed = parseDataUrl(frontImage);
    const backParsed = parseDataUrl(backImage);

    const prompt = `
You are an expert trading card authenticator and professional card grader (specializing in Pokémon and TCG standards for PSA, Beckett (BGS), and ACE Grading). 

Analyze the provided front and back images of the card. Provide a rigorous, realistic pre-screening assessment.

You must return a valid JSON object ONLY, with no markdown code block formatting (or inside a standard JSON block, but strictly parsable). Use this exact schema structure:

{
  "identification": {
    "cardName": "Name of the card (e.g. Umbreon VMAX, Charizard)",
    "setName": "Expansion set name",
    "cardNumber": "Card number (e.g. 215/203)",
    "rarity": "Rarity type (e.g. Secret Rare, Alternate Art)",
    "language": "Language (e.g. English, Japanese)",
    "variant": "Variant (e.g. Holofoil, Reverse Holofoil, Normal)",
    "confidence": "High / Medium / Low"
  },
  "grades": {
    "psa": {
      "grade": "Estimated numerical grade (e.g. 10, 9, 8)",
      "confidence": "High / Medium / Low",
      "reason": "Detailed explanation for PSA estimation based on centering, corners, edges, and surface."
    },
    "bgs": {
      "grade": "Estimated numerical grade (e.g. 9.5, 9, 8.5)",
      "confidence": "High / Medium / Low",
      "subgrades": {
        "centering": "e.g. 9.5",
        "corners": "e.g. 9.0",
        "edges": "e.g. 9.5",
        "surface": "e.g. 9.0"
      },
      "reason": "Detailed explanation for Beckett estimation."
    },
    "ace": {
      "grade": "Estimated numerical grade (e.g. 10, 9)",
      "confidence": "High / Medium / Low",
      "reason": "Detailed explanation for ACE Grading estimation."
    }
  },
  "recommendation": {
    "service": "PSA / Beckett / ACE",
    "estimatedGrade": "e.g. Gem Mint 10 / Mint 9",
    "verdict": "e.g. Highly Recommended to Grade / Grade with Caution / Not Recommended",
    "reason": "Why this specific grading service maximizes value or fits this card's condition best."
  },
  "summary": "A concise 2-3 sentence overall summary of the card's condition and market viability.",
  "diagnostics": {
    "frontCentering": "Estimated front centering ratio (e.g. 50/50, 55/45)",
    "backCentering": "Estimated back centering ratio (e.g. 50/50)",
    "cornerFlaws": ["List any corner whitening or dings, or empty array if clean"],
    "edgeFlaws": ["List any chipping, silvering, or edge wear, or empty array if clean"],
    "surfaceFlaws": ["List any print lines, scratches, scuffs, or dents, or empty array if clean"]
  }
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: frontParsed.mimeType,
            data: frontParsed.data,
          },
        },
        {
          inlineData: {
            mimeType: backParsed.mimeType,
            data: backParsed.data,
          },
        },
        prompt,
      ],
    });

    const textResponse = response.text();
    
    let cleanJsonStr = textResponse.trim();
    if (cleanJsonStr.startsWith("```json")) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const parsedData = JSON.parse(cleanJsonStr);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error("Grading API error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error during card analysis.",
    });
  }
}
