export interface VariantCopyRequest {
  category: string;
  title: string;
  description: string;
  fix: string;
}

export interface CopyVariant {
  label: string;
  copy: string;
  rationale: string;
}

export interface VariantCopyResult {
  variants: CopyVariant[];
}

export async function generateVariantCopy(input: VariantCopyRequest): Promise<VariantCopyResult> {
  const response = await fetch("/api/variant-copy/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Variant copy generation failed");
  }

  return data.data as VariantCopyResult;
}
