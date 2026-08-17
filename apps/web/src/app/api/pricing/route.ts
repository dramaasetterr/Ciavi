import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { PricingInput, PricingResult } from "@/shared";
import { json, OPTIONS } from "../_cors";

export { OPTIONS };

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
}

const anthropic = new Anthropic();

const PRICING_MODEL = "claude-opus-5";
const PRICING_FALLBACK_MODEL = "claude-sonnet-5";
const MAX_PHOTOS_TO_ANALYZE = 8;

function buildPropertySummary(input: PricingInput): string {
  const lines: string[] = [];
  const age = new Date().getFullYear() - input.year_built;

  lines.push(`Address: ${input.address}`);
  if (input.property_type) lines.push(`Property Type: ${input.property_type.replace(/_/g, " ")}`);
  lines.push(`Above-grade Living Area: ${input.sqft.toLocaleString()} sqft`);

  if (input.finished_basement_sqft && input.finished_basement_sqft > 0) {
    const aduNote = input.basement_is_adu
      ? " — finished as a full ADU / mother-in-law suite (separate living, kitchen, bath)"
      : " — finished living space";
    lines.push(
      `Finished Basement: ${input.finished_basement_sqft.toLocaleString()} sqft${aduNote}`
    );
    const totalLivable = input.sqft + input.finished_basement_sqft;
    lines.push(
      `Total Livable Space (above grade + finished basement): ${totalLivable.toLocaleString()} sqft`
    );
  }

  lines.push(`Bedrooms: ${input.bedrooms}`);
  lines.push(`Bathrooms: ${input.bathrooms}`);
  lines.push(`Year Built: ${input.year_built} (${age} years old)`);
  lines.push(`Owner-reported Condition: ${input.condition}`);

  if (input.lot_size_sqft && input.lot_size_sqft > 0) {
    const acres = input.lot_size_sqft / 43560;
    lines.push(
      `Lot Size: ${input.lot_size_sqft.toLocaleString()} sqft (${acres.toFixed(2)} acres)`
    );
  }

  if (input.garage_spaces && input.garage_spaces > 0) {
    lines.push(`Garage: ${input.garage_spaces}-car enclosed`);
  }
  if (input.parking_spaces && input.parking_spaces > 0) {
    lines.push(
      `Additional Parking: ${input.parking_spaces} driveway/lot spaces beyond garage`
    );
  }

  if (input.pool_type && input.pool_type !== "none") {
    const poolLabel = input.pool_type.replace(/_/g, " ");
    const features =
      input.pool_features && input.pool_features.length > 0
        ? `, ${input.pool_features.map((f) => f.replace(/_/g, " ")).join(", ")}`
        : "";
    const spa = input.pool_has_spa ? " with attached spa/hot tub" : "";
    lines.push(`Pool: ${poolLabel}${features}${spa}`);
  }

  if (input.premium_finishes && input.premium_finishes.length > 0) {
    lines.push(
      `Premium Interior Features: ${input.premium_finishes
        .map((f) => f.replace(/_/g, " "))
        .join(", ")}`
    );
  }

  if (input.outdoor_features && input.outdoor_features.length > 0) {
    lines.push(
      `Outdoor Features: ${input.outdoor_features
        .map((f) => f.replace(/_/g, " "))
        .join(", ")}`
    );
  }

  if (input.features && input.features.trim().length > 0) {
    lines.push(`Additional owner-described features: ${input.features.trim()}`);
  }

  if (input.recent_appraisal_value && input.recent_appraisal_value > 0) {
    const dateNote = input.recent_appraisal_date
      ? ` (dated ${input.recent_appraisal_date})`
      : "";
    lines.push(
      `Recent Professional Appraisal: $${input.recent_appraisal_value.toLocaleString()}${dateNote} — treat as a strong anchor, but consider post-appraisal improvements and current market conditions.`
    );
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are an elite US residential real estate appraiser and pricing strategist.

You help For-Sale-By-Owner (FSBO) sellers price their homes at top dollar — replacing the role a traditional listing agent plays. Your analysis must be rigorous, locally-aware, and honest.

Core principles:
- Never use a one-size-fits-all price-per-square-foot. Anchor to the specific submarket (city, neighborhood, ZIP) and adjust for the property's unique profile.
- Finished basements and ADUs add real livable value — but not at the same $/sqft as above-grade space. Weigh them based on ceiling height, quality of finish, independent utilities, and whether they'd show up in comparable sales.
- Luxury amenities (saltwater heated pools, outdoor kitchens, ADUs, acreage, extensive landscaping, premium finishes) meaningfully compound in certain markets — especially when they help the home stand out in the top 10-20% of its neighborhood.
- Trust a recent professional appraisal as an anchor, but do not under-price improvements made after the appraisal.
- When photos are provided, use them to judge true quality tier, condition, finish level, and curb appeal — things that text cannot fully convey.
- Mentally perform comparable-sales analysis: think about what comparable homes in the same city/ZIP have sold for recently (through early 2026), adjusting for bed/bath/sqft/lot/condition/amenity differences.
- Price to the current 2026 US housing market conditions for the specific region.

Output: 3 price points (sell-fast, recommended, maximize) plus specific reasoning. No hedging, no disclaimers, no generic advice. Be concrete about comps and $/sqft figures used.`;

function userPromptFor(input: PricingInput, hasPhotos: boolean): string {
  return `Price the following property. Your goal is to help the owner sell at top dollar.

${buildPropertySummary(input)}
${hasPhotos ? `\nThe owner has attached ${Math.min(input.photos!.length, MAX_PHOTOS_TO_ANALYZE)} property photos. Examine them carefully for finish quality, condition, curb appeal, outdoor amenities, and anything that affects market value beyond the text description.` : ""}

Return ONLY a JSON object, no markdown, no prose before or after, exactly this shape:
{
  "recommended_price": <integer — your best list price, rounded to nearest $1,000>,
  "sell_fast_price": <integer — price for a quick sale, typically ~5-8% below recommended, rounded to nearest $1,000>,
  "maximize_price": <integer — top-of-market price for a patient seller, typically ~5-10% above recommended, rounded to nearest $1,000>,
  "summary": <string — 1-2 sentence executive summary of the valuation>,
  "reasoning": [
    <string — comparable sales context: cite specific $/sqft figures and comp adjustments you used for this submarket>,
    <string — how above-grade square footage and finished basement / ADU contribute to total livable value>,
    <string — lot, parking, pool, and outdoor amenity premiums specific to this market>,
    <string — condition, premium finishes, and what the photos reveal about the true quality tier (omit photo mention if no photos)>,
    <string — pricing strategy: why the recommended price hits the sweet spot vs. sell-fast and maximize>
  ],
  "comps": [
    <string — short description of a comparable that supports this valuation>,
    <string — another comparable>,
    <string — another comparable>
  ]
}

Be specific. Cite neighborhood, cite $/sqft you're anchoring to, cite concrete amenity premiums in dollar terms. If a recent appraisal is provided, explain how your number relates to it.`;
}

function parsePricing(text: string): PricingResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  const parsed = JSON.parse(cleaned);

  const recommended = Math.round(Number(parsed.recommended_price));
  const sellFast = Math.round(Number(parsed.sell_fast_price));
  const maximize = Math.round(Number(parsed.maximize_price));

  if (
    !Number.isFinite(recommended) ||
    !Number.isFinite(sellFast) ||
    !Number.isFinite(maximize) ||
    recommended <= 0 ||
    sellFast <= 0 ||
    maximize <= 0
  ) {
    throw new Error("Model returned invalid price values");
  }

  const reasoning = Array.isArray(parsed.reasoning)
    ? parsed.reasoning.filter((r: unknown) => typeof r === "string" && r.length > 0)
    : [];
  if (reasoning.length === 0) {
    throw new Error("Model returned no reasoning");
  }

  const comps = Array.isArray(parsed.comps)
    ? parsed.comps.filter((c: unknown) => typeof c === "string" && c.length > 0)
    : undefined;

  return {
    recommended_price: recommended,
    sell_fast_price: sellFast,
    maximize_price: maximize,
    reasoning,
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    comps,
  };
}

