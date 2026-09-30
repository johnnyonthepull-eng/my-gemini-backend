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
  /*
   * Updated with current, active Gemini model endpoints.
   * If a model returns 503/429, we retry with backoff.
   * If a model returns 404 (not found), we immediately 
   * skip to the next model in the array.
   */
  const models = [
    "gemini-3.8-flash",
    "gemini-3.1-pro-preview"
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
            temperature: 0.1,
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

        /*
         * If the model isn't found (404), don't retry—
         * break out of attempt loop and try the next model immediately.
         */
        if (isNotFound) {
          console.warn(`Model ${model} not found. Skipping to next model...`);
          break; 
        }

        /*
         * If it's a general error that isn't temporary overload, throw it.
         */
        if (!isOverloaded) {
          throw error;
        }

        /*
         * Increasing delay for temporary overloads:
         * attempt 1 -> 2 seconds
         * attempt 2 -> 5 seconds
         * attempt 3 -> move to next model
         */
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
   MAIN VERCEL HANDLER
========================================================= */

export default async function handler(req, res) {
  /*
   * CORS headers
   */
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  /*
   * OPTIONS
   */
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  /*
   * POST ONLY
   */
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    /* =====================================================
       BODY
    ====================================================== */
    const body = req.body || {};

    const frontImage = body.frontImage || body.frontBase64;
    const backImage = body.backImage || body.backBase64;

    if (!frontImage || !backImage) {
      return res.status(400).json({
        error: "Missing front or back image."
      });
    }

    /* =====================================================
       PARSE IMAGES
    ====================================================== */
    const front = parseDataUrl(frontImage);
    const back = parseDataUrl(backImage);

    /* =====================================================
       SYSTEM INSTRUCTION
    ====================================================== */
    const systemInstruction = `
You are an expert trading card identification and
condition pre-screening AI.

You are analysing photographs of a physical trading card.

IMPORTANT LIMITATIONS:

You can only assess what is actually visible in the
photographs.

Do NOT claim to have used infrared cameras,
ultraviolet cameras, microscopes, spectrometers,
or physical measuring equipment.

Do NOT claim 100% certainty.

Do NOT invent defects that cannot be seen.

Do NOT invent card information.

If card identification is uncertain, say so and lower
the identification confidence.

If centering cannot be measured reliably from the
photograph, provide an estimate and clearly describe
the limitation.

The output is an AI pre-screening estimate and NOT an
official PSA, Beckett or ACE grade.

=========================================================
CARD IDENTIFICATION
=========================================================

Identify:

- Card name
- Set / expansion
- Card number
- Rarity
- Language
- Variant
- Identification confidence

=========================================================
CONDITION ANALYSIS
=========================================================

Inspect both front and back photographs.

Assess:

1. Centering
2. Corners
3. Edges
4. Surface
5. Visible whitening
6. Visible chipping
7. Visible scratches
8. Visible print lines
9. Visible dents
10. Visible creases
11. Visible alignment issues

Pay particular attention to:

- top/bottom centering
- left/right centering
- back centering
- corner whitening
- edge whitening
- silvering
- scratches
- surface marks
- print defects

=========================================================
PSA ESTIMATE
=========================================================

Provide a realistic estimated PSA grade.

Do not automatically give PSA 10.

The grade must be based on visible evidence.

=========================================================
BGS ESTIMATE
=========================================================

Provide:

- overall estimated BGS grade
- centering subgrade
- corners subgrade
- edges subgrade
- surface subgrade

Do not automatically give 10 subgrades.

=========================================================
ACE ESTIMATE
=========================================================

Provide a realistic estimated ACE grade.

=========================================================
GRADING SERVICE RECOMMENDATION
=========================================================

Recommend the grading service based ONLY on the
predicted condition and the characteristics visible
in the photographs.

Do not claim knowledge of current market prices.

Explain why the recommended service fits the predicted
condition.

=========================================================
SUMMARY
=========================================================

Give a concise overall condition summary.

=========================================================
JSON
=========================================================

Return ONLY valid JSON.

Use exactly this structure:

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

    "frontCentering": "",
    "backCentering": "",

    "cornerFlaws": [],

    "edgeFlaws": [],

    "surfaceFlaws": []

  }
}
`;

    /* =====================================================
       GEMINI
    ====================================================== */
    const response = await generateWithFallback({
      systemInstruction,
      parts: [
        {
          text: "Analyse the front and back photographs of this trading card and return the complete JSON grading pre-screen."
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

    /* =====================================================
       RESPONSE TEXT
    ====================================================== */
    let text = response.text;

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    text = text.trim();

    /*
     * Remove accidental markdown fences
     */
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

    /* =====================================================
       PARSE JSON
    ====================================================== */
    let result;

    try {
      result = JSON.parse(text);
    } catch (jsonError) {
      console.error("Gemini returned invalid JSON:", text);
      throw new Error("Gemini returned invalid JSON.");
    }

    /* =====================================================
       RETURN
    ====================================================== */
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
