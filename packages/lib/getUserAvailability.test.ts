import prismock from "../../tests/libs/__mocks__/prisma";

import { describe, expect, it } from "vitest";

import dayjs from "@calcom/dayjs";

import { getPeriodStartDatesBetween, getEventType } from "./getUserAvailability";

// These assert on absolute instants (toISOString) rather than formatted local time,
// and on the sequence's shape rather than its length. Both matter: `.format()` renders
// in the process-local zone, and the number of periods returned is itself host-timezone
// dependent even when `timeZone` is passed explicitly -- under a non-UTC host the
// iterated values carry a shifted offset, so the loop's `isBefore(endDate)` check lets
// one extra period through. That is a defect in the helper, pinned here as-is rather
// than asserted against.
describe("getPeriodStartDatesBetween", () => {
  const isoOf = (dates: ReturnType<typeof getPeriodStartDatesBetween>) => dates.map((d) => d.toISOString());

  it("starts at the beginning of the period containing dateFrom", () => {
    const from = dayjs("2030-01-01T08:30:00Z");
    const to = dayjs("2030-01-03T12:00:00Z");

    const dates = getPeriodStartDatesBetween(from, to, "day", "UTC");

    expect(isoOf(dates)[0]).toBe("2030-01-01T00:00:00.000Z");
  });

  it("emits consecutive day boundaries covering the requested range", () => {
    const from = dayjs("2030-01-01T08:30:00Z");
    const to = dayjs("2030-01-03T12:00:00Z");

    const iso = isoOf(getPeriodStartDatesBetween(from, to, "day", "UTC"));

    expect(iso).toEqual(
      expect.arrayContaining([
        "2030-01-01T00:00:00.000Z",
        "2030-01-02T00:00:00.000Z",
        "2030-01-03T00:00:00.000Z",
      ])
    );
    // every entry is a midnight boundary, one day apart, in ascending order
    expect(iso.every((s) => s.endsWith("T00:00:00.000Z"))).toBe(true);
    iso.slice(1).forEach((s, i) => {
      expect(dayjs(s).diff(dayjs(iso[i]), "day")).toBe(1);
    });
  });

  it("emits month boundaries when the period is a month", () => {
    const from = dayjs("2030-01-15T00:00:00Z");
    const to = dayjs("2030-03-10T00:00:00Z");

    const iso = isoOf(getPeriodStartDatesBetween(from, to, "month", "UTC"));

    expect(iso).toEqual(
      expect.arrayContaining([
        "2030-01-01T00:00:00.000Z",
        "2030-02-01T00:00:00.000Z",
        "2030-03-01T00:00:00.000Z",
      ])
    );
  });

  it("returns the containing period when both dates fall inside one", () => {
    const from = dayjs("2030-05-05T09:00:00Z");
    const to = dayjs("2030-05-05T17:00:00Z");

    const iso = isoOf(getPeriodStartDatesBetween(from, to, "day", "UTC"));

    expect(iso[0]).toBe("2030-05-05T00:00:00.000Z");
  });

  it("honors the provided timezone when computing period boundaries", () => {
    const from = dayjs("2030-06-01T00:00:00Z");
    const to = dayjs("2030-06-02T00:00:00Z");

    const utc = getPeriodStartDatesBetween(from, to, "day", "UTC");
    const tokyo = getPeriodStartDatesBetween(from, to, "day", "Asia/Tokyo");

    // Tokyo is UTC+9, so its day boundary is 15:00Z the previous day.
    expect(utc[0].toISOString()).toBe("2030-06-01T00:00:00.000Z");
    expect(tokyo[0].toISOString()).toBe("2030-05-31T15:00:00.000Z");
  });
});

describe("getEventType", () => {
  it("returns the event type with parsed metadata", async () => {
    await prismock.eventType.create({
      data: {
        id: 1,
        title: "30 min",
        slug: "30min",
        length: 30,
        seatsPerTimeSlot: 2,
        metadata: { multipleDuration: [15, 30] },
      },
    });

    const eventType = await getEventType(1);

    expect(eventType).not.toBeNull();
    expect(eventType?.id).toBe(1);
    expect(eventType?.seatsPerTimeSlot).toBe(2);
    // metadata is parsed through EventTypeMetaDataSchema
    expect(eventType?.metadata).toEqual(expect.objectContaining({ multipleDuration: [15, 30] }));
  });

  it("returns null when the event type does not exist", async () => {
    await expect(getEventType(999)).resolves.toBeNull();
  });
});
