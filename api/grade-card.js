import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/* ============================================================
   GEMINI RETRY WRAPPER
============================================================ */

async function generateWithRetry(
  params,
  retries = 3,
  delay = 1000
) {
  try {
    return await ai.models.generateContent(params);
  } catch (err) {
    const message = String(err?.message || "").toLowerCase();

    const retryable =
      err?.status === 429 ||
      err?.status === 500 ||
      err?.status === 502 ||
      err?.status === 503 ||
      message.includes("503") ||
      message.includes("overloaded") ||
      message.includes("rate limit") ||
      message.includes("temporarily unavailable");

    if (retryable && retries > 0) {
      console.warn(
        `Gemini temporarily unavailable. Retrying in ${delay}ms...`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, delay)
      );

      return generateWithRetry(
        params,
        retries - 1,
        delay * 2
      );
    }

    throw err;
  }
}


/* ============================================================
   CORS
============================================================ */

function setCors(res) {
  res.setHeader(
    "Access-Control-Allow-Credentials",
    "true"
  );

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
}


/* ============================================================
   MAIN VERCEL HANDLER
============================================================ */

export default async function handler(req, res) {

  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {
      frontBase64,
      backBase64,
      frontMimeType = "image/jpeg",
      backMimeType = "image/jpeg"
    } = req.body || {};


    /* --------------------------------------------------------
       VALIDATE IMAGES
    -------------------------------------------------------- */

    if (!frontBase64 || !backBase64) {
      return res.status(400).json({
        error:
          "Missing front or back image payload."
      });
    }


    /* --------------------------------------------------------
       ANALYSE CARD
    -------------------------------------------------------- */

    const analysis =
      await analyseCardWithGemini({
        frontBase64,
        backBase64,
        frontMimeType,
        backMimeType
      });


    /* --------------------------------------------------------
       CREATE SIMPLE SERVICE RECOMMENDATION
    -------------------------------------------------------- */

    const recommendation =
      createRecommendation(
        analysis.companyPredictions
      );


    /* --------------------------------------------------------
       RETURN RESPONSE
    -------------------------------------------------------- */

    return res.status(200).json({

      cardIdentification:
        analysis.cardIdentification,

      companyPredictions:
        analysis.companyPredictions,

      subgrades:
        analysis.subgrades,

      gradeSummary:
        analysis.gradeSummary,

      recommendation

    });

  } catch (err) {

    console.error(
      "Vercel Function Error:",
      err
    );

    return res.status(500).json({
      error:
        err?.message ||
        "Internal server error processing images with Gemini."
    });
  }
}


/* ============================================================
   GEMINI CARD ANALYSIS
============================================================ */

