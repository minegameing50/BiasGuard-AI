export interface BiasReport {
  fairnessScore: number;
  confidence: string;
  biasTypes: {
    name: string;
    value: number;
  }[];
  explanation: string;
  suggestions: string[];
}

interface AnalyzeRequest {
  columns: string[];
  sampleData: any[];
  sensitiveCol?: string;
  targetCol?: string;
  demographicRates?: Record<string, any>;
}

export async function analyzeDatasetBias(
  columns: string[],
  sampleData: any[],
  sensitiveCol?: string,
  targetCol?: string,
  demographicRates?: Record<string, any>
): Promise<BiasReport> {
  const payload: AnalyzeRequest = {
    columns,
    sampleData,
    sensitiveCol,
    targetCol,
    demographicRates,
  };

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to generate report.');
  }

  return data as BiasReport;
}
