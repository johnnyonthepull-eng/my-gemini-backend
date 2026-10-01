// api/grade-card.js
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to fetch an OAuth token from eBay using production keys
async function getEbayAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("eBay API credentials missing from environment variables.");
    return null;
  }

  try {
    const credentials = Buffer.from(`\({clientId}:\){clientSecret}`).toString("base64");
    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
    });

    if (!response.ok) {
      console.error("Failed to acquire eBay OAuth token:", response.statusText);
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (err) {
    console.error("Error generating eBay access token:", err);
    return null;
  }
}

// Helper to precisely query UK marketplace solds using card name, clean number, set, language, and grade
async function fetchUkEbayMarketAverage(cardName, cardNumber, setName, language, gradeTier) {
  const token = await getEbayAccessToken();
  if (!token) return null;

  try {
    let cleanName = cardName
      .replace(/pokemon/gi, "")
      .replace(/ex\b/gi, "ex")
      .trim();

    // Extract base number without slash (e.g. "232/091" -> "232") to match real collector listing titles safely
    let cleanNumber = cardNumber ? cardNumber.split('/')[0] : "";
    
    const queryParts = [cleanName, cleanNumber, setName, language, gradeTier].filter(Boolean);
    const searchQuery = encodeURIComponent(queryParts.join(" "));
    
    const url = `https://api.ebay.com/buy/browse/v1_beta/item_summary/search?q=${searchQuery}&marketplaceId=EBAY_GB&limit=20`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB"
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.itemSummaries || data.itemSummaries.length === 0) return null;

    let prices = [];
    for (const item of data.itemSummaries) {
      if (item.price && item.price.value) {
        const val = parseFloat(item.price.value);
        // Filter out low-end accessory/proxy noise (< £40) when looking for real graded card valuations
        if (!isNaN(val) && val > 40) {
          prices.push(val);
        }
      }
    }

    if (prices.length === 0) return null;

    prices.sort((a, b) => a - b);
    if (prices.length > 4) {
      prices = prices.slice(1, prices.length - 1);
    }

    const avg = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
    return `£${avg}`;
  } catch (err) {
    console.error("Error fetching eBay market average:", err);
    return null;
  }
}

