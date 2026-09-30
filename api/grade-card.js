import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});


async function generateWithRetry(
  params,
  retries = 3,
  delay = 1500
) {

  try {

    return await ai.models.generateContent(
      params
    );

  } catch (error) {

    const message =
      error?.message?.toLowerCase() || "";

    const retryable =
      error?.status === 429 ||
      error?.status === 500 ||
      error?.status === 502 ||
      error?.status === 503 ||
      message.includes("overloaded") ||
      message.includes("temporarily");

    if (
      retryable &&
      retries > 0
    ) {

      console.log(
        `Retrying Gemini in ${delay}ms...`
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            delay
          )
      );

      return generateWithRetry(
        params,
        retries - 1,
        delay * 2
      );
    }

    throw error;
  }
}


export default async function handler(
  req,
  res
) {

  /* ==========================================
     CORS
  ========================================== */

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


  if (
    req.method === "OPTIONS"
  ) {

    return res
      .status(200)
      .end();
  }


  if (
    req.method !== "POST"
  ) {

    return res
      .status(405)
      .json({
        error:
          "Method not allowed"
      });
  }


  try {

    /* ========================================
       API KEY
    ======================================== */

    if (
      !process.env.GEMINI_API_KEY
    ) {

      return res
        .status(500)
        .json({
          error:
            "GEMINI_API_KEY is missing from Vercel."
        });
    }


    /* ========================================
       BODY
    ======================================== */

    const {
      frontBase64,
      backBase64
    } = req.body || {};


    console.log(
      "Received grading request."
    );


    console.log(
      "Front:",
      frontBase64
        ? Math.round(
            frontBase64.length / 1024
          ) + " KB"
        : "MISSING"
    );


    console.log(
      "Back:",
      backBase64
        ? Math.round(
            backBase64.length / 1024
          ) + " KB"
        : "MISSING"
    );


    if (
      !frontBase64 ||
      !backBase64
    ) {

      return res
        .status(400)
        .json({
          error:
            "Missing front or back image."
        });
    }


    /* ========================================
       GEMINI INSTRUCTIONS
    ======================================== */

    const systemInstruction = `

You are an expert trading card grading
pre-screening assistant.

Analyze the FRONT and BACK photographs
of the trading card.

This is a photographic pre-screening
estimate and NOT an official PSA,
BGS or ACE grade.

Do not claim to have performed actual
infrared, ultraviolet, microscopic or
laboratory testing.

Do not claim exact millimetre measurements
unless they can genuinely be established
from the photographs.

Only report defects that are visible or
reasonably supported by the photographs.

================================================
CARD IDENTIFICATION
================================================

Identify:

- Card name
- Set
- Card number
- Rarity
- Language
- Variant

If uncertain, state that the identification
has low confidence rather than inventing data.

================================================
CENTERING
================================================

Estimate front and back centering.

Use ratios such as:

50/50
55/45
60/40
65/35

================================================
CORNERS
================================================

Inspect for:

- whitening
- soft corners
- rounding
- dents
- dings
- corner damage

================================================
EDGES
================================================

Inspect for:

- whitening
- chipping
- silvering
- rough cuts
- edge wear

================================================
SURFACE
================================================

Inspect for:

- scratches
- print lines
- dents
- indentations
- stains
- scuffs
- print defects
- surface abnormalities

================================================
PSA
================================================

Estimate the likely PSA grade based on
visible condition.

================================================
BGS
================================================

Estimate:

- Centering
- Corners
- Edges
- Surface

Then estimate an overall BGS grade.

================================================
ACE
================================================

Estimate the likely ACE grade.

================================================
RECOMMENDATION
================================================

Recommend a grading service based on
the predicted grades and visible
characteristics.

Do NOT use market pricing.

Do NOT claim knowledge of current
card values.

================================================
SUMMARY
================================================

Provide a concise overall condition
summary.

================================================
OUTPUT
================================================

Return ONLY valid JSON.

Use exactly this structure:

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
    "predictedGrade": "",
    "verdict": "",
    "reason": ""
  }
}

`;


    /* ========================================
       GEMINI
    ======================================== */

    const response =
      await generateWithRetry({

        model:
          "gemini-2.5-flash",

        contents: [

          {

            role:
              "user",

            parts: [

              {
                text:
                  "Analyze the trading card. Image 1 is the front and image 2 is the back."
              },

              {
                inlineData: {

                  mimeType:
                    "image/jpeg",

                  data:
                    frontBase64

                }
              },

              {
                inlineData: {

                  mimeType:
                    "image/jpeg",

                  data:
                    backBase64

                }
              }

            ]

          }

        ],

        config: {

          systemInstruction,

          responseMimeType:
            "application/json",

          temperature:
            0.1

        }

      });


    /* ========================================
       RESPONSE
    ======================================== */

    let text =
      response?.text;


    if (!text) {

      throw new Error(
        "Gemini returned an empty response."
      );
    }


    text =
      text.trim();


    if (
      text.startsWith(
        "```json"
      )
    ) {

      text =
        text
          .replace(
            /^```json/,
            ""
          )
          .replace(
            /```$/,
            ""
          )
          .trim();

    } else if (
      text.startsWith(
        "```"
      )
    ) {

      text =
        text
          .replace(
            /^```/,
            ""
          )
          .replace(
            /```$/,
            ""
          )
          .trim();
    }


    const data =
      JSON.parse(text);


    return res
      .status(200)
      .json(data);


  } catch (error) {

    console.error(
      "CARD GRADING ERROR:",
      error
    );


    return res
      .status(500)
      .json({
        error:
          error?.message ||
          "Unable to analyse card."
      });
  }
}
