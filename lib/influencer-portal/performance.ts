export type PerformanceInput = {
  followers: number;
  profileCompletion: number;
  assignmentCount: number;
  completedAssignments: number;
  contentCount: number;
  approvedContent: number;
  revisionRequests: number;
  publicationCount: number;
  approvedPublications: number;
};

export type PerformanceResult = {
  score: number;
  level: "Bronze" | "Silver" | "Gold" | "Platinum";
  classification: "Nano" | "Micro" | "Mid-Tier" | "Macro" | "Mega";
  progressToNext: number;
  nextLevel: "Silver" | "Gold" | "Platinum" | null;
  metrics: {
    completion: number;
    delivery: number;
    contentQuality: number;
    revisionResponse: number;
    publicationAccuracy: number;
  };
};

function ratio(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, value / total));
}

function round(value: number) {
  return Math.round(Math.min(100, Math.max(0, value)));
}

export function influencerClassification(followers: number) {
  if (followers < 10_000) return "Nano" as const;
  if (followers < 100_000) return "Micro" as const;
  if (followers < 500_000) return "Mid-Tier" as const;
  if (followers < 1_000_000) return "Macro" as const;
  return "Mega" as const;
}

export function calculateInfluencerPerformance(
  input: PerformanceInput,
): PerformanceResult {
  const completion = round(input.profileCompletion);
  const delivery = round(
    ratio(input.completedAssignments, input.assignmentCount) * 100,
  );
  const contentQuality = round(
    ratio(input.approvedContent, input.contentCount) * 100,
  );
  const revisionResponse = round(
    (1 - ratio(input.revisionRequests, Math.max(input.contentCount, 1))) * 100,
  );
  const publicationAccuracy = round(
    ratio(input.approvedPublications, input.publicationCount) * 100,
  );

  const score = round(
    completion * 0.15 +
      delivery * 0.25 +
      contentQuality * 0.25 +
      revisionResponse * 0.15 +
      publicationAccuracy * 0.2,
  );

  let level: PerformanceResult["level"] = "Bronze";
  let nextLevel: PerformanceResult["nextLevel"] = "Silver";
  let lowerBound = 0;
  let upperBound = 40;

  if (score >= 85) {
    level = "Platinum";
    nextLevel = null;
    lowerBound = 85;
    upperBound = 100;
  } else if (score >= 65) {
    level = "Gold";
    nextLevel = "Platinum";
    lowerBound = 65;
    upperBound = 85;
  } else if (score >= 40) {
    level = "Silver";
    nextLevel = "Gold";
    lowerBound = 40;
    upperBound = 65;
  }

  const progressToNext =
    nextLevel === null
      ? 100
      : round(((score - lowerBound) / (upperBound - lowerBound)) * 100);

  return {
    score,
    level,
    classification: influencerClassification(input.followers),
    progressToNext,
    nextLevel,
    metrics: {
      completion,
      delivery,
      contentQuality,
      revisionResponse,
      publicationAccuracy,
    },
  };
}
