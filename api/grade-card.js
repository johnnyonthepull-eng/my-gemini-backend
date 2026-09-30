import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});


/* ==========================================================================
   RETRY WRAPPER
   ========================================================================== */

async function generateWithRetry(
  params,
  retries = 3,
  delay = 1000
) {
  try {
    return await ai.models.generateContent(params);

  } catch (err) {

    const message =
      String(err?.message || "").toLowerCase();

    const isRetryable =
      err?.status === 429 ||
      err?.status === 500 ||
      err?.status === 502 ||
      err?.status === 503 ||
      message.includes("503") ||
      message.includes("overloaded") ||
      message.includes("temporarily unavailable") ||
      message.includes("rate limit");

    if (retries > 0 && isRetryable) {

      console.warn(
        `Gemini busy/error. Retrying in ${delay}ms... ` +
        `(${retries} attempts left)`
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


/* ==========================================================================
   CORS
   ========================================================================== */

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


/* ==========================================================================
   MAIN VERCEL HANDLER
   ========================================================================== */

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


    /* ----------------------------------------------------------------------
       Validate images
       ---------------------------------------------------------------------- */

    if (!frontBase64 || !backBase64) {

      return res.status(400).json({
        error:
          "Missing front or back image payload."
      });
    }


    /* ----------------------------------------------------------------------
       STEP 1
       Gemini identifies and grades the card
       ---------------------------------------------------------------------- */

    console.log(
      "Starting Gemini card identification and condition analysis..."
    );


    const aiAnalysis =
      await analyseCardWithGemini({
        frontBase64,
        backBase64,
        frontMimeType,
        backMimeType
      });


    /* ----------------------------------------------------------------------
       STEP 2
       Look up current PulseTCG data
       ---------------------------------------------------------------------- */

    console.log(
      "Looking up PulseTCG pricing..."
    );


    const pulsePrices =
      await getPulseTCGPrices(
        aiAnalysis.cardIdentification,
        aiAnalysis.companyPredictions
      );


    /* ----------------------------------------------------------------------
       STEP 3
       Calculate grading economics
       ---------------------------------------------------------------------- */

    const gradingEconomics =
      calculateGradingEconomics({
        predictions:
          aiAnalysis.companyPredictions,

        pulsePrices
      });


    /* ----------------------------------------------------------------------
       STEP 4
       Generate value-aware recommendation
       ---------------------------------------------------------------------- */

    console.log(
      "Generating value-aware grading recommendation..."
    );


    const recommendation =
      await createValueRecommendation({

        card:
          aiAnalysis.cardIdentification,

        predictions:
          aiAnalysis.companyPredictions,

        diagnostics:
          aiAnalysis.subgrades,

        gradeSummary:
          aiAnalysis.gradeSummary,

        pulsePrices,

        gradingEconomics

      });


    /* ----------------------------------------------------------------------
       STEP 5
       Return complete response
       ---------------------------------------------------------------------- */

    return res.status(200).json({

      cardIdentification:
        aiAnalysis.cardIdentification,

      companyPredictions:
        aiAnalysis.companyPredictions,

      subgrades:
        aiAnalysis.subgrades,

      gradeSummary:
        aiAnalysis.gradeSummary,

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


/* ==========================================================================
   GEMINI CARD ANALYSIS
   ========================================================================== */

async function analyseCardWithGemini({

  frontBase64,
  backBase64,
  frontMimeType,
  backMimeType

}) {


  const gradingSystemInstruction = `

You are an expert trading card identification and condition
pre-screening AI.

You are analysing two photographs:

IMAGE 1 = FRONT OF CARD
IMAGE 2 = BACK OF CARD


============================================================
IMPORTANT LIMITATIONS
============================================================

You are performing a visual pre-screen only.

DO NOT claim that the result is an official PSA, BGS or ACE grade.

DO NOT claim 100% certainty.

DO NOT claim that you actually used infrared hardware,
ultraviolet hardware, blue-light hardware, microscopes,
or physical measurement equipment.

DO NOT invent information that cannot be seen.

If something cannot be determined from the photographs,
say "Unknown" or describe the uncertainty.

Do not turn an estimated visual measurement into an
exact physical millimetre measurement.

Centering may be estimated from visible borders as a ratio
or approximate percentage.

Example:

"Approximately 55/45 left-right, 50/50 top-bottom."

If the card edges are not sufficiently visible to estimate
centering, say so.


============================================================
1. CARD IDENTIFICATION
============================================================

Identify as accurately as possible:

- card name
- expansion/set name
- card number
- rarity
- language
- variant/finish where visible

Use both front and back.

Pay close attention to:

- printed card number
- set symbol
- expansion logo
- copyright line
- language
- holo/reverse holo/illustration rare/etc.
- promo markings
- special variants


============================================================
2. CENTERING
============================================================

Estimate:

FRONT:

- left/right
- top/bottom
- overall centering ratio

BACK:

- left/right
- top/bottom
- overall centering ratio

Use visual estimates.

Do NOT claim exact millimetre accuracy.

If a millimetre estimate is possible from known card dimensions,
label it as APPROXIMATE.

Never describe a photograph-derived measurement as exact.


============================================================
3. CORNERS
============================================================

Inspect for visible:

- whitening
- rounding
- chipping
- dents
- corner cuts
- fraying
- bends
- visible wear

Only report defects that are reasonably visible.


============================================================
4. EDGES
============================================================

Inspect for:

- whitening
- edge chipping
- silvering
- rough cuts
- print defects
- edge dents
- visible separation

Again, do not invent microscopic defects.


============================================================
5. SURFACE
============================================================

Inspect the supplied photographs for visible:

- scratches
- print lines
- dents
- creases
- surface marks
- holo scratches
- texture abnormalities
- print defects
- staining
- whitening

If image resolution prevents reliable detection,
say that the defect cannot be confirmed.


============================================================
6. PSA ESTIMATE
============================================================

Estimate the most likely PSA grade.

Use conservative reasoning.

Possible grades may include:

PSA 10
PSA 9
PSA 8
PSA 7
etc.

Explain the main factors preventing a higher grade.


============================================================
7. BGS ESTIMATE
============================================================

Estimate:

- Centering
- Corners
- Edges
- Surface

Then estimate an overall BGS grade.

The subgrades must be internally consistent with
the overall prediction.

Do not invent decimal precision that the images
cannot support.


============================================================
8. ACE ESTIMATE
============================================================

Estimate the likely ACE grade based on the visible
condition.

Explain the reasoning.


============================================================
9. OVERALL SUMMARY
============================================================

Give a concise but useful summary of:

- strongest condition characteristics
- visible weaknesses
- biggest grading risk
- image limitations
- overall condition


============================================================
10. CONFIDENCE
============================================================

Give confidence separately for:

- card identification
- condition assessment
- centering assessment
- overall grading prediction

Use:

High
Medium
Low

Do not use fake numerical precision.


============================================================
RETURN FORMAT
============================================================

Return valid JSON only.

`;


  const response =
    await generateWithRetry({

      /*
       * Keep your existing model if it is available
       * in your Gemini account.
       *
       * You can override it through Vercel:
       *
       * GEMINI_MODEL=...
       */

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
                "Analyse both images and return the requested JSON."
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


  let data;

  try {

    data =
      JSON.parse(responseText);

  } catch (err) {

    console.error(
      "Gemini returned invalid JSON:",
      responseText
    );

    throw new Error(
      "Gemini returned invalid JSON."
    );

  }


  /*
   * Add defaults to prevent the frontend
   * from breaking if a field is missing.
   */

  data.cardIdentification =
    data.cardIdentification || {};

  data.companyPredictions =
    data.companyPredictions || {};

  data.subgrades =
    data.subgrades || {};

  data.gradeSummary =
    data.gradeSummary || "";


  return data;
}


/* ==========================================================================
   PULSE TCG PRICE LOOKUP
   ==========================================================================

   IMPORTANT:

   PulseTCG's public website exposes current UK market data and
   graded-card prices, but I could not verify a public documented
   API endpoint.

   Therefore this function deliberately does NOT invent an endpoint.

   Configure one of the following:

   PULSE_API_URL
   PULSE_API_KEY

   when you have legitimate API access/documentation from PulseTCG.

   ========================================================================== */

async function getPulseTCGPrices(
  card,
  predictions
) {

  const retrievedAt =
    new Date().toISOString();


  /*
   * No API configured.
   *
   * We explicitly return unavailable rather than allowing Gemini
   * to fabricate a market value.
   */

  if (!process.env.PULSE_API_URL) {

    console.warn(
      "PULSE_API_URL is not configured. " +
      "Returning unavailable PulseTCG prices."
    );


    return {

      live:
        false,

      source:
        "PulseTCG",

      retrievedAt,

      status:
        "PulseTCG API not configured",

      PSA: {

        grade:
          predictions?.PSA?.predictedGrade || null,

        price:
          null,

        currency:
          "GBP"

      },

      BGS: {

        grade:
          predictions?.BGS?.predictedGrade || null,

        price:
          null,

        currency:
          "GBP"

      },

      ACE: {

        grade:
          predictions?.ACE?.predictedGrade || null,

        price:
          null,

        currency:
          "GBP"

      }

    };
  }


  /*
   * Search parameters.
   *
   * These should match whatever official Pulse API
   * endpoint you are given.
   */

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
        card?.language || ""

    });


  const headers = {

    Accept:
      "application/json"

  };


  if (process.env.PULSE_API_KEY) {

    headers.Authorization =
      `Bearer ${process.env.PULSE_API_KEY}`;

  }


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
      `PulseTCG request failed with HTTP ${response.status}.`
    );

  }


  const pulseData =
    await response.json();


  /*
   * --------------------------------------------------------------
   * NORMALISE THE RESPONSE
   * --------------------------------------------------------------
   *
   * Change these mappings to match the actual Pulse API response.
   */

  const psa =
    extractGradedPrice(
      pulseData,
      "PSA",
      predictions?.PSA?.predictedGrade
    );


  const bgs =
    extractGradedPrice(
      pulseData,
      "BGS",
      predictions?.BGS?.predictedGrade
    );


  const ace =
    extractGradedPrice(
      pulseData,
      "ACE",
      predictions?.ACE?.predictedGrade
    );


  return {

    live:
      true,

    source:
      "PulseTCG",

    retrievedAt,

    status:
      "Live",

    PSA: psa,

    BGS: bgs,

    ACE: ace

  };
}


/* ==========================================================================
   EXTRACT GRADED PRICE
   ========================================================================== */

function extractGradedPrice(
  data,
  company,
  predictedGrade
) {

  /*
   * This supports a few sensible response shapes.
   *
   * Once you know the exact Pulse API JSON, replace this with
   * the exact mapping.
   */

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


  let currency =
    companyData?.currency ??
    "GBP";


  /*
   * If the API returns a grades object:
   *
   * grades: {
   *   "PSA 10": 123,
   *   "PSA 9": 75
   * }
   */

  if (
    price === null &&
    companyData?.grades
  ) {

    const possibleGradeKeys = [

      predictedGrade,

      String(predictedGrade)
        .replace(company, "")
        .trim(),

      `${company} ${predictedGrade}`

    ];


    for (
      const key of possibleGradeKeys
    ) {

      if (
        companyData.grades[key] !== undefined
      ) {

        price =
          companyData.grades[key];

        break;

      }

    }

  }


  return {

    grade,

    price:
      typeof price === "number"
        ? price
        : (
            price !== null &&
            !Number.isNaN(
              Number(price)
            )
              ? Number(price)
              : null
          ),

    currency

  };
}


/* ==========================================================================
   GRADING ECONOMICS
   ========================================================================== */

function calculateGradingEconomics({
  predictions,
  pulsePrices
}) {

  const services = [

    {
      name:
        "PSA",

      predictedGrade:
        predictions?.PSA?.predictedGrade,

      price:
        pulsePrices?.PSA?.price

    },

    {
      name:
        "BGS",

      predictedGrade:
        predictions?.BGS?.predictedGrade,

      price:
        pulsePrices?.BGS?.price

    },

    {
      name:
        "ACE",

      predictedGrade:
        predictions?.ACE?.predictedGrade,

      price:
        pulsePrices?.ACE?.price

    }

  ];


  const available =
    services.filter(
      service =>
        typeof service.price === "number"
    );


  if (!available.length) {

    return {

      available:
        false,

      message:
        "No live graded prices were available."

    };

  }


  const highest =
    available.reduce(

      (highest, current) =>

        current.price >
        highest.price

          ? current
          : highest

    );


  return {

    available:
      true,

    highestPotentialValue:
      highest.price,

    highestPotentialService:
      highest.name,

    comparisons:
      available

  };
}


/* ==========================================================================
   VALUE-AWARE RECOMMENDATION
   ========================================================================== */

async function createValueRecommendation({

  card,
  predictions,
  diagnostics,
  gradeSummary,
  pulsePrices,
  gradingEconomics

}) {


  const recommendationPrompt = `

You are the financial/value comparison layer of a trading
card grading pre-screening system.

You must NOT invent prices.

The ONLY market prices you may use are the PulseTCG prices
provided below.

CARD:

Name:
${card?.cardName || "Unknown"}

Set:
${card?.setName || "Unknown"}

Number:
${card?.cardNumber || "Unknown"}

Rarity:
${card?.rarity || "Unknown"}

Language:
${card?.language || "Unknown"}


GRADE PREDICTIONS:

PSA:
${JSON.stringify(
  predictions?.PSA || {},
  null,
  2
)}

BGS:
${JSON.stringify(
  predictions?.BGS || {},
  null,
  2
)}

ACE:
${JSON.stringify(
  predictions?.ACE || {},
  null,
  2
)}


PULSETCG DATA:

${JSON.stringify(
  pulsePrices,
  null,
  2
)}


GRADING ECONOMICS:

${JSON.stringify(
  gradingEconomics,
  null,
  2
)}


CONDITION SUMMARY:

${gradeSummary || ""}


YOUR TASK:

1. Compare the predicted grades.

2. Compare the current PulseTCG values for those predicted grades.

3. Identify which grading service has the highest available
   potential slab value.

4. Consider prediction uncertainty.

5. Do not claim the AI prediction is guaranteed.

6. Do not invent grading fees.

7. Do not invent shipping costs.

8. If grading/shipping costs are supplied through environment
   variables, you may account for them.

9. If costs are NOT supplied, say that the recommendation is
   based on potential slab value rather than full net profit.

10. If no PulseTCG price exists for a service, do not pretend
    there is one.

11. If all prices are unavailable, state that a value-based
    recommendation cannot reliably be made.

12. Use:

    "Worth Sending"

    "Borderline"

    or

    "Not Worth Sending"

    only when there is enough information to justify that
    classification.

13. If the raw card value is unavailable, do not invent it.

14. Do not call the recommendation financial advice.

15. Explain the main reason clearly.

Return JSON only.

`;


  const response =
    await generateWithRetry({

      model:
        process.env.GEMINI_MODEL ||
        "gemini-3.5-flash-lite",

      contents:
        recommendationPrompt,

      config: {

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
      "Gemini returned an empty recommendation."
    );

  }


  try {

    return JSON.parse(
      responseText
    );

  } catch {

    console.error(
      "Invalid recommendation JSON:",
      responseText
    );

    throw new Error(
      "Gemini returned invalid recommendation JSON."
    );

  }
}
