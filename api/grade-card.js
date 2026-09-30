import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // 1. Enable CORS for Shopify storefront requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }

  try {
    const { frontImage, backImage } = req.body;

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: 'Both front and back card images are required.' });
    }

    // Helper to strip data URL prefix if present
    const cleanBase64 = (dataUrl) => {
      const parts = dataUrl.split(',');
      return parts.length > 1 ? parts[1] : dataUrl;
    };

    const frontBase64 = cleanBase64(frontImage);
    const backBase64 = cleanBase64(backImage);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const promptText = `You are an expert trading card grading assistant and authenticator for OnThePullTCG. Inspect the provided front and back images of this trading card with extreme scrutiny.

Return a valid JSON object ONLY, with no extra markdown formatting or backticks, structured exactly like this:
{
  "identification": {
    "cardName": "Exact card name",
    "setName": "Expansion set name",
    "cardNumber": "Card number e.g. 215/198",
    "rarity": "Rarity tier",
    "language": "English, Japanese, Chinese, etc.",
    "variant": "Normal, Holo, Reverse Holo, Secret Rare, etc.",
    "confidence": "High / Medium / Low"
  },
  "grades": {
    "psa": {
      "grade": "Estimated grade integer e.g. 10, 9, 8",
      "confidence": "High / Medium / Low",
      "reasoning": "Detailed breakdown focusing on centering, corners, edges, and surface."
    },
    "bgs": {
      "grade": "Estimated overall grade e.g. 9.5, 9",
      "confidence": "High / Medium / Low",
      "subgrades": {
        "centering": "e.g. 9.5",
        "corners": "e.g. 9.5",
        "edges": "e.g. 9.0",
        "surface": "e.g. 9.5"
      },
      "reasoning": "Detailed breakdown under BGS standards."
    },
    "ace": {
      "grade": "Estimated grade integer e.g. 10, 9",
      "confidence": "High / Medium / Low",
      "reasoning": "Detailed breakdown under Ace Grading standards."
    }
  },
  "recommendation": {
    "bestService": "PSA, BGS, or ACE",
    "verdict": "e.g. Highly Recommended to Grade / Grade for PC / Raw / Do Not Grade",
    "reason": "Economic and condition-based justification for which grading company to choose."
  },
  "summary": "Comprehensive overall condition overview.",
  "diagnostics": {
    "frontCentering": {
      "top": "Estimated measurement or ratio",
      "bottom": "Estimated measurement or ratio",
      "left": "Estimated measurement or ratio",
      "right": "Estimated measurement or ratio",
      "ratio": "e.g. 55/45"
    },
    "backCentering": {
      "top": "Estimated measurement or ratio",
      "bottom": "Estimated measurement or ratio",
      "left": "Estimated measurement or ratio",
      "right": "Estimated measurement or ratio",
      "ratio": "e.g. 50/50"
    },
    "flaws": {
      "corners": ["List specific corner issues or empty array"],
      "edges": ["List specific edge whitening/chipping issues or empty array"],
      "surface": ["List scratches, print lines, dents or empty array"]
    }
  }
}`;

    // Model fallback sequence
    const modelsToTry = ["gemini-3.8-flash", "gemini-2.5-flash"];
    let responseText = null;
    let lastError = null;

    for (const model of modelsToTry) {
      let attempt = 1;
      while (attempt <= 2) {
        try {
          console.log(`Trying \({model} - attempt\){attempt}/2`);
          
          const response = await ai.models.generateContent({
            model: model,
            contents: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: frontBase64
                }
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: backBase64
                }
              },
              {
                text: promptText
              }
            ]
          });

          responseText = response.text();
          if (responseText) break;
        } catch (err) {
          lastError = err;
          console.error(`\({model} attempt\){attempt} failed:`, err.message);
          attempt++;
        }
      }
      if (responseText) break;
    }

    if (!responseText) {
      throw new Error(lastError ? lastError.message : 'All model attempts failed to generate a response.');
    }

    // Clean up markdown block wrappers if model outputs them anyway
    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith('```json')) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedData = JSON.parse(cleanJsonStr);
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error('OTPTCG Backend Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during analysis.' });
  }
}
