export interface TestBriefRequest {
  hypothesis: string;
  page: string;
  goal: string;
  context: string;
}

export interface TestBriefVariant {
  name: string;
  description: string;
}

export interface TestBriefResult {
  problemStatement: string;
  hypothesis: string;
  successMetric: string;
  secondaryMetrics: string[];
  variants: TestBriefVariant[];
  audienceAndSplit: string;
  estimatedDuration: string;
  risks: string[];
}

export async function generateTestBrief(input: TestBriefRequest): Promise<TestBriefResult> {
  const response = await fetch("/api/test-brief/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Test brief generation failed");
  }

  return data.data as TestBriefResult;
}
