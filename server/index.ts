import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Schema, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: '2mb' }));

function requireGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Server is missing GEMINI_API_KEY.');
  }

  return new GoogleGenAI({ apiKey });
}

const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';

function isRetryableRateLimit(error: any) {
  return error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
}

function isModelUnavailable(error: any) {
  return error?.status === 403 || error?.status === 404 || error?.message?.includes('permission') || error?.message?.includes('not found');
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(ai: GoogleGenAI, model: string, contents: string, config: object, attempts = 3) {
  let lastError: any;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config,
      });
    } catch (error: any) {
      lastError = error;
      if (!isRetryableRateLimit(error) || attempt === attempts) {
        throw error;
      }

      await wait(1000 * attempt);
    }
  }

  throw lastError;
}

function buildSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      fairnessScore: {
        type: Type.INTEGER,
        description: 'Estimated fairness score (0-100). Higher means more fair.',
      },
      confidence: {
        type: Type.STRING,
        description: "Confidence level of this analysis result (e.g., 'High (85%)')",
      },
      biasTypes: {
        type: Type.ARRAY,
        description: 'List of detected bias types and their risk values.',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Type of bias (e.g., 'Gender Bias')" },
            value: { type: Type.INTEGER, description: 'Impact or risk out of 100' },
          },
          required: ['name', 'value'],
        },
      },
      explanation: {
        type: Type.STRING,
        description: 'Explanation in simple terms.',
      },
      suggestions: {
        type: Type.ARRAY,
        description: 'Actionable suggestions to fix bias.',
        items: { type: Type.STRING },
      },
    },
    required: ['fairnessScore', 'confidence', 'biasTypes', 'explanation', 'suggestions'],
  };
}

function buildPrompt(
  columns: string[],
  sampleData: any[],
  sensitiveCol?: string,
  targetCol?: string,
  demographicRates?: Record<string, any>,
) {
  const trimmedSampleData = sampleData.slice(0, 250);
  const condensedRates = demographicRates
    ? Object.fromEntries(
        Object.entries(demographicRates).map(([group, data]) => [
          group,
          {
            total: (data as any).total,
            outcomes: (data as any).outcomes,
          },
        ]),
      )
    : undefined;

  let prompt = `Analyze the dataset for bias.

Return:
1. Fairness score (0-100)
2. Confidence level (e.g., "High (85%)")
3. Types of bias (gender, age, etc.) and assign an estimated risk value (0-100) for each.
4. Explanation in simple terms, citing any statistical differences seen.
5. Suggestions to fix bias.

Columns: ${columns.join(', ')}
`;

  if (sensitiveCol) prompt += `Sensitive Feature: ${sensitiveCol}\n`;
  if (targetCol) prompt += `Target Outcome: ${targetCol}\n`;
  if (condensedRates) prompt += `Computed Demographic Outcome Rates (True Statistical Data): ${JSON.stringify(condensedRates)}\n`;

  prompt += `
Sample Data (JSON ${trimmedSampleData.length} rows): ${JSON.stringify(trimmedSampleData)}

Keep output structured and short.`;

  return prompt;
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { columns, sampleData, sensitiveCol, targetCol, demographicRates } = req.body ?? {};

    if (!Array.isArray(columns) || !Array.isArray(sampleData)) {
      return res.status(400).json({ error: 'Invalid analysis payload.' });
    }

    const ai = requireGeminiClient();
    const prompt = buildPrompt(columns, sampleData, sensitiveCol, targetCol, demographicRates);
    const config = {
      responseMimeType: 'application/json',
      responseSchema: buildSchema(),
      temperature: 0.0,
    };

    let response;
    try {
      response = await generateWithRetry(ai, PRIMARY_MODEL, prompt, config);
    } catch (error: any) {
      if (isRetryableRateLimit(error) || isModelUnavailable(error)) {
        console.warn(`Primary model ${PRIMARY_MODEL} unavailable or rate-limited. Falling back to ${FALLBACK_MODEL}...`);
        response = await generateWithRetry(ai, FALLBACK_MODEL, prompt, config);
      } else {
        throw error;
      }
    }

    if (!response?.text) {
      return res.status(502).json({ error: 'Empty response from Gemini.' });
    }

    return res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error('Bias analysis failed', error);
    const message =
      error?.status === 429
        ? 'Google AI rate limit reached. Please wait and try again.'
        : error?.message || 'Failed to generate report.';
    return res.status(500).json({ error: message });
  }
});

async function start() {
  if (isProduction) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`BiasGuard server listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