async function buildContentBlocks(
  input: PricingInput,
  hasPhotos: boolean
): Promise<Anthropic.ContentBlockParam[]> {
  const blocks: Anthropic.ContentBlockParam[] = [
    { type: "text", text: userPromptFor(input, hasPhotos) },
  ];

  if (hasPhotos && input.photos) {
    const photosToUse = input.photos.slice(0, MAX_PHOTOS_TO_ANALYZE);
    for (const url of photosToUse) {
      if (typeof url === "string" && /^https?:\/\//i.test(url)) {
        blocks.push({
          type: "image",
          source: { type: "url", url },
        });
      }
    }
  }

  return blocks;
}

async function callModel(
  model: string,
  content: Anthropic.ContentBlockParam[]
): Promise<PricingResult> {
  const message = await anthropic.messages.create({
    model,
    max_tokens: 8000,
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Model response contained no text block");
  }

  return parsePricing(textBlock.text);
}

export async function POST(request: NextRequest) {
  let input: PricingInput;
  try {
    input = (await request.json()) as PricingInput;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (
    !input?.address ||
    !input?.sqft ||
    !input?.bedrooms ||
    !input?.bathrooms ||
    !input?.year_built ||
    !input?.condition
  ) {
    return json(
      { error: "Missing required fields: address, sqft, bedrooms, bathrooms, year_built, condition" },
      400
    );
  }

  const hasPhotos =
    Array.isArray(input.photos) &&
    input.photos.length > 0 &&
    input.photos.some((u) => typeof u === "string" && /^https?:\/\//i.test(u));

  const content = await buildContentBlocks(input, hasPhotos);

  try {
    const result = await callModel(PRICING_MODEL, content);
    return json(result);
  } catch (primaryErr) {
    try {
      const result = await callModel(PRICING_FALLBACK_MODEL, content);
      return json(result);
    } catch {
      // Photos are the most common failure cause (bad URLs, unsupported
      // formats, oversized files) — retry once on text alone rather than
      // failing the whole valuation.
      if (hasPhotos) {
        try {
          const textOnly = await buildContentBlocks(input, false);
          const result = await callModel(PRICING_MODEL, textOnly);
          return json({
            ...result,
            photo_warning:
              "Your photos could not be analyzed, so this valuation is based on the property details only.",
          });
        } catch {
          // fall through to the error response
        }
      }
      return json(
        {
          error:
            "The pricing engine is temporarily unavailable. Please try again in a moment.",
        },
        503
      );
    }
  }
}
