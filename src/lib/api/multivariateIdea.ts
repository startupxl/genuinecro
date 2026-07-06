export interface MultivariateIdeaRequest {
  baseIdea: string;
  pageContext: string;
  goal: string;
}

export interface MultivariateFactor {
  name: string;
  levels: string[];
}

export interface MultivariateCombination {
  label: string;
  description: string;
  rationale: string;
}

export interface MultivariateIdeaResult {
  factors: MultivariateFactor[];
  suggestedCombinations: MultivariateCombination[];
  testingNote: string;
}

export async function expandMultivariateIdea(input: MultivariateIdeaRequest): Promise<MultivariateIdeaResult> {
  const response = await fetch("/api/multivariate-idea/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Multivariate idea expansion failed");
  }

  return data.data as MultivariateIdeaResult;
}