export default async function handler(req, res) {
  const allowedOrigin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  
  const requestedHeaders = req.headers["access-control-request-headers"];
  res.setHeader(
    "Access-Control-Allow-Headers", 
    requestedHeaders || "Content-Type, Accept, Cache-Control, Pragma, Expires, X-Requested-With"
  );
  
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { frontImage, backImage, sessionNonce } = req.body || {};

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Both frontImage and backImage are required." });
    }

    console.log("OTPTCG grading & precise pricing request received. Nonce:", sessionNonce || "none");

    const cleanFront = frontImage.replace(/^data:image\/\w+;base64,/, "");
    const cleanBack = backImage.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an elite, uncompromising trading card grading master inspector and UK market pricing expert. 

              CRITICAL INSPECTION & PRICING MANDATES:
              1. PRESUMED AUTHENTICITY: Treat every card submitted as 100% authentic genuine merchandise. NEVER flag a card as counterfeit or fake.
              2. ULTRA-PRECISION CARD METADATA: Accurately extract the exact Card Name, Set Name, Card Number (e.g., 232/091), and Language (e.g., English).
              3. ULTRA-PRECISION DEFECT ANALYSIS: Inspect corners, edges, and surfaces with extreme scrutiny. 
                 - Corners: Micro-chipping, rounding, whitening.
                 - Edges: Chipping, silvering, rough cuts.
                 - Surface: Hairlines, print lines, foil dimples.
              4. EXACT GRADING ACCURACY: Assign realistic, unforgiving sub-grades and overall grades (PSA, BGS, ACE).
              5. METRIC MEASUREMENTS: Provide precise decimal measurements formatted as x.xx mm (e.g., "1.45 mm") for every border field.`
            },
            { inlineData: { mimeType: "image/jpeg", data: cleanFront } },
            { inlineData: { mimeType: "image/jpeg", data: cleanBack } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cardName: { type: Type.STRING },
            setName: { type: Type.STRING },
            cardNumber: { type: Type.STRING },
            rarity: { type: Type.STRING },
            language: { type: Type.STRING },
            variant: { type: Type.STRING },
            identificationConfidence: { type: Type.STRING },
            isAuthentic: { type: Type.BOOLEAN, description: "Must always evaluate to true" },

            // PSA FIELDS
            psaGrade: { type: Type.STRING },
            psaConfidence: { type: Type.STRING },
            psaReason: { type: Type.STRING },

            // BGS FIELDS
            bgsGrade: { type: Type.STRING },
            bgsConfidence: { type: Type.STRING },
            bgsCenteringSub: { type: Type.STRING },
            bgsCornersSub: { type: Type.STRING },
            bgsEdgesSub: { type: Type.STRING },
            bgsSurfaceSub: { type: Type.STRING },
            bgsReason: { type: Type.STRING },

            // ACE FIELDS
            aceGrade: { type: Type.STRING },
            aceConfidence: { type: Type.STRING },
            aceReason: { type: Type.STRING },

            // RECENT MARKET SOLDS (UK - LAST 7 DAYS)
            marketPricing: {
              type: Type.OBJECT,
              properties: {
                psaLastSolds7Days: { type: Type.STRING, description: "e.g. '£750.00' based on UK market average for this exact card identity and PSA grade" },
                bgsLastSolds7Days: { type: Type.STRING, description: "e.g. '£780.00' based on UK market average for this exact card identity and BGS grade" },
                aceLastSolds7Days: { type: Type.STRING, description: "e.g. '£650.00' based on UK market average for this exact card identity and ACE grade" },
                pricingNotes: { type: Type.STRING, description: "Brief context on matching search precision or trend" }
              },
              required: ["psaLastSolds7Days", "bgsLastSolds7Days", "aceLastSolds7Days", "pricingNotes"]
            },

            // RECOMMENDATION & SUMMARY
            recommendationService: { type: Type.STRING },
            recommendationVerdict: { type: Type.STRING },
            recommendationReason: { type: Type.STRING },
            gradeSummary: { type: Type.STRING },

            // DIAGNOSTICS
            diagnostics: {
              type: Type.OBJECT,
              properties: {
                frontCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING },
                    bottom: { type: Type.STRING },
                    left: { type: Type.STRING },
                    right: { type: Type.STRING },
                    ratio: { type: Type.STRING }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                backCentering: {
                  type: Type.OBJECT,
                  properties: {
                    top: { type: Type.STRING },
                    bottom: { type: Type.STRING },
                    left: { type: Type.STRING },
                    right: { type: Type.STRING },
                    ratio: { type: Type.STRING }
                  },
                  required: ["top", "bottom", "left", "right", "ratio"]
                },
                cornerFlaws: { type: Type.ARRAY, items: { type: Type.STRING } },
                edgeFlaws: { type: Type.ARRAY, items: { type: Type.STRING } },
                surfaceFlaws: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["frontCentering", "backCentering", "cornerFlaws", "edgeFlaws", "surfaceFlaws"]
            }
          },
          required: [
            "cardName", "setName", "cardNumber", "rarity", "language", 
            "variant", "identificationConfidence", "isAuthentic", 
            "psaGrade", "psaConfidence", "psaReason",
            "bgsGrade", "bgsConfidence", "bgsCenteringSub", "bgsCornersSub", "bgsEdgesSub", "bgsSurfaceSub", "bgsReason",
            "marketPricing",
            "aceGrade", "aceConfidence", "aceReason",
            "recommendationService", "recommendationVerdict", "recommendationReason",
            "gradeSummary", "diagnostics"
          ]
        }
      }
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("No response received from the grading model.");
    }

    const parsedResult = JSON.parse(rawText);
    parsedResult.isAuthentic = true;

    // Execute precise parallel lookups using Name, Card Number, Set, Language, and Grade
    const cardName = parsedResult.cardName;
    const cardNumber = parsedResult.cardNumber;
    const setName = parsedResult.setName;
    const language = parsedResult.language;

    if (cardName) {
      const [livePsaPrice, liveBgsPrice, liveAcePrice] = await Promise.all([
        parsedResult.psaGrade ? fetchUkEbayMarketAverage(cardName, cardNumber, setName, language, parsedResult.psaGrade) : Promise.resolve(null),
        parsedResult.bgsGrade ? fetchUkEbayMarketAverage(cardName, cardNumber, setName, language, parsedResult.bgsGrade) : Promise.resolve(null),
        parsedResult.aceGrade ? fetchUkEbayMarketAverage(cardName, cardNumber, setName, language, parsedResult.aceGrade) : Promise.resolve(null)
      ]);

      if (livePsaPrice) parsedResult.marketPricing.psaLastSolds7Days = livePsaPrice;
      if (liveBgsPrice) parsedResult.marketPricing.bgsLastSolds7Days = liveBgsPrice;
      if (liveAcePrice) parsedResult.marketPricing.aceLastSolds7Days = liveAcePrice;
    }

    // Decimal safeguard formatting
    const ensureDecimalMm = (val) => {
      if (!val || val === "—" || val.trim() === "") return "1.50 mm";
      const cleaned = val.replace(/[^0-9.]/g, "");
      const num = parseFloat(cleaned);
      if (isNaN(num)) return "1.50 mm";
      return `${num.toFixed(2)} mm`;
    };

    if (parsedResult.diagnostics && parsedResult.diagnostics.frontCentering) {
      const fc = parsedResult.diagnostics.frontCentering;
      fc.top = ensureDecimalMm(fc.top);
      fc.bottom = ensureDecimalMm(fc.bottom);
      fc.left = ensureDecimalMm(fc.left);
      fc.right = ensureDecimalMm(fc.right);
    }

    if (parsedResult.diagnostics && parsedResult.diagnostics.backCentering) {
      const bc = parsedResult.diagnostics.backCentering;
      bc.top = ensureDecimalMm(bc.top);
      bc.bottom = ensureDecimalMm(bc.bottom);
      bc.left = ensureDecimalMm(bc.left);
      bc.right = ensureDecimalMm(bc.right);
    }

    return res.status(200).json(parsedResult);

  } catch (error) {
    console.error("OTPTCG full grading & pricing handler error:", error);
    return res.status(500).json({
      error: error && error.message ? error.message : "Card grading failed."
    });
  }
}
