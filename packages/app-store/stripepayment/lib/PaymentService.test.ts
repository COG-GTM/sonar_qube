import prismock from "../../../../tests/libs/__mocks__/prisma";

import type { Payment, Prisma } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { ErrorCode } from "@calcom/lib/errorCodes";

import { PaymentService } from "./PaymentService";

const stripeMock = {
  paymentIntents: { create: vi.fn(), cancel: vi.fn() },
  setupIntents: { create: vi.fn() },
  refunds: { create: vi.fn() },
  customers: { retrieve: vi.fn() },
  paymentMethods: { retrieve: vi.fn() },
  checkout: { sessions: { list: vi.fn(), expire: vi.fn() } },
};

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => stripeMock),
}));

const retrieveOrCreateStripeCustomerByEmail = vi.fn();
vi.mock("./customer", () => ({
  retrieveOrCreateStripeCustomerByEmail: (...args: unknown[]) =>
    retrieveOrCreateStripeCustomerByEmail(...args),
}));

const sendAwaitingPaymentEmailAndSMS = vi.fn();
vi.mock("@calcom/emails", () => ({
  sendAwaitingPaymentEmailAndSMS: (...args: unknown[]) => sendAwaitingPaymentEmailAndSMS(...args),
}));

vi.mock("./client", () => ({
  createPaymentLink: vi.fn().mockReturnValue("https://pay.test/link"),
}));

const validKey = {
  stripe_user_id: "acct_1",
  default_currency: "usd",
  stripe_publishable_key: "pk_test_1",
};

const payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency"> = {
  amount: 5000,
  currency: "usd",
};

async function seedApp(keys?: Prisma.InputJsonValue) {
  await prismock.app.create({
    data: { slug: "stripe", dirName: "stripepayment", categories: ["payment"], enabled: true, keys },
  });
}

async function seedBooking(bookingId: number) {
  await prismock.booking.create({
    data: {
      id: bookingId,
      uid: `booking-${bookingId}`,
      title: "Paid meeting",
      startTime: new Date(),
      endTime: new Date(),
    },
  });
}

