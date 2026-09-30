import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(req, res) {
  // =====================================================
  // CORS
  // =====================================================

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // Handle browser CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // =====================================================
  // METHOD CHECK
  // =====================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Use POST to analyze a card."
    });
  }

  try {
    // ===================================================
    // READ REQUEST
    // ===================================================

    const body = req.body || {};

    const frontBase64 = body.frontBase64;
    const backBase64 = body.backBase64;

    if (!frontBase64 || !backBase64) {
      return res.status(400).json({
        error: "Missing front or back image."
      });
    }

    console.log(
      "Front image received:",
      Math.round(frontBase64.length / 1024),
      "KB"
    );

    console.log(
      "Back image received:",
      Math.round(backBase64.length / 1024),
      "KB"
    );

    // ===================================================
    // SYSTEM INSTRUCTIONS
    // ===================================================

    const gradingSystemInstruction = `
You are an expert trading card identification and grading
pre-screening assistant.

You analyze photographs of trading cards and provide realistic
pre-screening estimates for PSA, Beckett/BGS and ACE Grading.

IMPORTANT LIMITATIONS:

- You are analyzing photographs only.
- Do not claim that you physically measured the card.
- Do not claim to have used infrared equipment.
- Do not claim to have used ultraviolet equipment.
- Do not claim to have used blue-light equipment.
- Do not claim to have detected defects that cannot reasonably
  be seen in the supplied photographs.
- Centering measurements are photographic estimates.
- Surface analysis is limited by the quality, lighting and angle
  of the photographs.
- Official grading companies may produce different results.
- Your predictions are estimates and are NOT official grades.
- Never guarantee a grade.

=========================================================
CARD IDENTIFICATION
=========================================================

Identify the card as accurately as possible.

Determine:

- Card name
- Expansion/set name
- Card number
- Rarity
- Language
- Variant

If identification is uncertain, explicitly say so.

Do not invent a card number or set if it cannot be determined.

=========================================================
CONDITION ANALYSIS
=========================================================

Analyze the visible condition of:

1. Centering
2. Corners
3. Edges
4. Surface

Look for visible issues such as:

- Whitening
- Edge chipping
- Silvering
- Corner wear
- Corner whitening
- Rough cuts
- Scratches
- Print lines
- Surface marks
- Dents
- Creases
- Indentations
- Roller lines
- Printing defects
- Holo scratches
- Scuffs

Only report flaws that are reasonably visible.

=========================================================
CENTERING
=========================================================

Estimate front and back centering using ratios where possible.

Examples:

50/50
55/45
60/40

Do not claim millimeter precision unless the photograph genuinely
provides a reliable reference.

=========================================================
PSA
=========================================================

Estimate a likely PSA grade based on the visible condition.

Use grades such as:

PSA 10
PSA 9
PSA 8
PSA 7
etc.

Explain the primary factors limiting the grade.

=========================================================
BGS
=========================================================

Estimate a likely Beckett/BGS grade.

Provide estimated subgrades for:

- Centering
- Corners
- Edges
- Surface

Use realistic half-point increments where appropriate.

Examples:

10
9.5
9
8.5
8

Do not automatically give high subgrades simply because the image
looks good.

=========================================================
ACE
=========================================================

Estimate a likely ACE grade based on the visible condition.

=========================================================
RECOMMENDATION
=========================================================

Based ONLY on the predicted grades and observed condition, provide
a grading-service recommendation.

Possible services:

PSA
BGS
ACE

The recommendation should explain why the service was selected.

Do not claim that the recommendation guarantees a higher resale value.

=========================================================
OUTPUT
=========================================================

Return VALID JSON ONLY.

Do not return Markdown.

Do not wrap the JSON in triple backticks.

Use this exact structure:

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

    // ===================================================
    // GEMINI REQUEST
    // ===================================================

    const response = await ai.models.generateContent({

      model: "gemini-2.5-flash",

      contents: [
        {
          role: "user",

          parts: [

            {
              text: `
Analyze the following trading card.

The first image is the FRONT of the card.

The second image is the BACK of the card.

Identify the card and provide the complete grading
pre-screening report using the required JSON structure.
`
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

        systemInstruction:
          gradingSystemInstruction,

        responseMimeType:
          "application/json",

        temperature:
          0.1

      }

    });

    // ===================================================
    // READ GEMINI RESPONSE
    // ===================================================

    const responseText =
      response.text;

    if (!responseText) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    console.log(
      "Gemini analysis completed."
    );

    // ===================================================
    // CLEAN JSON
    // ===================================================

    let cleanJson =
      responseText.trim();

    if (
      cleanJson.startsWith("```json")
    ) {

      cleanJson =
        cleanJson
          .replace(/^```json/, "")
          .replace(/```$/, "")
          .trim();

    } else if (
      cleanJson.startsWith("```")
    ) {

      cleanJson =
        cleanJson
          .replace(/^```/, "")
          .replace(/```$/, "")
          .trim();

    }

    // ===================================================
    // PARSE RESULT
    // ===================================================

    const data =
      JSON.parse(cleanJson);

    // ===================================================
    // RETURN RESULT
    // ===================================================

    return res.status(200).json(
      data
    );

  } catch (error) {

    console.error(
      "Vercel Card Grading Error:",
      error
    );

    return res.status(500).json({

      error:
        error?.message ||
        "Internal server error during card analysis."

    });

  }
}
