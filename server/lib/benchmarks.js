import { doc, runTransaction } from "firebase/firestore";
import { serverDb, ensureServerSignedIn } from "../firebaseServerAuth.js";

const MAX_SAMPLES = 200;

export function computeBenchmarkStats(samples) {
  if (!samples || samples.length === 0) return null;

  const sorted = [...samples].sort((a, b) => a - b);
  const accountAvg = Math.round(sorted.reduce((sum, n) => sum + n, 0) / sorted.length);
  const topQuartileIndex = Math.round((sorted.length - 1) * 0.75);

  return { accountAvg, topQuartile: sorted[topQuartileIndex], sampleCount: sorted.length };
}

export async function recordCategoryScores(categoryScores) {
  await ensureServerSignedIn();

  await Promise.all(
    Object.entries(categoryScores).map(([category, score]) =>
      runTransaction(serverDb, async (tx) => {
        const ref = doc(serverDb, "benchmarks", category);
        const snap = await tx.get(ref);
        const existing = snap.exists() ? snap.data().samples || [] : [];
        const samples = [...existing, score].slice(-MAX_SAMPLES);
        tx.set(ref, { samples, updatedAt: new Date().toISOString() });
      })
    )
  );
}
