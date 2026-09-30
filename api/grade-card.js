import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const config = {
  runtime: "edge", // Uses the Edge runtime to support streaming and bypass standard body size limitations
};

export default async function handler(req) {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const body = await req.json();
    const { frontImage, backImage } = body;

    if (!frontImage || !backImage) {
      return new Response(JSON.stringify({ error: "Missing front or back image." }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
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

    return new Response(JSON.stringify(parsedData), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("Grading API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error during card analysis." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
