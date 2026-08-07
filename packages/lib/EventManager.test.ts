import "../../tests/libs/__mocks__/prisma";

import { describe, expect, it } from "vitest";

import { DailyLocationType, MeetLocationType } from "@calcom/app-store/locations";
import type { CalendarEvent } from "@calcom/types/Calendar";

import { isDedicatedIntegration, getLocationRequestFromIntegration, processLocation } from "./EventManager";

describe("EventManager pure helpers", () => {
  describe("isDedicatedIntegration", () => {
    it("is true for a dedicated integration location", () => {
      expect(isDedicatedIntegration(DailyLocationType)).toBe(true);
    });

    it("is false for Google Meet (handled specially)", () => {
      expect(isDedicatedIntegration(MeetLocationType)).toBe(false);
    });

    it("is false for a non-integration location", () => {
      expect(isDedicatedIntegration("https://example.com/room")).toBe(false);
      expect(isDedicatedIntegration("In person")).toBe(false);
    });
  });

  describe("getLocationRequestFromIntegration", () => {
    it("returns a stable conferenceData request for a known integration", () => {
      const result = getLocationRequestFromIntegration(DailyLocationType);
      expect(result).not.toBeNull();
      expect(result?.location).toBe(DailyLocationType);
      const requestId = result?.conferenceData?.createRequest?.requestId;
      expect(typeof requestId).toBe("string");
      // requestId is a deterministic uuidv5 of the location
      expect(
        getLocationRequestFromIntegration(DailyLocationType)?.conferenceData?.createRequest?.requestId
      ).toBe(requestId);
    });

    it("returns null for an unknown location", () => {
      expect(getLocationRequestFromIntegration("integrations:does-not-exist")).toBeNull();
    });
  });

  describe("processLocation", () => {
    it("merges conference data for an integration location", () => {
      const event = { title: "Test", location: DailyLocationType } as CalendarEvent;
      const processed = processLocation(event);
      // the event is merged in place and returned by reference
      expect(processed).toBe(event);
      expect(processed.location).toBe(DailyLocationType);
      // @ts-expect-error conferenceData is merged onto the event
      expect(processed.conferenceData?.createRequest?.requestId).toBeTypeOf("string");
    });

    it("leaves non-integration events unchanged", () => {
      const event = { title: "Test", location: "In person" } as CalendarEvent;
      const processed = processLocation(event);
      expect(processed.location).toBe("In person");
      // @ts-expect-error conferenceData should not have been added
      expect(processed.conferenceData).toBeUndefined();
    });
  });
});
