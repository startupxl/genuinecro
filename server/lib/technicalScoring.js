function buildLinkIssues(linkResults) {
  const total = linkResults.length;
  if (total === 0) {
    return { linkScore: 30, issues: [], summary: { total: 0, ok: 0, broken: 0, redirectChains: 0 } };
  }

  const broken = linkResults.filter((r) => r.status === "broken");
  const redirectChains = linkResults.filter((r) => r.status === "redirect-chain");
  const ok = total - broken.length - redirectChains.length;

  const linkScore = Math.round(30 * (ok / total));
  const pointsLost = 30 - linkScore;
  const flagged = [...broken, ...redirectChains];
  const perIssue = flagged.length > 0 ? Math.max(1, Math.round(pointsLost / flagged.length)) : 0;

  const issues = flagged.map((link) => ({
    category: "technical-seo",
    severity: "low",
    title: link.status === "broken" ? `Broken link: ${link.url}` : `Redirect chain: ${link.url}`,
    description:
      link.status === "broken"
        ? `This link returned ${link.finalStatus ?? "no response"} after ${link.hops} redirect${link.hops === 1 ? "" : "s"}.`
        : `This link redirects ${link.hops} time${link.hops === 1 ? "" : "s"} before resolving.`,
    fix: link.status === "broken" ? "Update or remove this link." : "Point this link directly at its final destination.",
    impactScore: perIssue,
  }));

  return { linkScore, issues, summary: { total, ok, broken: broken.length, redirectChains: redirectChains.length } };
}

export function computeTechnicalScore({ canonical, indexability, robotsTxt, sitemap, linkResults }) {
  const issues = [];

  const canonicalScore = canonical.present ? 20 : 0;
  if (!canonical.present) {
    issues.push({
      category: "technical-seo",
      severity: "high",
      title: "Missing canonical tag",
      description: "This page has no <link rel=\"canonical\"> tag, which can lead to duplicate-content issues.",
      fix: "Add a self-referential canonical tag to the page's <head>.",
      impactScore: 20,
    });
  }

  const indexabilityScore = indexability.indexable ? 20 : 0;
  if (!indexability.indexable) {
    issues.push({
      category: "technical-seo",
      severity: "high",
      title: "Page is not indexable",
      description: indexability.reason,
      fix: "Remove the noindex directive if this page should appear in search results.",
      impactScore: 20,
    });
  }

  const robotsScore = robotsTxt.exists && robotsTxt.valid ? 15 : 0;
  if (robotsScore === 0) {
    issues.push({
      category: "technical-seo",
      severity: "med",
      title: "robots.txt missing or invalid",
      description: robotsTxt.issue || "robots.txt could not be validated.",
      fix: "Add a valid robots.txt file at your site's root.",
      impactScore: 15,
    });
  }

  const sitemapScore = sitemap.exists && sitemap.valid ? 15 : 0;
  if (sitemapScore === 0) {
    issues.push({
      category: "technical-seo",
      severity: "med",
      title: "sitemap.xml missing or invalid",
      description: sitemap.issue || "sitemap.xml could not be validated.",
      fix: "Add a valid sitemap.xml file at your site's root and submit it to search engines.",
      impactScore: 15,
    });
  }

  const { linkScore, issues: linkIssues, summary: linkSummary } = buildLinkIssues(linkResults);
  issues.push(...linkIssues);

  const score = canonicalScore + indexabilityScore + robotsScore + sitemapScore + linkScore;

  return { score, issues, linkSummary };
}
