import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { assertAdmin } from '../_shared/assert-admin.ts';
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase-client.ts';
import { GoogleGenerativeAI, SchemaType } from 'https://esm.sh/@google/generative-ai@0.24';

type MedicationGenerationResponse = {
  title: string;
  description: string;
  category: string;
  keyInfo: string[];
  nhsLink: string;
  trendLinks: { title: string; url: string }[];
  sickDaysNeeded: boolean;
};

const GEMINI_MODEL = 'gemini-2.5-flash';

const medicationGenerationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: 'Short patient-friendly title for the medication card.' },
    description: { type: SchemaType.STRING, description: 'Two to three sentence patient-friendly overview.' },
    category: { type: SchemaType.STRING, description: 'Clinical category such as Diabetes, Dermatology, Cardiovascular.' },
    keyInfo: { type: SchemaType.ARRAY, description: 'Three to five short safety or usage points.', items: { type: SchemaType.STRING } },
    nhsLink: { type: SchemaType.STRING, description: 'An official NHS link if known, otherwise an empty string.' },
    trendLinks: {
      type: SchemaType.ARRAY,
      description: 'Optional supporting leaflet links. Use an empty array if unsure.',
      items: {
        type: SchemaType.OBJECT,
        properties: { title: { type: SchemaType.STRING }, url: { type: SchemaType.STRING } },
        required: ['title', 'url'],
      },
    },
    sickDaysNeeded: { type: SchemaType.BOOLEAN, description: 'True when this medication typically needs sick day rule advice.' },
  },
  required: ['title', 'description', 'category', 'keyInfo', 'nhsLink', 'trendLinks', 'sickDaysNeeded'],
};

function extractMedicationPayload(raw: string): MedicationGenerationResponse {
  let parsed: Partial<MedicationGenerationResponse>;
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    parsed = JSON.parse(cleaned);
  } catch (err) {
    try {
      const singleLine = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').replace(/\n/g, ' ');
      parsed = JSON.parse(singleLine);
    } catch {
      throw new Error(`AI response was likely truncated. Please try again. (Details: ${err instanceof Error ? err.message : 'Parse error'})`);
    }
  }

  return {
    title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
    description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
    category: typeof parsed.category === 'string' ? parsed.category.trim() : '',
    keyInfo: Array.isArray(parsed.keyInfo)
      ? parsed.keyInfo.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 5)
      : [],
    nhsLink: typeof parsed.nhsLink === 'string' ? parsed.nhsLink.trim() : '',
    trendLinks: Array.isArray(parsed.trendLinks)
      ? parsed.trendLinks
          .filter((item): item is { title: string; url: string } =>
            !!item && typeof item.title === 'string' && item.title.trim().length > 0 &&
            typeof item.url === 'string' && item.url.trim().length > 0)
          .slice(0, 4)
      : [],
    sickDaysNeeded: Boolean(parsed.sickDaysNeeded),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await assertAdmin(req.headers.get('Authorization'));

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return errorResponse('Gemini API key is not configured.', 500);
    }

    const { medicationName, type } = await req.json();
    const medType = type === 'REAUTH' ? 'REAUTH' : 'NEW';

    if (!medicationName || typeof medicationName !== 'string') {
      return errorResponse('Medication name is required');
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: medicationGenerationSchema,
      },
    });

    const prompt = `
You are generating concise NHS-style draft content for a clinician-admin medication information card.

Medication name: ${medicationName.trim()}
Card type: ${medType === 'NEW' ? 'Starting treatment' : 'Yearly reauthorisation review'}

Rules:
- Return JSON only. Ensure the output is strictly valid and well-formed JSON.
- Do NOT use unescaped newlines or line breaks inside string values.
- Make the content suitable for UK patients in plain English.
- Aim for an average UK reading age of about 9 to 11 years old.
- Use short sentences, everyday words, and short paragraphs.
- Avoid jargon and technical terms where possible. If a medical term is useful, explain it in simpler words.
- Prefer the plain English term first, then the medical term only if it helps understanding.
- title should include the medication name and whether it is starting treatment or reauthorisation.
- Keep the title clean and concise. Do not repeat example medicines or suffix explanations in the title.
- Do not include internal codes or admin-only terminology in the title or description.
- If the medication is a drug family or class rather than a single brand or generic medicine, make the title more recognisable with patient-friendly wording, but keep examples out of the title.
- Put recognisable examples or naming patterns in the description only, for example "such as gliclazide or glimepiride" or "many names end in -gliflozin".
- Prefer patient-friendly wording over abstract class labels on their own.
- description should be 2 to 3 short sentences.
- keyInfo should contain 3 to 5 short bullet-style points.
- If you are not confident of an NHS URL, set nhsLink to an empty string.
- If you are not confident of extra leaflet URLs, return trendLinks as an empty array.
- sickDaysNeeded should be true only when sick day rule advice is commonly relevant.
`;

    const result = await model.generateContent(prompt);
    const content = extractMedicationPayload(result.response.text());

    if (!content.title || !content.description || !content.category || content.keyInfo.length === 0) {
      return errorResponse('Incomplete AI response', 500);
    }

    return jsonResponse({ success: true, content });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
