import { describe, it, expect } from "vitest";
import { detectGA4Tag } from "./ga4TagDetection.js";

describe("detectGA4Tag", () => {
  it("detects a GA4 measurement ID from the gtag.js script src", () => {
    const html = `<html><head><script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC1234XYZ"></script></head></html>`;
    const result = detectGA4Tag(html);
    expect(result.hasGA4Tag).toBe(true);
    expect(result.measurementId).toBe("G-ABC1234XYZ");
  });

  it("detects a GA4 measurement ID from a gtag('config', ...) call", () => {
    const html = `<script>gtag('config', 'G-9988776655');</script>`;
    const result = detectGA4Tag(html);
    expect(result.hasGA4Tag).toBe(true);
    expect(result.measurementId).toBe("G-9988776655");
  });

  it("reports no GA4 tag when none is present", () => {
    const html = `<html><head><title>No analytics here</title></head></html>`;
    const result = detectGA4Tag(html);
    expect(result.hasGA4Tag).toBe(false);
    expect(result.measurementId).toBeNull();
  });

  it("detects a Google Tag Manager container separately from GA4", () => {
    const html = `<script>(function(w,d,s,l,i){})(window,document,'script','dataLayer','GTM-ABCD123');</script>`;
    const result = detectGA4Tag(html);
    expect(result.hasGTM).toBe(true);
    expect(result.gtmContainerId).toBe("GTM-ABCD123");
    expect(result.hasGA4Tag).toBe(false);
  });

  it("handles missing/empty html without throwing", () => {
    expect(detectGA4Tag("")).toEqual({ hasGA4Tag: false, measurementId: null, hasGTM: false, gtmContainerId: null });
    expect(detectGA4Tag(undefined)).toEqual({ hasGA4Tag: false, measurementId: null, hasGTM: false, gtmContainerId: null });
  });
});
