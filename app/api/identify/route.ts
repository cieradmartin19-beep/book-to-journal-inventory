import { NextResponse } from "next/server";

type VisionAnnotateResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    textAnnotations?: Array<{ description?: string }>;
    error?: { message?: string };
  }>;
};

function imageDataUrlToBase64(image: string) {
  return image.includes(",") ? image.split(",").pop() ?? "" : image;
}

function scoreTitleLine(line: string, index: number) {
  const clean = line.trim();
  if (!clean) return -100;
  if (/isbn|barcode|publisher|press|copyright|www\.|\.com|[$€£]|\d{4}/i.test(clean)) return -20;
  const wordCount = clean.split(/\s+/).length;
  const letterCount = (clean.match(/[A-Za-z]/g) ?? []).length;
  const uppercaseBoost = clean === clean.toUpperCase() && letterCount > 3 ? 8 : 0;
  return letterCount + wordCount * 4 + uppercaseBoost - index * 3;
}

function extractCoverText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const byLine = lines.find((line) => /^by\s+/i.test(line));
  const detectedAuthor = byLine?.replace(/^by\s+/i, "").trim() ?? "";
  const titleLine = [...lines]
    .sort((a, b) => scoreTitleLine(b, lines.indexOf(b)) - scoreTitleLine(a, lines.indexOf(a)))[0] ?? "";

  return {
    detectedTitle: titleLine,
    detectedAuthor,
    lines
  };
}

async function detectWithGoogleVision(image: string) {
  const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!key) return null;

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageDataUrlToBase64(image) },
          features: [{ type: "TEXT_DETECTION", maxResults: 1 }]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error("Google Cloud Vision OCR request failed.");
  }

  const data = (await response.json()) as VisionAnnotateResponse;
  const result = data.responses?.[0];
  if (result?.error?.message) throw new Error(result.error.message);

  const detectedText = result?.fullTextAnnotation?.text ?? result?.textAnnotations?.[0]?.description ?? "";
  const extracted = extractCoverText(detectedText);

  return {
    ...extracted,
    detectedText,
    confidence: extracted.detectedTitle ? 0.82 : 0,
    source: "google-cloud-vision"
  };
}

export async function POST(request: Request) {
  const { image } = (await request.json()) as { image?: string };

  if (!image) {
    return NextResponse.json({ error: "Cover image is required." }, { status: 400 });
  }

  try {
    const googleVision = await detectWithGoogleVision(image);
    if (googleVision) {
      return NextResponse.json({
        ...googleVision,
        message: googleVision.detectedTitle
          ? "Cover text detected. Choose the matching Google Books result or enter details manually."
          : "OCR finished, but no strong title text was detected. Manual entry is ready."
      });
    }
  } catch (error) {
    return NextResponse.json({
      detectedTitle: "",
      detectedAuthor: "",
      detectedText: "",
      confidence: 0,
      source: "google-cloud-vision",
      message: error instanceof Error ? error.message : "OCR failed. Manual entry is ready."
    });
  }

  return NextResponse.json({
    detectedTitle: "",
    detectedAuthor: "",
    detectedText: "",
    confidence: 0,
    source: "manual",
    message: "Add GOOGLE_CLOUD_VISION_API_KEY to enable cover OCR. Manual entry is ready."
  });
}
