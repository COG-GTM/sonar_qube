/**
 * These tests are integration tests that verify the cancellation flow for bookings.
 * They test:
 * - Database entries updated in In-MEMORY DB using prismock
 * - Emails sent by checking the testEmails global variable
 * - Webhooks fired by mocking fetch
 * - APIs of various apps called by mocking those apps' modules (calendar, video)
 */
import prismaMock from "../../../../../../tests/libs/__mocks__/prisma";

import {
  createBookingScenario,
  getDate,
  getGoogleCalendarCredential,
  TestData,
  getOrganizer,
  getBooker,
  getScenarioData,
  mockSuccessfulVideoMeetingCreation,
  mockCalendarToHaveNoBusySlots,
  BookingLocations,
  getMockBookingAttendee,
} from "@calcom/web/test/utils/bookingScenario/bookingScenario";
import {
  expectBookingToBeInDatabase,
  expectSuccessfulCalendarEventDeletionInCalendar,
  expectSuccessfulVideoMeetingDeletionInCalendar,
  expectBookingCancelledWebhookToHaveBeenFired,
} from "@calcom/web/test/utils/bookingScenario/expects";
import { getMockRequestDataForCancelBooking } from "@calcom/web/test/utils/bookingScenario/getMockRequestDataForCancelBooking";
import { setupAndTeardown } from "@calcom/web/test/utils/bookingScenario/setupAndTeardown";

import { describe, expect, test } from "vitest";

import { appStoreMetadata } from "@calcom/app-store/apps.metadata.generated";
import { BookingStatus } from "@calcom/prisma/enums";

const timeout = process.env.CI ? 5000 : 20000;

