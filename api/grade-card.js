import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") {
    throw new Error("Invalid image data.");
  }
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match || match.length !== 3) {
    throw new Error("Invalid image format. Expected a base64 data URL.");
  }
  return {
    mimeType: match[1],
    data: match[2]
  };
}

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Gather all 5 API keys from Vercel environment variables
    const apiKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
      process.env.GEMINI_API_KEY
    ].filter(Boolean);

    if (apiKeys.length === 0) {
      throw new Error("No GEMINI_API_KEY environment variables found on Vercel.");
    }

    const body = req.body || {};
    const frontImage = body.frontImage || body.frontBase64;
    const backImage = body.backImage || body.backBase64;

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Missing front or back image data." });
    }

    const front = parseDataUrl(frontImage);
    const back = parseDataUrl(backImage);

    const systemInstruction = `
You are an uncompromising, brutally strict professional trading card grading inspector. Your mandate is to protect collectors from ever getting a lower grade than predicted. When in doubt, you ALWAYS penalize heavily and grade down. 

BRUTAL ZERO-TOLERANCE RULES & PRINT LINE PROTOCOL:
1. Virtual Multi-Angle Lighting & Contrast Filter Simulation: Mentally apply dynamic high-contrast, directional shadow-mapping, and color-channel separation filters across the entire card surface. 
2. Print Line Hunting Mandate: Actively scan for vertical or horizontal faint lines across the foil or card stock, even those that blend into the artwork or require a specific angle to see. Treat any linear anomaly, reflection discontinuity, texture disruption, or faint streak as a definitive print line. 
3. Print Line Penalty: The moment a print line (visible or subtle) is detected, it instantly caps the PSA grade to a maximum of 8 or 9, forces BGS Surface subgrade down to 8.5 or lower, and disqualifies any Gem Mint / Pristine 10. List every detected print line explicitly under "surfaceFlaws".
4. The Gem Mint / Pristine 10 Wall: A grade of 10 is impossible if any defect exists. Any back or front edge whitening, hairline scratch, or print line instantly kills the 10.
5. Company Specific Strictness:
   - PSA: Brutally strict on rear centering, back edge chipping, and surface print lines. No subgrades mean one flaw brings down the whole score.
   - BGS (Beckett): Independent subgrades must be flawless for any 10. 
     * BLACK LABEL POTENTIAL: Only populate "blackLabelPotential" with "Black Label Potential" if EVERY SINGLE ONE of the four BGS subgrades is an absolute 10.
   - Ace: Apply strict modern standards with zero margin for error.
6. Conservative Fallback: If you are torn between two grades, ALWAYS choose the lower grade.

Return ONLY valid JSON matching this exact structure:

{
  "identification": {
    "cardName": "",
    "setName": "",
    "cardNumber": "",
    "rarity": "",
    "language": "",
    "variant": "",
    "confidence": ""
  },
  "grades": {
    "psa": {
      "grade": "",
      "confidence": "",
      "reason": ""
    },
    "bgs": {
      "grade": "",
      "confidence": "",
      "subgrades": {
        "centering": "",
        "corners": "",
        "edges": "",
        "surface": ""
      },
      "blackLabelPotential": "",
      "reason": ""
    },
    "ace": {
      "grade": "",
      "confidence": "",
      "reason": ""
    }
  },
  "recommendation": {
    "service": "",
    "estimatedGrade": "",
    "verdict": "",
    "reason": ""
  },
  "summary": "",
  "diagnostics": {
    "frontCentering": {
      "topMm": "",
      "bottomMm": "",
      "leftMm": "",
      "rightMm": "",
      "ratio": ""
    },
    "backCentering": {
      "topMm": "",
      "bottomMm": "",
      "leftMm": "",
      "rightMm": "",
      "ratio": ""
    },
    "cornerFlaws": [],
    "edgeFlaws": [],
    "surfaceFlaws": []
  }
}
`;

    const modelsToTry = ["gemini-3.8-flash", "gemini-3.5-flash"];
    let response = null;
    let lastError = null;

    // Loop through all 5 keys and models
    outerLoop: for (const key of apiKeys) {
      const ai = new GoogleGenAI({ apiKey: key });

      for (const model of modelsToTry) {
        try {
          console.log(`Trying model ${model} with key pool...`);
          response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: "Execute a brutally strict, zero-tolerance optical inspection across PSA, BGS, and Ace standards. Simulate high-contrast lighting filters to aggressively hunt down subtle print lines and surface defects, calculate exact millimeter borders, and output the conservative JSON response."
                  },
                  {
                    inlineData: {
                      mimeType: front.mimeType,
                      data: front.data
                    }
                  },
                  {
                    inlineData: {
                      mimeType: back.mimeType,
                      data: back.data
                    }
                  }
                ]
              }
            ],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.0,
              maxOutputTokens: 5000
            }
          });

          break outerLoop;
        } catch (err) {
          lastError = err;
          const msg = err?.message || String(err);
          console.warn(`Attempt failed:`, msg);

          if (
            msg.includes("429") ||
            msg.includes("RESOURCE_EXHAUSTED") ||
            msg.includes("quota")
          ) {
            continue; // Try next model or next key
          } else {
            throw err;
          }
        }
      }
    }

    if (!response) {
      throw lastError || new Error("All pooled keys and models have exhausted their daily quotas.");
    }

    let text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    text = text.trim();
    if (text.startsWith("```json")) {
      text = text.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (text.startsWith("```")) {
      text = text.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const result = JSON.parse(text);
    return res.status(200).json(result);

  } catch (error) {
    console.error("Vercel grading error:", error);
    const errMessage = error?.message || "Internal server error.";

    if (
      errMessage.includes("429") ||
      errMessage.includes("RESOURCE_EXHAUSTED") ||
      errMessage.includes("quota")
    ) {
      return res.status(429).json({
        error: "All free tier limits across your 5 keys have been reached for today. Try again tomorrow!"
      });
    }

    return res.status(500).json({ error: errMessage });
  }
}
