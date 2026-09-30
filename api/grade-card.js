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

      await new Promise(resolve =>
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

    if (!frontBase64 || !backBase64) {
      return res.status(400).json({
        error:
          "Missing front or back image payload."
      });
    }


    /* ========================================================
       GEMINI CARD ANALYSIS
    ======================================================== */

    const analysis =
      await analyseCardWithGemini({
        frontBase64,
        backBase64,
        frontMimeType,
        backMimeType
      });


    /* ========================================================
       PULSETCG PRICE LOOKUP
    ======================================================== */

    const pulsePrices =
      await getPulseTCGPrices(
        analysis.cardIdentification,
        analysis.companyPredictions
      );


    /* ========================================================
       VALUE COMPARISON
    ======================================================== */

    const gradingEconomics =
      calculateGradingEconomics({
        predictions:
          analysis.companyPredictions,

        pulsePrices
      });


    /* ========================================================
       FINAL RECOMMENDATION
    ======================================================== */

    const recommendation =
      await createValueRecommendation({

        card:
          analysis.cardIdentification,

        predictions:
          analysis.companyPredictions,

        diagnostics:
          analysis.subgrades,

        gradeSummary:
          analysis.gradeSummary,

        pulsePrices,

        gradingEconomics
      });


    /* ========================================================
       RETURN EVERYTHING TO FRONTEND
    ======================================================== */

    return res.status(200).json({

      cardIdentification:
        analysis.cardIdentification,

      companyPredictions:
        analysis.companyPredictions,

      subgrades:
        analysis.subgrades,

      gradeSummary:
        analysis.gradeSummary,

      pulsePrices,

      gradingEconomics,

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
        "Internal server error processing card."
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

You are an expert trading card identification,
condition analysis and grading pre-screening AI.

You are analysing two photographs:

IMAGE 1 = FRONT OF CARD
IMAGE 2 = BACK OF CARD

IMPORTANT:

This is an estimated pre-screening result.

You are NOT an official PSA, BGS or ACE grader.

Never claim that your result is an official grade.

Never claim 100% certainty.

Never claim that you physically used infrared,
ultraviolet, blue-light equipment, microscopes,
or physical measuring equipment.

Only report defects that can reasonably be inferred
from the supplied photographs.

If something cannot be reliably seen, say so.

DO NOT INVENT CARD INFORMATION.

DO NOT INVENT MARKET PRICES.


============================================================
CARD IDENTIFICATION
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
- set symbols
- expansion markings
- promo markings
- artwork
- holo pattern
- reverse holo
- special illustration
- language
- variant markings


============================================================
CENTERING
============================================================

Estimate:

FRONT:

- left/right centering
- top/bottom centering
- approximate overall ratio

BACK:

- left/right centering
- top/bottom centering
- approximate overall ratio

Do NOT claim exact millimetre measurements.

Photographs do not provide reliable physical millimetre
measurements without a known reference scale.

Use language such as:

"Approximately 55/45 left-right and 50/50 top-bottom."

If it cannot be reliably measured:

"Not reliably measurable from supplied image."


============================================================
CORNERS
============================================================

Look for visible:

- whitening
- rounding
- chipping
- dents
- corner wear
- fraying
- cutting defects


============================================================
EDGES
============================================================

Look for visible:

- whitening
- chipping
- silvering
- rough cuts
- edge dents
- edge wear
- printing defects


============================================================
SURFACE
============================================================

Look for visible:

- scratches
- print lines
- dents
- creases
- holo scratches
- texture defects
- stains
- printing defects


============================================================
PSA
============================================================

Estimate the most likely PSA grade.

Explain the reasoning.

Consider:

- centering
- corners
- edges
- surface
- visible print quality


============================================================
BGS
============================================================

Estimate BGS subgrades:

- Centering
- Corners
- Edges
- Surface

Then estimate the overall BGS grade.

Explain the reasoning.


============================================================
ACE
============================================================

Estimate the likely ACE grade.

Explain the reasoning.


============================================================
GRADE SUMMARY
============================================================

Write a useful summary explaining:

- strongest aspects of the card
- weakest aspects
- biggest grading risk
- overall apparent condition
- limitations caused by photographs


============================================================
CONFIDENCE
============================================================

Provide confidence levels:

High
Medium
Low

for:

- card identification
- condition
- centering
- overall grade


============================================================
JSON
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
   PULSETCG PRICE LOOKUP
============================================================ */

/*
   IMPORTANT:

   This function is ready for a real PulseTCG API.

   DO NOT put a made-up PulseTCG URL here.

   Once you have the actual PulseTCG API endpoint,
   add it in Vercel Environment Variables as:

   PULSE_API_URL

   And, if required:

   PULSE_API_KEY
*/

async function getPulseTCGPrices(
  card,
  predictions
) {

  const retrievedAt =
    new Date().toISOString();


  /* ----------------------------------------------------------
     NO API CONFIGURED
  ---------------------------------------------------------- */

  if (!process.env.PULSE_API_URL) {

    return {

      live: false,

      source:
        "PulseTCG",

      retrievedAt,

      status:
        "PulseTCG API not configured",

      PSA: {

        grade:
          predictions?.PSA?.predictedGrade ||
          null,

        price:
          null,

        currency:
          "GBP"

      },

      BGS: {

        grade:
          predictions?.BGS?.predictedGrade ||
          null,

        price:
          null,

        currency:
          "GBP"

      },

      ACE: {

        grade:
          predictions?.ACE?.predictedGrade ||
          null,

        price:
          null,

        currency:
          "GBP"

      }

    };
  }


  /* ----------------------------------------------------------
     SEARCH PARAMETERS
  ---------------------------------------------------------- */

  const params =
    new URLSearchParams({

      name:
        card?.cardName || "",

      set:
        card?.setName || "",

      number:
        card?.cardNumber || "",

      rarity:
        card?.rarity || "",

      language:
        card?.language || "",

      variant:
        card?.variant || ""

    });


  const headers = {
    "Accept":
      "application/json"
  };


  if (process.env.PULSE_API_KEY) {

    headers.Authorization =
      `Bearer ${process.env.PULSE_API_KEY}`;

  }


  /* ----------------------------------------------------------
     CALL PULSETCG
  ---------------------------------------------------------- */

  const response =
    await fetch(

      `${process.env.PULSE_API_URL}?${params.toString()}`,

      {
        method:
          "GET",

        headers

      }

    );


  if (!response.ok) {

    throw new Error(
      `PulseTCG request failed: HTTP ${response.status}`
    );
  }


  const data =
    await response.json();


  return {

    live:
      true,

    source:
      "PulseTCG",

    retrievedAt,

    status:
      "Live",

    PSA:
      extractGradedPrice(
        data,
        "PSA",
        predictions?.PSA?.predictedGrade
      ),

    BGS:
      extractGradedPrice(
        data,
        "BGS",
        predictions?.BGS?.predictedGrade
      ),

    ACE:
      extractGradedPrice(
        data,
        "ACE",
        predictions?.ACE?.predictedGrade
      )

  };
}


/* ============================================================
   NORMALISE PULSETCG RESPONSE
============================================================ */

function extractGradedPrice(
  data,
  company,
  predictedGrade
) {

  const companyData =
    data?.[company] ||
    data?.[company.toLowerCase()] ||
    {};


  let price =
    companyData?.price ??
    companyData?.marketPrice ??
    companyData?.value ??
    null;


  let grade =
    companyData?.grade ??
    predictedGrade ??
    null;


  /* ----------------------------------------------------------
     IF API RETURNS A GRADES OBJECT
  ---------------------------------------------------------- */

  if (
    price === null &&
    companyData?.grades
  ) {

    const possibleKeys = [

      predictedGrade,

      String(predictedGrade || "")
        .replace(
          company,
          ""
        )
        .trim(),

      `${company} ${predictedGrade}`

    ];


    for (
      const key of possibleKeys
    ) {

      if (
        companyData.grades[key] !==
        undefined
      ) {

        price =
          companyData.grades[key];

        break;
      }
    }
  }


  if (
    price !== null &&
    Number.isNaN(
      Number(price)
    )
  ) {

    price = null;
  }


  return {

    grade,

    price:
      price === null
        ? null
        : Number(price),

    currency:
      companyData?.currency ||
      "GBP"

  };
}


/* ============================================================
   GRADING VALUE COMPARISON
============================================================ */

function calculateGradingEconomics({
  predictions,
  pulsePrices
}) {

  const services = [

    {

      service:
        "PSA",

      grade:
        predictions?.PSA?.predictedGrade,

      price:
        pulsePrices?.PSA?.price

    },

    {

      service:
        "BGS",

      grade:
        predictions?.BGS?.predictedGrade,

      price:
        pulsePrices?.BGS?.price

    },

    {

      service:
        "ACE",

      grade:
        predictions?.ACE?.predictedGrade,

      price:
        pulsePrices?.ACE?.price

    }

  ];


  const available =
    services.filter(
      item =>
        typeof item.price ===
        "number"
    );


  if (!available.length) {

    return {

      available:
        false,

      message:
        "No live PulseTCG graded prices are available."

    };
  }


  const highest =
    available.reduce(
      (a, b) =>
        b.price > a.price
          ? b
          : a
    );


  return {

    available:
      true,

    highestPotentialValue:
      highest.price,

    highestPotentialService:
      highest.service,

    comparisons:
      available

  };
}


/* ============================================================
   FINAL GRADING SERVICE RECOMMENDATION
============================================================ */

async function createValueRecommendation({

  card,
  predictions,
  diagnostics,
  gradeSummary,
  pulsePrices,
  gradingEconomics

}) {

  const prompt = `

You are the final value-analysis layer for a trading-card
grading pre-screening application.

Your job is to compare PSA, BGS and ACE based ONLY on the
information supplied below.

DO NOT invent prices.

DO NOT invent grading fees.

DO NOT invent shipping costs.

DO NOT invent raw card values.

DO NOT invent profit.

If grading costs are unavailable, explicitly state that the
comparison is based on potential slab value and does not
represent net profit.

============================================================
CARD
============================================================

${JSON.stringify(
  card,
  null,
  2
)}

============================================================
GRADE PREDICTIONS
============================================================

${JSON.stringify(
  predictions,
  null,
  2
)}

============================================================
VISUAL DIAGNOSTICS
============================================================

${JSON.stringify(
  diagnostics,
  null,
  2
)}

============================================================
GRADE SUMMARY
============================================================

${gradeSummary || ""}

============================================================
PULSETCG PRICE DATA
============================================================

${JSON.stringify(
  pulsePrices,
  null,
  2
)}

============================================================
VALUE COMPARISON
============================================================

${JSON.stringify(
  gradingEconomics,
  null,
  2
)}

============================================================
TASK
============================================================

Compare the three grading services.

Take into account:

1. Predicted grade.

2. PulseTCG value for that predicted grade.

3. Confidence in the prediction.

4. Visible condition risks.

5. Difference between potential slab values.

6. Whether the predicted grade is sufficiently
   supported by the photographs.

7. Whether current price data actually exists.

If there is no live PulseTCG price information,
DO NOT pretend there is.

If there is insufficient pricing information,
return:

"Insufficient Price Data"

as the verdict.

Otherwise return one of:

"Worth Sending"

"Borderline"

"Not Worth Sending"

Return:

{
  "service": "",
  "predictedGrade": "",
  "pulseValue": null,
  "currency": "GBP",
  "verdict": "",
  "confidence": "",
  "reason": ""
}

Return JSON ONLY.

`;


  const response =
    await generateWithRetry({

      model:
        process.env.GEMINI_MODEL ||
        "gemini-3.5-flash-lite",

      contents:
        prompt,

      config: {

        responseMimeType:
          "application/json",

        temperature:
          0.1

      }

    });


  const text =
    response.text;


  try {

    return JSON.parse(
      text
    );

  } catch {

    throw new Error(
      "Gemini returned invalid recommendation JSON."
    );
  }
}