describe("handleCancelBooking", () => {
  setupAndTeardown();

  describe("Cancel Existing Booking:", () => {
    test(
      `should cancel an existing confirmed booking successfully
          1. Given an existing confirmed booking with status ACCEPTED
          2. When the booker requests to cancel the booking
          3. Then the booking status should change to CANCELLED
          4. And cancellation emails should be sent to both booker and organizer
          5. And the calendar event should be deleted from the organizer's calendar
          6. And the video meeting should be deleted
          7. And a BOOKING_CANCELLED webhook should be triggered
      `,
      async ({ emails }) => {
        const handleCancelBooking = (await import("@calcom/features/bookings/lib/handleCancelBooking"))
          .default;

        const booker = getBooker({
          email: "booker@example.com",
          name: "Booker",
        });

        const organizer = getOrganizer({
          name: "Organizer",
          email: "organizer@example.com",
          id: 101,
          schedules: [TestData.schedules.IstWorkHours],
          credentials: [getGoogleCalendarCredential()],
          selectedCalendars: [TestData.selectedCalendars.google],
          destinationCalendar: {
            integration: "google_calendar",
            externalId: "organizer@google-calendar.com",
          },
        });

        const { dateString: plus1DateString } = getDate({ dateIncrement: 1 });
        const bookingUid = "booking-to-cancel-uid";
        const bookingId = 1;

        await createBookingScenario(
          getScenarioData({
            webhooks: [
              {
                userId: organizer.id,
                eventTriggers: ["BOOKING_CANCELLED"],
                subscriberUrl: "http://my-webhook.example.com",
                active: true,
                eventTypeId: 1,
                appId: null,
              },
            ],
            eventTypes: [
              {
                id: 1,
                slotInterval: 30,
                length: 30,
                users: [
                  {
                    id: 101,
                  },
                ],
                owner: organizer.id,
              },
            ],
            bookings: [
              {
                id: bookingId,
                uid: bookingUid,
                eventTypeId: 1,
                userId: organizer.id,
                status: BookingStatus.ACCEPTED,
                startTime: `${plus1DateString}T05:00:00.000Z`,
                endTime: `${plus1DateString}T05:30:00.000Z`,
                references: [
                  {
                    type: appStoreMetadata.dailyvideo.type,
                    uid: "MOCK_VIDEO_ID",
                    meetingId: "MOCK_VIDEO_ID",
                    meetingPassword: "MOCK_PASS",
                    meetingUrl: "http://mock-dailyvideo.example.com/meeting-1",
                    credentialId: null,
                  },
                  {
                    type: appStoreMetadata.googlecalendar.type,
                    uid: "MOCK_CALENDAR_EVENT_ID",
                    meetingId: "MOCK_CALENDAR_EVENT_ID",
                    meetingPassword: "MOCK_PASSWORD",
                    meetingUrl: "https://UNUSED_URL",
                    externalCalendarId: "organizer@google-calendar.com",
                    credentialId: undefined,
                  },
                ],
                attendees: [
                  getMockBookingAttendee({
                    id: 1,
                    name: booker.name,
                    email: booker.email,
                    locale: "en",
                    timeZone: "America/Toronto",
                  }),
                ],
              },
            ],
            organizer,
            apps: [TestData.apps["google-calendar"], TestData.apps["daily-video"]],
          })
        );

        const videoMock = mockSuccessfulVideoMeetingCreation({
          metadataLookupKey: "dailyvideo",
          videoMeetingData: {
            id: "MOCK_VIDEO_ID",
            password: "MOCK_PASS",
            url: "http://mock-dailyvideo.example.com/meeting-1",
          },
        });

        const calendarMock = mockCalendarToHaveNoBusySlots("googlecalendar", {
          create: {
            id: "MOCK_CALENDAR_EVENT_ID",
          },
          update: {
            uid: "MOCK_CALENDAR_EVENT_ID",
          },
        });

        const mockCancelBookingData = getMockRequestDataForCancelBooking({
          id: bookingId,
          uid: bookingUid,
          cancellationReason: "test cancellation reason",
        });

        await handleCancelBooking({
          bookingData: mockCancelBookingData,
          userId: organizer.id,
        });

        await expectBookingToBeInDatabase({
          uid: bookingUid,
          status: BookingStatus.CANCELLED,
        });

        expectSuccessfulVideoMeetingDeletionInCalendar(videoMock, {
          bookingRef: {
            type: appStoreMetadata.dailyvideo.type,
            uid: "MOCK_VIDEO_ID",
            meetingId: "MOCK_VIDEO_ID",
            meetingPassword: "MOCK_PASS",
            meetingUrl: "http://mock-dailyvideo.example.com/meeting-1",
          },
        });

        expectSuccessfulCalendarEventDeletionInCalendar(calendarMock, {
          externalCalendarId: "organizer@google-calendar.com",
          uid: "MOCK_CALENDAR_EVENT_ID",
          calEvent: {
            title: expect.any(String),
          },
        });

        expectBookingCancelledWebhookToHaveBeenFired({
          booker,
          organizer,
          location: BookingLocations.CalVideo,
          subscriberUrl: "http://my-webhook.example.com",
        });

        const cancelledEmails = emails.get().filter((email) => {
          return (
            email.subject?.toLowerCase().includes("cancel") || email.html?.toLowerCase().includes("cancel")
          );
        });
        expect(cancelledEmails.length).toBeGreaterThan(0);
      },
      timeout
    );

    test(
      `should not allow cancelling an already cancelled booking`,
      async () => {
        const handleCancelBooking = (await import("@calcom/features/bookings/lib/handleCancelBooking"))
          .default;

        const organizer = getOrganizer({
          name: "Organizer",
          email: "organizer@example.com",
          id: 101,
          schedules: [TestData.schedules.IstWorkHours],
          credentials: [getGoogleCalendarCredential()],
          selectedCalendars: [TestData.selectedCalendars.google],
        });

        const { dateString: plus1DateString } = getDate({ dateIncrement: 1 });
        const bookingUid = "already-cancelled-booking-uid";
        const bookingId = 2;

        await createBookingScenario(
          getScenarioData({
            eventTypes: [
              {
                id: 1,
                slotInterval: 30,
                length: 30,
                users: [
                  {
                    id: 101,
                  },
                ],
                owner: organizer.id,
              },
            ],
            bookings: [
              {
                id: bookingId,
                uid: bookingUid,
                eventTypeId: 1,
                userId: organizer.id,
                status: BookingStatus.CANCELLED,
                startTime: `${plus1DateString}T05:00:00.000Z`,
                endTime: `${plus1DateString}T05:30:00.000Z`,
              },
            ],
            organizer,
            apps: [TestData.apps["google-calendar"], TestData.apps["daily-video"]],
          })
        );

        const mockCancelBookingData = getMockRequestDataForCancelBooking({
          id: bookingId,
          uid: bookingUid,
          cancellationReason: "test cancellation reason",
        });

        await expect(
          handleCancelBooking({
            bookingData: mockCancelBookingData,
            userId: organizer.id,
          })
        ).rejects.toThrow("This booking has already been cancelled.");
      },
      timeout
    );

    test(
      `should update booking status to CANCELLED when cancelling a pending booking`,
      async () => {
        const handleCancelBooking = (await import("@calcom/features/bookings/lib/handleCancelBooking"))
          .default;

        const booker = getBooker({
          email: "booker@example.com",
          name: "Booker",
        });

        const organizer = getOrganizer({
          name: "Organizer",
          email: "organizer@example.com",
          id: 101,
          schedules: [TestData.schedules.IstWorkHours],
          credentials: [getGoogleCalendarCredential()],
          selectedCalendars: [TestData.selectedCalendars.google],
        });

        const { dateString: plus1DateString } = getDate({ dateIncrement: 1 });
        const bookingUid = "pending-booking-to-cancel-uid";
        const bookingId = 3;

        await createBookingScenario(
          getScenarioData({
            eventTypes: [
              {
                id: 1,
                slotInterval: 30,
                length: 30,
                users: [
                  {
                    id: 101,
                  },
                ],
                owner: organizer.id,
              },
            ],
            bookings: [
              {
                id: bookingId,
                uid: bookingUid,
                eventTypeId: 1,
                userId: organizer.id,
                status: BookingStatus.PENDING,
                startTime: `${plus1DateString}T05:00:00.000Z`,
                endTime: `${plus1DateString}T05:30:00.000Z`,
                attendees: [
                  getMockBookingAttendee({
                    id: 1,
                    name: booker.name,
                    email: booker.email,
                    locale: "en",
                    timeZone: "America/Toronto",
                  }),
                ],
              },
            ],
            organizer,
            apps: [TestData.apps["google-calendar"], TestData.apps["daily-video"]],
          })
        );

        mockSuccessfulVideoMeetingCreation({
          metadataLookupKey: "dailyvideo",
        });

        mockCalendarToHaveNoBusySlots("googlecalendar", {
          create: {
            id: "MOCK_CALENDAR_EVENT_ID",
          },
        });

        const mockCancelBookingData = getMockRequestDataForCancelBooking({
          id: bookingId,
          uid: bookingUid,
          cancellationReason: "test cancellation reason",
        });

        await handleCancelBooking({
          bookingData: mockCancelBookingData,
          userId: organizer.id,
        });

        await expectBookingToBeInDatabase({
          uid: bookingUid,
          status: BookingStatus.CANCELLED,
        });
      },
      timeout
    );

    test(
      `should store the cancellation reason in the database`,
      async () => {
        const handleCancelBooking = (await import("@calcom/features/bookings/lib/handleCancelBooking"))
          .default;

        const booker = getBooker({
          email: "booker@example.com",
          name: "Booker",
        });

        const organizer = getOrganizer({
          name: "Organizer",
          email: "organizer@example.com",
          id: 101,
          schedules: [TestData.schedules.IstWorkHours],
          credentials: [getGoogleCalendarCredential()],
          selectedCalendars: [TestData.selectedCalendars.google],
        });

        const { dateString: plus1DateString } = getDate({ dateIncrement: 1 });
        const bookingUid = "booking-with-reason-uid";
        const bookingId = 4;
        const cancellationReason = "I have a scheduling conflict";

        await createBookingScenario(
          getScenarioData({
            eventTypes: [
              {
                id: 1,
                slotInterval: 30,
                length: 30,
                users: [
                  {
                    id: 101,
                  },
                ],
                owner: organizer.id,
              },
            ],
            bookings: [
              {
                id: bookingId,
                uid: bookingUid,
                eventTypeId: 1,
                userId: organizer.id,
                status: BookingStatus.ACCEPTED,
                startTime: `${plus1DateString}T05:00:00.000Z`,
                endTime: `${plus1DateString}T05:30:00.000Z`,
                attendees: [
                  getMockBookingAttendee({
                    id: 1,
                    name: booker.name,
                    email: booker.email,
                    locale: "en",
                    timeZone: "America/Toronto",
                  }),
                ],
              },
            ],
            organizer,
            apps: [TestData.apps["google-calendar"], TestData.apps["daily-video"]],
          })
        );

        mockSuccessfulVideoMeetingCreation({
          metadataLookupKey: "dailyvideo",
        });

        mockCalendarToHaveNoBusySlots("googlecalendar", {
          create: {
            id: "MOCK_CALENDAR_EVENT_ID",
          },
        });

        const mockCancelBookingData = getMockRequestDataForCancelBooking({
          id: bookingId,
          uid: bookingUid,
          cancellationReason: cancellationReason,
        });

        await handleCancelBooking({
          bookingData: mockCancelBookingData,
          userId: organizer.id,
        });

        const cancelledBooking = await prismaMock.booking.findUnique({
          where: {
            uid: bookingUid,
          },
        });

        expect(cancelledBooking?.status).toBe(BookingStatus.CANCELLED);
        expect(cancelledBooking?.cancellationReason).toBe(cancellationReason);
      },
      timeout
    );
  });
});
