import { NextResponse } from "next/server";

type VisionAnnotateResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string; pages?: Array<{ confidence?: number }> };
    textAnnotations?: Array<{ description?: string }>;
    error?: { message?: string };
  }>;
};

const OCR_LOG_PREFIX = "[cover-ocr-debug]";
const GOOGLE_VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly details: {
      status?: number;
      statusText?: string;
      responseBody?: string;
    } = {}
  ) {
    super(message);
    this.name = "ApiResponseError";
  }
}

function imageDataUrlToBase64(image: string) {
  return image.includes(",") ? image.split(",").pop() ?? "" : image;
}

function scoreTitleLine(line: string, index: number) {
  const clean = line.trim();
  if (!clean) return -100;
  if (/isbn|barcode|publisher|press|copyright|www\.|\.com|[$€£]/i.test(clean)) return -40;
  if (/^\d+$/.test(clean)) return -60;
  if (/^\d{4}$/.test(clean)) return -25;
  const wordCount = clean.split(/\s+/).length;
  const letterCount = (clean.match(/[A-Za-z]/g) ?? []).length;
  const uppercaseBoost = clean === clean.toUpperCase() && letterCount > 3 ? 8 : 0;
  return letterCount + wordCount * 4 + uppercaseBoost - index * 3;
}

function cleanIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function isLikelyIsbn(value: string) {
  const clean = cleanIsbn(value);
  return clean.length === 10 || (clean.length === 13 && /^(978|979)/.test(clean));
}

function extractIsbn(text: string) {
  const labeledMatch = text.match(/ISBN(?:-1[03])?:?\s*([0-9Xx][0-9Xx\-\s]{8,24}[0-9Xx])/i);
  if (labeledMatch?.[1] && isLikelyIsbn(labeledMatch[1])) return cleanIsbn(labeledMatch[1]);

  const candidates = text.match(/(?:978|979)[\d\-\s]{10,20}/g) ?? [];
  for (const candidate of candidates) {
    const clean = cleanIsbn(candidate);
    if (isLikelyIsbn(clean)) return clean;
  }

  return "";
}

function extractAuthor(lines: string[]) {
  const authorLine = lines.find((line) => /^(by|author|written by|illustrated by)\b/i.test(line));
  if (!authorLine) return "";
  return authorLine.replace(/^(by|author:?|written by|illustrated by)\s+/i, "").trim();
}

function extractCoverText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const detectedAuthor = extractAuthor(lines);
  const detectedIsbn = extractIsbn(text);
  const titleLine = [...lines]
    .sort((a, b) => scoreTitleLine(b, lines.indexOf(b)) - scoreTitleLine(a, lines.indexOf(a)))[0] ?? "";
  const titleScore = titleLine ? scoreTitleLine(titleLine, lines.indexOf(titleLine)) : 0;

  return {
    detectedTitle: titleLine,
    detectedAuthor,
    detectedIsbn,
    titleScore,
    lines
  };
}

async function detectWithGoogleVision(image: string) {
  const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  console.log(`${OCR_LOG_PREFIX} request received`, {
    hasApiKey: Boolean(key),
    keyLength: key?.length ?? 0,
    imageChars: image.length
  });
  if (!key) return null;

  console.log(`${OCR_LOG_PREFIX} Vision endpoint`, {
    endpoint: GOOGLE_VISION_ENDPOINT,
    usesKeyQueryParam: true
  });

  const response = await fetch(`${GOOGLE_VISION_ENDPOINT}?key=${key}`, {
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
    const detail = await response.text().catch(() => "");
    console.error(`${OCR_LOG_PREFIX} Google Vision HTTP error`, {
      status: response.status,
      statusText: response.statusText,
      responseBody: detail
    });
    throw new ApiResponseError(
      `Google Cloud Vision OCR request failed (${response.status} ${response.statusText}). ${detail}`,
      {
        status: response.status,
        statusText: response.statusText,
        responseBody: detail
      }
    );
  }

  const data = (await response.json()) as VisionAnnotateResponse;
  const result = data.responses?.[0];
  if (result?.error?.message) {
    console.error(`${OCR_LOG_PREFIX} Google Vision API error`, result.error.message);
    throw new ApiResponseError(result.error.message, {
      responseBody: JSON.stringify(result.error)
    });
  }

  const detectedText = result?.fullTextAnnotation?.text ?? result?.textAnnotations?.[0]?.description ?? "";
  const extracted = extractCoverText(detectedText);
  const pageConfidences = result?.fullTextAnnotation?.pages?.map((page) => page.confidence ?? 0).filter(Boolean) ?? [];
  const averageConfidence = pageConfidences.length
    ? pageConfidences.reduce((sum, confidence) => sum + confidence, 0) / pageConfidences.length
    : extracted.detectedTitle
      ? 0.82
      : 0;

  console.log(`${OCR_LOG_PREFIX} OCR text returned by Google Vision`, {
    textLength: detectedText.length,
    lineCount: extracted.lines.length,
    detectedTitle: extracted.detectedTitle,
    detectedAuthor: extracted.detectedAuthor,
    detectedIsbn: extracted.detectedIsbn,
    confidence: averageConfidence,
    text: detectedText
  });

  return {
    ...extracted,
    detectedText,
    confidence: averageConfidence,
    source: "google-cloud-vision",
    debug: {
      hasApiKey: true,
      textLength: detectedText.length,
      lineCount: extracted.lines.length,
      lines: extracted.lines.slice(0, 12),
      titleScore: extracted.titleScore,
      detectedIsbn: extracted.detectedIsbn
    }
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
    const message = error instanceof Error ? error.message : "OCR failed. Manual entry is ready.";
    const responseBody = error instanceof ApiResponseError ? error.details.responseBody : "";
    console.error(`${OCR_LOG_PREFIX} OCR route error`, {
      message,
      responseBody
    });
    return NextResponse.json({
      detectedTitle: "",
      detectedAuthor: "",
      detectedIsbn: "",
      detectedText: "",
      confidence: 0,
      source: "google-cloud-vision",
      message,
      debug: {
        hasApiKey: Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY),
        error: responseBody || message,
        status: error instanceof ApiResponseError ? error.details.status : undefined,
        statusText: error instanceof ApiResponseError ? error.details.statusText : undefined
      }
    });
  }

  return NextResponse.json({
    detectedTitle: "",
    detectedAuthor: "",
    detectedIsbn: "",
    detectedText: "",
    confidence: 0,
    source: "missing-google-cloud-vision-key",
    message: "Add GOOGLE_CLOUD_VISION_API_KEY to enable cover OCR. Manual entry is ready.",
    debug: {
      hasApiKey: false
    }
  });
}