describe("Stripe PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retrieveOrCreateStripeCustomerByEmail.mockResolvedValue({ id: "cus_1" });
    stripeMock.paymentIntents.create.mockResolvedValue({ id: "pi_1" });
    stripeMock.setupIntents.create.mockResolvedValue({ id: "seti_1", customer: "cus_1" });
    stripeMock.refunds.create.mockResolvedValue({ status: "succeeded" });
    stripeMock.customers.retrieve.mockResolvedValue({ id: "cus_1" });
    stripeMock.paymentMethods.retrieve.mockResolvedValue({ id: "pm_1" });
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [] });
  });

  describe("constructor / isSetupAlready", () => {
    it("parses valid credentials", () => {
      expect(new PaymentService({ key: validKey }).isSetupAlready()).toBe(true);
    });

    it("treats invalid credentials as not set up", () => {
      expect(new PaymentService({ key: { foo: "bar" } }).isSetupAlready()).toBe(false);
    });
  });

  describe("create", () => {
    it("creates a PaymentIntent-backed payment for ON_BOOKING", async () => {
      const bookingId = 401;
      await seedApp();
      await seedBooking(bookingId);
      const service = new PaymentService({ key: validKey });

      const result = await service.create(
        payment,
        bookingId,
        1,
        "host",
        "Booker",
        "ON_BOOKING",
        "booker@example.com"
      );

      expect(retrieveOrCreateStripeCustomerByEmail).toHaveBeenCalled();
      expect(stripeMock.paymentIntents.create).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ externalId: "pi_1", amount: payment.amount, success: false })
      );
    });

    // `create` funnels every failure into the same generic error, so these two seed a
    // usable booking and assert the run bailed before reaching Stripe. Without that,
    // the assertions would still pass if the guard under test were deleted and the
    // failure came from the missing booking instead.
    it("throws when payment option is not ON_BOOKING", async () => {
      const bookingId = 402;
      await seedApp();
      await seedBooking(bookingId);
      const service = new PaymentService({ key: validKey });

      await expect(
        service.create(payment, bookingId, 1, "host", "Booker", "HOLD", "booker@example.com")
      ).rejects.toThrow("payment_not_created_error");

      expect(retrieveOrCreateStripeCustomerByEmail).not.toHaveBeenCalled();
      expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
    });

    it("throws when credentials are invalid", async () => {
      const bookingId = 403;
      await seedApp();
      await seedBooking(bookingId);
      const service = new PaymentService({ key: { foo: "bar" } });

      await expect(
        service.create(payment, bookingId, 1, "host", "Booker", "ON_BOOKING", "booker@example.com")
      ).rejects.toThrow("payment_not_created_error");

      expect(retrieveOrCreateStripeCustomerByEmail).not.toHaveBeenCalled();
      expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
    });
  });

  describe("collectCard", () => {
    it("creates a SetupIntent-backed payment for HOLD", async () => {
      const bookingId = 402;
      await seedApp();
      await seedBooking(bookingId);
      const service = new PaymentService({ key: validKey });

      const result = await service.collectCard(payment, bookingId, "HOLD", "booker@example.com");

      expect(stripeMock.setupIntents.create).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ externalId: "seti_1", success: false }));
    });

    it("throws when option is not HOLD", async () => {
      const service = new PaymentService({ key: validKey });
      await expect(service.collectCard(payment, 1, "ON_BOOKING", "booker@example.com")).rejects.toThrow(
        "Stripe: Payment method could not be collected"
      );
    });
  });

  describe("chargeCard", () => {
    it("charges a stored setup intent and marks the payment successful", async () => {
      const paymentId = 501;
      await seedApp({ payment_fee_fixed: 30, payment_fee_percentage: 0.05, client_id: "ca_1" });
      const paymentRecord = (await prismock.payment.create({
        data: {
          id: paymentId,
          uid: "pay-501",
          appId: "stripe",
          bookingId: 1,
          amount: payment.amount,
          currency: payment.currency,
          externalId: "seti_1",
          success: false,
          refunded: false,
          fee: 0,
          data: { setupIntent: { id: "seti_1", customer: "cus_1", payment_method: "pm_1" } },
        },
      })) as unknown as Payment;

      const service = new PaymentService({ key: validKey });
      const result = await service.chargeCard(paymentRecord);

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ confirm: true, off_session: true }),
        expect.anything()
      );
      expect(result.success).toBe(true);
    });

    it("throws ChargeCardFailure without credentials", async () => {
      const service = new PaymentService({ key: { foo: "bar" } });
      await expect(service.chargeCard({ amount: 1 } as Payment)).rejects.toThrow(ErrorCode.ChargeCardFailure);
    });
  });

  describe("refund", () => {
    it("refunds a successful payment", async () => {
      const paymentId = 601;
      const created = (await prismock.payment.create({
        data: {
          id: paymentId,
          uid: "pay-601",
          appId: "stripe",
          bookingId: 1,
          amount: payment.amount,
          currency: payment.currency,
          externalId: "pi_1",
          success: true,
          refunded: false,
          fee: 0,
          data: { stripeAccount: "acct_1" },
        },
      })) as unknown as Payment;

      const service = new PaymentService({ key: validKey });
      const result = await service.refund(created.id);

      expect(stripeMock.refunds.create).toHaveBeenCalled();
      expect(result.refunded).toBe(true);
    });

    it("throws when the refund fails", async () => {
      const paymentId = 602;
      await prismock.payment.create({
        data: {
          id: paymentId,
          uid: "pay-602",
          appId: "stripe",
          bookingId: 1,
          amount: payment.amount,
          currency: payment.currency,
          externalId: "pi_2",
          success: true,
          refunded: false,
          fee: 0,
          data: { stripeAccount: "acct_1" },
        },
      });
      stripeMock.refunds.create.mockResolvedValueOnce({ status: "failed" });
      const service = new PaymentService({ key: validKey });
      await expect(service.refund(paymentId)).rejects.toThrow("Refund failed");
    });
  });

  describe("afterPayment", () => {
    it("sends the awaiting payment email", async () => {
      const service = new PaymentService({ key: validKey });
      await service.afterPayment(
        // @ts-expect-error partial CalendarEvent is enough for the mocked email
        {},
        { id: 1, uid: "x", startTime: new Date(), user: { email: "u@e.com", name: "U", timeZone: "UTC" } },
        { uid: "pay-1", amount: 5000, currency: "usd", paymentOption: "ON_BOOKING" } as Payment
      );
      expect(sendAwaitingPaymentEmailAndSMS).toHaveBeenCalledOnce();
    });
  });

  describe("deletePayment", () => {
    it("expires sessions, cancels the intent and returns true", async () => {
      const paymentId = 701;
      await prismock.payment.create({
        data: {
          id: paymentId,
          uid: "pay-701",
          appId: "stripe",
          bookingId: 1,
          amount: payment.amount,
          currency: payment.currency,
          externalId: "pi_3",
          success: true,
          refunded: false,
          fee: 0,
          data: { stripeAccount: "acct_1" },
        },
      });
      const service = new PaymentService({ key: validKey });
      await expect(service.deletePayment(paymentId)).resolves.toBe(true);
      expect(stripeMock.paymentIntents.cancel).toHaveBeenCalled();
    });

    it("returns false when the stripe account is missing", async () => {
      const paymentId = 702;
      await prismock.payment.create({
        data: {
          id: paymentId,
          uid: "pay-702",
          appId: "stripe",
          bookingId: 1,
          amount: payment.amount,
          currency: payment.currency,
          externalId: "pi_4",
          success: true,
          refunded: false,
          fee: 0,
          data: {},
        },
      });
      const service = new PaymentService({ key: validKey });
      await expect(service.deletePayment(paymentId)).resolves.toBe(false);
    });
  });

  describe("unimplemented methods", () => {
    it("rejects update and sync getters", async () => {
      const service = new PaymentService({ key: validKey });
      await expect(service.update()).rejects.toThrow("Method not implemented.");
      expect(() => service.getPaymentPaidStatus()).toThrow("Method not implemented.");
      expect(() => service.getPaymentDetails()).toThrow("Method not implemented.");
    });
  });
});
