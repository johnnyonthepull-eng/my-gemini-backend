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
    "gemini-2.5-flash"
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

    // Handles both variable naming conventions gracefully
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
You are a deterministic trading card pre-screening engine and optical analysis system.

Mandatory Analysis Protocol:
1. Virtual Filter Simulation: Mentally apply high-contrast, edge-enhancement, and color-channel separation filters to the image pixels to aggressively expose surface micro-scratches, foil swirls, print lines, dents, and back/front edge whitening (chipping).
2. Exact Centering Measurement: Calculate and provide precise estimated border measurements in millimeters (mm) for top, bottom, left, and right borders on both front and back, alongside the corresponding ratio (e.g., "Left: 2.5mm / Right: 1.5mm (62/38)").
3. Strict Consistency Rules: Identical images must return identical structural JSON output. If edge whitening or a surface hairline scratch is detected via the filtered analysis, cap the appropriate grades instantly based on strict industry standards.

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

    const response = await generateWithFallback({
      systemInstruction,
      parts: [
        {
          text: "Apply virtual contrast/edge enhancement filters to analyze surface defects, print lines, and edge whitening, measure exact border mm dimensions, and return the complete JSON pre-screen."
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

    let text = response.text;

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