async function analyseCardWithGemini({
  frontBase64,
  backBase64,
  frontMimeType,
  backMimeType
}) {

  const gradingSystemInstruction = `

You are an expert trading card identification and grading
pre-screening AI.

You are analysing two photographs:

IMAGE 1 = FRONT OF CARD
IMAGE 2 = BACK OF CARD

Your job is to identify the card and provide a careful,
realistic estimated condition assessment for PSA, BGS and ACE.

IMPORTANT:

This is an AI pre-screening estimate.

You are NOT an official PSA grader.

You are NOT an official BGS grader.

You are NOT an official ACE grader.

Never claim that your result is an official grade.

Never claim 100% certainty.

Never claim that you physically used infrared,
ultraviolet, blue-light equipment, microscopes,
or physical measuring equipment.

Only report defects that can reasonably be inferred
from the photographs.

If a defect cannot be reliably seen, say so.

DO NOT INVENT CARD INFORMATION.

DO NOT INVENT DEFECTS.

DO NOT INVENT MEASUREMENTS.


============================================================
1. CARD IDENTIFICATION
============================================================

Identify the card using both photographs.

Return:

- Card name
- Set / expansion
- Card number
- Rarity
- Language
- Variant / finish

Pay particular attention to:

- card number
- set symbol
- expansion markings
- promo markings
- artwork
- holo pattern
- reverse holo
- special illustration
- language
- variant markings


If you are uncertain about an identification,
use the most likely identification and reduce the
identification confidence.


============================================================
2. CENTERING
============================================================

Estimate the visible centering from the photographs.

For the FRONT provide:

- left/right centering
- top/bottom centering
- approximate ratio

For the BACK provide:

- left/right centering
- top/bottom centering
- approximate ratio

Do NOT claim exact physical millimetre measurements.

Photographs do not provide reliable physical millimetre
measurements without a known reference scale.

Use approximate descriptions such as:

"Approximately 55/45 left-right and 50/50 top-bottom."

If centering cannot be reliably determined:

"Unable to reliably determine from supplied image."


============================================================
3. CORNERS
============================================================

Look carefully for visible:

- whitening
- rounding
- chipping
- dents
- corner wear
- fraying
- cutting defects


============================================================
4. EDGES
============================================================

Look carefully for visible:

- whitening
- chipping
- silvering
- rough cuts
- edge dents
- edge wear
- printing defects


============================================================
5. SURFACE
============================================================

Look carefully for visible:

- scratches
- print lines
- dents
- creases
- holo scratches
- texture defects
- stains
- print defects
- roller lines
- surface marks


============================================================
6. PSA ESTIMATE
============================================================

Estimate the most likely PSA grade based on the supplied
photographs.

Consider:

- centering
- corners
- edges
- surface
- visible print quality
- overall condition

Give a concise explanation.


============================================================
7. BGS ESTIMATE
============================================================

Estimate:

- Centering
- Corners
- Edges
- Surface

Then estimate the likely overall BGS grade.

The BGS grade should be consistent with the estimated
subgrades.

Give a concise explanation.


============================================================
8. ACE ESTIMATE
============================================================

Estimate the likely ACE grade based on:

- centering
- corners
- edges
- surface
- overall visible condition

Give a concise explanation.


============================================================
9. GRADE SUMMARY
============================================================

Write a useful overall summary.

Mention:

- strongest aspects of the card
- weakest aspects
- biggest grading risk
- apparent overall condition
- limitations caused by the photographs


============================================================
10. CONFIDENCE
============================================================

Provide confidence for:

- card identification
- condition assessment
- centering assessment
- PSA grade
- BGS grade
- ACE grade

Use:

"High"

"Medium"

"Low"


============================================================
11. IMPORTANT IMAGE LIMITATIONS
============================================================

Do not pretend that photographs can reveal defects
that are impossible to see.

For example, do not claim to detect hidden dents,
creases or scratches if they are not visible.

Do not claim exact millimetre measurements.

Do not claim infrared or blue-light analysis was
actually performed.

If image quality limits the assessment, explicitly
mention this in the reasoning or summary.


============================================================
12. OUTPUT
============================================================

Return VALID JSON ONLY.

Use EXACTLY this structure:

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
      "reasoning": "",
      "confidence": ""
    },

    "BGS": {
      "predictedGrade": "",
      "estimatedSubgrades": {
        "centering": "",
        "corners": "",
        "edges": "",
        "surface": ""
      },
      "reasoning": "",
      "confidence": ""
    },

    "ACE": {
      "predictedGrade": "",
      "reasoning": "",
      "confidence": ""
    }

  },

  "subgrades": {

    "centeringFront": "",

    "centeringBack": "",

    "cornersFlaws": [],

    "edgesFlaws": [],

    "surfaceFlaws": []

  },

  "gradeSummary": ""
}

`;


  /* ==========================================================
     GEMINI REQUEST
  ========================================================== */

  const response =
    await generateWithRetry({

      model:
        process.env.GEMINI_MODEL ||
        "gemini-3.5-flash-lite",

      contents: [

        {
          role: "user",

          parts: [

            {
              text:
                "IMAGE 1 — FRONT OF CARD"
            },

            {
              inlineData: {
                data:
                  frontBase64,

                mimeType:
                  frontMimeType
              }
            },

            {
              text:
                "IMAGE 2 — BACK OF CARD"
            },

            {
              inlineData: {
                data:
                  backBase64,

                mimeType:
                  backMimeType
              }
            },

            {
              text:
                "Analyse both images and return the requested JSON report."
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


  /* ==========================================================
     PARSE GEMINI RESPONSE
  ========================================================== */

  const responseText =
    response.text;

  if (!responseText) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }


  try {

    return JSON.parse(
      responseText
    );

  } catch (err) {

    console.error(
      "Invalid Gemini JSON:",
      responseText
    );

    throw new Error(
      "Gemini returned invalid JSON."
    );
  }
}


/* ============================================================
   GRADING SERVICE RECOMMENDATION
============================================================ */

/*
  For now there is NO pricing involved.

  The recommendation is based on the highest predicted grade.

  Example:

  PSA 10
  BGS 9.5
  ACE 10

  PSA and ACE are tied on numerical grade.

  In a tie, we use the order PSA → BGS → ACE so the result
  is deterministic.

  Later, when eBay pricing is added, this function can be
  replaced with the highest recent sold value.
*/

function createRecommendation(
  predictions
) {

  if (!predictions) {

    return {

      service:
        "Unable to recommend",

      predictedGrade:
        "",

      verdict:
        "Unable to recommend",

      reason:
        "No grading predictions were returned."

    };
  }


  const services = [

    {
      name:
        "PSA",

      grade:
        extractNumericGrade(
          predictions.PSA?.predictedGrade
        ),

      gradeText:
        predictions.PSA?.predictedGrade ||
        "",

      confidence:
        predictions.PSA?.confidence ||
        "Low"

    },

    {
      name:
        "BGS",

      grade:
        extractNumericGrade(
          predictions.BGS?.predictedGrade
        ),

      gradeText:
        predictions.BGS?.predictedGrade ||
        "",

      confidence:
        predictions.BGS?.confidence ||
        "Low"

    },

    {
      name:
        "ACE",

      grade:
        extractNumericGrade(
          predictions.ACE?.predictedGrade
        ),

      gradeText:
        predictions.ACE?.predictedGrade ||
        "",

      confidence:
        predictions.ACE?.confidence ||
        "Low"

    }

  ];


  const validServices =
    services.filter(
      service =>
        typeof service.grade ===
        "number" &&
        !Number.isNaN(service.grade)
    );


  if (!validServices.length) {

    return {

      service:
        "Unable to recommend",

      predictedGrade:
        "",

      verdict:
        "Unable to recommend",

      reason:
        "The AI did not return usable grading predictions."

    };
  }


  /* ----------------------------------------------------------
     HIGHEST NUMERICAL PREDICTED GRADE
  ---------------------------------------------------------- */

  const highestGrade =
    Math.max(
      ...validServices.map(
        service => service.grade
      )
    );


  const winners =
    validServices.filter(
      service =>
        service.grade ===
        highestGrade
    );


  /*
     If multiple services have the same numerical grade,
     choose the first in PSA → BGS → ACE order.

     This keeps the result deterministic until pricing
     is introduced.
  */

  const selected =
    winners[0];


  let reason =
    `${selected.name} has the highest predicted grade at ${selected.gradeText}.`;


  if (winners.length > 1) {

    reason =
      `${winners.map(
        service => service.name
      ).join(" and ")} are tied at the highest predicted grade of ${highestGrade}. ${selected.name} is shown as the recommendation for now.`;
  }


  return {

    service:
      selected.name,

    predictedGrade:
      selected.gradeText,

    verdict:
      "Highest Predicted Grade",

    reason,

    confidence:
      selected.confidence

  };
}


/* ============================================================
   EXTRACT NUMERICAL GRADE
============================================================ */

function extractNumericGrade(
  gradeText
) {

  if (
    !gradeText ||
    typeof gradeText !==
      "string"
  ) {

    return null;
  }


  /*
    Examples:

    "PSA 10"    → 10
    "BGS 9.5"   → 9.5
    "ACE 10"    → 10
    "9.5"       → 9.5
  */

  const match =
    gradeText.match(
      /(\d+(?:\.\d+)?)/g
    );


  if (!match?.length) {
    return null;
  }


  const numbers =
    match
      .map(Number)
      .filter(
        number =>
          number >= 1 &&
          number <= 10
      );


  if (!numbers.length) {
    return null;
  }


  return numbers[
    numbers.length - 1
  ];
}
