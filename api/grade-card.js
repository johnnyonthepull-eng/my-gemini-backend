import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/* =========================================================
   CORS
========================================================= */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/* =========================================================
   SLEEP
========================================================= */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* =========================================================
   GEMINI REQUEST WITH RETRIES + MODEL FALLBACK
========================================================= */

async function generateWithFallback(params) {
  const models = [
    "gemini-3.8-flash",
    "gemini-3.5-flash"
  ];

  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Trying \({model} - attempt\){attempt}/3`);

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: params.parts
            }
          ],
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.0,
            maxOutputTokens: 5000
          }
        });

        console.log(`Gemini succeeded using ${model}`);

        return response;

      } catch (error) {
        lastError = error;

        const message = error?.message || String(error);
        const status = error?.status || error?.code;

        const isOverloaded =
          status === 503 ||
          status === 429 ||
          message.includes("503") ||
          message.includes("429") ||
          message.toLowerCase().includes("high demand") ||
          message.toLowerCase().includes("overloaded") ||
          message.toLowerCase().includes("unavailable");

        const isNotFound =
          status === 404 ||
          message.includes("404") ||
          message.toLowerCase().includes("not found");

        console.error(`\({model} attempt\){attempt} failed:`, message);

        if (isNotFound) {
          console.warn(`Model ${model} not found or unavailable. Skipping...`);
          break; 
        }

        if (!isOverloaded) {
          throw error;
        }

        if (attempt === 1) {
          await sleep(2000);
        } else if (attempt === 2) {
          await sleep(5000);
        }
      }
    }
  }

  throw lastError || new Error("All Gemini models are temporarily unavailable.");
}

/* =========================================================
   DATA URL PARSER
========================================================= */

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

/* =========================================================
   MAIN Vercel HANDLER
========================================================= */

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};

    const frontImage = body.frontImage || body.frontBase64;
    const backImage = body.backImage || body.backBase64;

    if (!frontImage || !backImage) {
      return res.status(400).json({
        error: "Missing front or back image data."
      });
    }

    const front = parseDataUrl(frontImage);
    const back = parseDataUrl(backImage);

    const systemInstruction = `
You are an uncompromising, brutally strict professional trading card grading inspector. Your mandate is to protect collectors from ever getting a lower grade than predicted. When in doubt, you ALWAYS penalize heavily and grade down. 

BRUTAL ZERO-TOLERANCE RULES:
1. Virtual Filter Simulation: Aggressively simulate high-contrast and edge-enhancement filters. Treat every shadow, reflection, foil swirl, or speck as a potential defect (micro-scratch, print line, dent, or edge chipping) unless 100% proven otherwise.
2. The Gem Mint / Pristine 10 Wall: A grade of 10 (PSA 10, BGS 10 subgrades, or Ace 10) is practically impossible unless the card is absolute perfection under optical analysis. 
   - ANY back or front edge whitening (even a single microscopic speck of chipping) automatically caps PSA at 8 or lower.
   - ANY hairline surface scratch or print line automatically disqualifies a 10, dropping the maximum ceiling immediately.
   - ANY slight corner softening blunts a 10 instantly.
3. Company Specific Strictness:
   - PSA: Brutally strict on rear centering and back edge chipping. No subgrades mean one flaw brings down the whole score.
   - BGS (Beckett): Independent subgrades (Centering, Corners, Edges, Surface) must be completely flawless for any 10. 
     * BLACK LABEL POTENTIAL: Only populate "blackLabelPotential" with "Black Label Potential" if EVERY SINGLE ONE of the four BGS subgrades evaluates to an absolute 10. If even one subgrade is 9.5 or lower, leave it blank or state "None".
   - Ace: Apply strict modern standards with zero margin for error on centering ratios.
4. Conservative Fallback: If you are torn between two grades (e.g., 9 and 10, or 8 and 9), ALWAYS choose the lower grade.

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

    const geminiResponse = await generateWithFallback({
      systemInstruction,
      parts: [
        {
          text: "Execute a brutally strict, zero-tolerance optical inspection across PSA, BGS, and Ace standards. Hunt for edge chipping, surface hairlines, and corner imperfections, calculate exact millimeter borders, and output the conservative JSON response."
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
    });

    let text = geminiResponse.text;

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    text = text.trim();

    if (text.startsWith("```json")) {
      text = text
        .replace(/^```json/, "")
        .replace(/```$/, "")
        .trim();
    } else if (text.startsWith("```")) {
      text = text
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();
    }

    let result;

    try {
      result = JSON.parse(text);
    } catch (jsonError) {
      console.error("Gemini returned invalid JSON:", text);
      throw new Error("Gemini returned invalid JSON.");
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Vercel grading error:", error);

    const message = error?.message || "Internal server error.";

    if (
      message.includes("high demand") ||
      message.includes("503") ||
      message.includes("429") ||
      message.includes("unavailable") ||
      message.includes("overloaded")
    ) {
      return res.status(503).json({
        error: "Gemini is temporarily overloaded. The system tried multiple Gemini models but they are currently unavailable. Please try again in a few seconds."
      });
    }

    return res.status(500).json({
      error: message
    });
  }
}
