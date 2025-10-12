import { describe, expect, it } from "vitest";
import {
  PRO_FEATURES,
  PRO_FEATURE_IDS,
  getProFeatureById,
  getProFeatureDescriptions,
  getProFeatureTitles,
} from "../pro-features";

describe("PRO_FEATURES", () => {
  it("should have exactly 5 features", () => {
    expect(PRO_FEATURES).toHaveLength(5);
  });

  it("should have all required Pro features", () => {
    const featureIds = PRO_FEATURES.map((f) => f.id);
    expect(featureIds).toContain("increased-limits");
    expect(featureIds).toContain("message-templates");
    expect(featureIds).toContain("configurable-threshold");
    expect(featureIds).toContain("audit-logs");
    expect(featureIds).toContain("priority-support");
  });

  it("should have valid structure for each feature", () => {
    PRO_FEATURES.forEach((feature) => {
      expect(feature).toHaveProperty("id");
      expect(feature).toHaveProperty("title");
      expect(feature).toHaveProperty("description");
      expect(typeof feature.id).toBe("string");
      expect(typeof feature.title).toBe("string");
      expect(typeof feature.description).toBe("string");
      expect(feature.id.length).toBeGreaterThan(0);
      expect(feature.title.length).toBeGreaterThan(0);
      expect(feature.description.length).toBeGreaterThan(0);
    });
  });

  it("should have optional features array", () => {
    PRO_FEATURES.forEach((feature) => {
      if (feature.features) {
        expect(Array.isArray(feature.features)).toBe(true);
        expect(feature.features.length).toBeGreaterThan(0);
      }
    });
  });

  it("should have features array for message-templates", () => {
    const templatesFeature = PRO_FEATURES.find(
      (f) => f.id === "message-templates",
    );
    expect(templatesFeature).toBeDefined();
    expect(templatesFeature?.features).toBeDefined();
    expect(templatesFeature?.features?.length).toBe(7);
  });

  it("should have features array for audit-logs", () => {
    const auditFeature = PRO_FEATURES.find((f) => f.id === "audit-logs");
    expect(auditFeature).toBeDefined();
    expect(auditFeature?.features).toBeDefined();
    expect(auditFeature?.features?.length).toBeGreaterThan(0);
  });
});

describe("PRO_FEATURE_IDS", () => {
  it("should have constants for all feature IDs", () => {
    expect(PRO_FEATURE_IDS.INCREASED_LIMITS).toBe("increased-limits");
    expect(PRO_FEATURE_IDS.MESSAGE_TEMPLATES).toBe("message-templates");
    expect(PRO_FEATURE_IDS.CONFIGURABLE_THRESHOLD).toBe(
      "configurable-threshold",
    );
    expect(PRO_FEATURE_IDS.AUDIT_LOGS).toBe("audit-logs");
    expect(PRO_FEATURE_IDS.PRIORITY_SUPPORT).toBe("priority-support");
  });

  it("should match actual feature IDs in PRO_FEATURES", () => {
    const actualIds = PRO_FEATURES.map((f) => f.id);
    const constantIds = Object.values(PRO_FEATURE_IDS);
    constantIds.forEach((id) => {
      expect(actualIds).toContain(id);
    });
  });
});

describe("getProFeatureById", () => {
  it("should return feature when ID exists", () => {
    const feature = getProFeatureById("message-templates");
    expect(feature).toBeDefined();
    expect(feature?.id).toBe("message-templates");
    expect(feature?.title).toBe("Message Templates");
  });

  it("should return undefined when ID does not exist", () => {
    const feature = getProFeatureById("non-existent-feature");
    expect(feature).toBeUndefined();
  });

  it("should return all features by their IDs", () => {
    PRO_FEATURES.forEach((expectedFeature) => {
      const feature = getProFeatureById(expectedFeature.id);
      expect(feature).toEqual(expectedFeature);
    });
  });
});

describe("getProFeatureTitles", () => {
  it("should return array of all feature titles", () => {
    const titles = getProFeatureTitles();
    expect(titles).toHaveLength(5);
    expect(titles).toContain("Increased Capacity");
    expect(titles).toContain("Message Templates");
    expect(titles).toContain("Configurable Security");
    expect(titles).toContain("Comprehensive Audit Logs");
    expect(titles).toContain("Priority Email Support");
  });

  it("should return titles in same order as PRO_FEATURES", () => {
    const titles = getProFeatureTitles();
    const expectedTitles = PRO_FEATURES.map((f) => f.title);
    expect(titles).toEqual(expectedTitles);
  });
});

describe("getProFeatureDescriptions", () => {
  it("should return array of all feature descriptions", () => {
    const descriptions = getProFeatureDescriptions();
    expect(descriptions).toHaveLength(5);
    descriptions.forEach((desc) => {
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  it("should return descriptions in same order as PRO_FEATURES", () => {
    const descriptions = getProFeatureDescriptions();
    const expectedDescriptions = PRO_FEATURES.map((f) => f.description);
    expect(descriptions).toEqual(expectedDescriptions);
  });
});

describe("Priority Support Feature", () => {
  it("should include support email in features", () => {
    const supportFeature = getProFeatureById("priority-support");
    expect(supportFeature).toBeDefined();
    expect(supportFeature?.features).toBeDefined();
    const emailFeature = supportFeature?.features?.find((f) =>
      f.includes("support@keyfate.com"),
    );
    expect(emailFeature).toBeDefined();
  });
});

describe("Message Templates Feature", () => {
  it("should list all 7 template types", () => {
    const templatesFeature = getProFeatureById("message-templates");
    expect(templatesFeature?.features).toHaveLength(7);
    expect(templatesFeature?.features).toContain("Bitcoin Wallet Access");
    expect(templatesFeature?.features).toContain(
      "Password Manager Master Password",
    );
    expect(templatesFeature?.features).toContain("Estate Planning Documents");
    expect(templatesFeature?.features).toContain(
      "Safe Deposit Box Instructions",
    );
    expect(templatesFeature?.features).toContain(
      "Cryptocurrency Exchange Account",
    );
    expect(templatesFeature?.features).toContain("Cloud Storage Access");
    expect(templatesFeature?.features).toContain("Social Media Account Access");
  });
});

describe("Configurable Threshold Feature", () => {
  it("should mention Free tier restriction", () => {
    const thresholdFeature = getProFeatureById("configurable-threshold");
    expect(thresholdFeature?.features).toBeDefined();
    const freeRestriction = thresholdFeature?.features?.find((f) =>
      f.toLowerCase().includes("free"),
    );
    expect(freeRestriction).toBeDefined();
  });

  it("should mention 7 total shares maximum", () => {
    const thresholdFeature = getProFeatureById("configurable-threshold");
    const sharesFeature = thresholdFeature?.features?.find((f) =>
      f.includes("7"),
    );
    expect(sharesFeature).toBeDefined();
  });
});

describe("Audit Logs Feature", () => {
  it("should mention export capability", () => {
    const auditFeature = getProFeatureById("audit-logs");
    const exportFeature = auditFeature?.features?.find((f) =>
      f.toLowerCase().includes("export"),
    );
    expect(exportFeature).toBeDefined();
  });

  it("should mention indefinite storage", () => {
    const auditFeature = getProFeatureById("audit-logs");
    const storageFeature = auditFeature?.features?.find((f) =>
      f.toLowerCase().includes("indefinitely"),
    );
    expect(storageFeature).toBeDefined();
  });
});
