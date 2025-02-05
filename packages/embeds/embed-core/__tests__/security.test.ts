import { verifyOrigin } from "../src/embed-iframe";

describe("Security measures", () => {
  describe("Origin verification", () => {
    it("should verify allowed origin", () => {
      expect(verifyOrigin("https://app.cal.com")).toBe(true);
    });

    it("should reject unauthorized origins", () => {
      expect(verifyOrigin("https://malicious.com")).toBe(false);
    });
  });
});
