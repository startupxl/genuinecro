export interface MessageMatchResult {
  url: string;
  sourceMessage: string;
  matchScore: number;
  verdict: string;
  pageHeadline: string;
  alignedElements: string[];
  misalignedElements: string[];
  recommendations: string[];
}

export async function checkMessageMatch(url: string, sourceMessage: string): Promise<MessageMatchResult> {
  const response = await fetch("/api/message-match/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, sourceMessage }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Message match check failed");
  }

  return data.data as MessageMatchResult;
}
