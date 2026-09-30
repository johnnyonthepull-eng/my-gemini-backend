import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") {
    throw new Error("Invalid image data.");
  }
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match || match.length !== 3) {
    throw new Error("Invalid image format. Expected a base64 data URL.");
  }
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2]
    }
  };
}

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable on Vercel." });
    }

    const body = req.body || {};
    const frontImage = body.frontImage || body.frontBase64;
    const backImage = body.backImage || body.backBase64;

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Missing front or back image data." });
    }

    const frontPart = parseDataUrl(frontImage);
    const backPart = parseDataUrl(backImage);

    const systemInstruction = `
You are an uncompromising, brutally strict professional trading card grading inspector. Your mandate is to protect collectors from ever getting a lower grade than predicted. When in doubt, you ALWAYS penalize heavily and grade down. 

BRUTAL ZERO-TOLERANCE RULES & PRINT LINE PROTOCOL:
1. Virtual Multi-Angle Lighting & Contrast Filter Simulation: Mentally apply dynamic high-contrast, directional shadow-mapping, and color-channel separation filters across the entire card surface. 
2. Print Line Hunting Mandate: Actively scan for vertical or horizontal faint lines across the foil or card stock, even those that blend into the artwork or require a specific angle to see. Treat any linear anomaly, reflection discontinuity, texture disruption, or faint streak as a definitive print line. 
3. Print Line Penalty: The moment a print line (visible or subtle) is detected, it instantly caps the PSA grade to a maximum of 8 or 9, forces BGS Surface subgrade down to 8.5 or lower, and disqualifies any Gem Mint / Pristine 10. List every detected print line explicitly under "surfaceFlaws".
4. The Gem Mint / Pristine 10 Wall: A grade of 10 is impossible if any defect exists. Any back or front edge whitening, hairline scratch, or print line instantly kills the 10.
5. Company Specific Strictness:
   - PSA: Brutally strict on rear centering, back edge chipping, and surface print lines. No subgrades mean one flaw brings down the whole score.
   - BGS (Beckett): Independent subgrades must be flawless for any 10. 
     * BLACK LABEL POTENTIAL: Only populate "blackLabelPotential" with "Black Label Potential" if EVERY SINGLE ONE of the four BGS subgrades is an absolute 10.
   - Ace: Apply strict modern standards with zero margin for error.
6. Conservative Fallback: If you are torn between two grades, ALWAYS choose the lower grade.

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction,
    });

    const result = await model.generateContent([
      "Execute strict card grading inspection and output valid JSON.",
      frontPart,
      backPart
    ]);

    const response = await result.response;
    let text = response.text();
    
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    if (text.startsWith("```json")) {
      text = text.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (text.startsWith("```")) {
      text = text.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const jsonResult = JSON.parse(text);
    return res.status(200).json(jsonResult);

  } catch (error) {
    console.error("Full server grading error:", error);
    return res.status(500).json({ error: error?.message || "Internal server error." });
  }
}
