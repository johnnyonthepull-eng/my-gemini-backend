export default async function handler(req, res) {
  // 1. Handle CORS Preflight and Headers
  res.setHeader("Access-Control-Allow-Origin", "*"); // Change '*' to your Shopify domain in production if preferred
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 2. Ensure it's a POST request
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { frontImage, backImage } = req.body;

    if (!frontImage || !backImage) {
      return res.status(400).json({ error: "Missing front or back image data." });
    }

    // TODO: Add your Gemini API call here using frontImage and backImage base64 strings
    // Example structure of what you'll eventually return to Shopify:
    const mockAnalysisResult = {
      estimatedGrade: "PSA 9",
      centering: { front: "55/45", back: "50/50" },
      corners: "Clean, slight whitening on bottom right back",
      edges: "Near Mint",
      surface: "Clean holo surface, no scratches detected"
    };

    // 3. Send successful response back to Shopify
    return res.status(200).json(mockAnalysisResult);

  } catch (error) {
    console.error("Grading error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
