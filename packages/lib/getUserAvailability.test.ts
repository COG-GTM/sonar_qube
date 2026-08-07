import prismock from "../../tests/libs/__mocks__/prisma";

import { describe, expect, it } from "vitest";

import dayjs from "@calcom/dayjs";

import { getPeriodStartDatesBetween, getEventType } from "./getUserAvailability";

describe("getPeriodStartDatesBetween", () => {
  it("returns each day between the two dates (inclusive)", () => {
    const from = dayjs("2030-01-01T08:30:00Z");
    const to = dayjs("2030-01-03T12:00:00Z");

    const dates = getPeriodStartDatesBetween(from, to, "day");

    expect(dates).toHaveLength(3);
    expect(dates.map((d) => d.format("YYYY-MM-DD"))).toEqual(["2030-01-01", "2030-01-02", "2030-01-03"]);
    // each returned date is normalized to the start of the day
    expect(dates[0].format("HH:mm")).toBe("00:00");
  });

  it("returns each month between the two dates", () => {
    const from = dayjs("2030-01-15T00:00:00Z");
    const to = dayjs("2030-03-10T00:00:00Z");

    const dates = getPeriodStartDatesBetween(from, to, "month");

    expect(dates.map((d) => d.format("YYYY-MM"))).toEqual(["2030-01", "2030-02", "2030-03"]);
  });

  it("returns a single entry when both dates fall in the same period", () => {
    const from = dayjs("2030-05-05T09:00:00Z");
    const to = dayjs("2030-05-05T17:00:00Z");

    expect(getPeriodStartDatesBetween(from, to, "day")).toHaveLength(1);
  });

  it("honors the provided timezone when computing period boundaries", () => {
    const from = dayjs("2030-06-01T00:00:00Z");
    const to = dayjs("2030-06-02T00:00:00Z");

    const utc = getPeriodStartDatesBetween(from, to, "day");
    const tokyo = getPeriodStartDatesBetween(from, to, "day", "Asia/Tokyo");

    // Tokyo is UTC+9, so the local day boundaries differ from UTC.
    expect(tokyo.length).toBeGreaterThan(0);
    expect(tokyo[0].format()).not.toBe(utc[0].format());
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
