import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import {
  assertStripePaymentMatchesCheckoutPayload,
  finalizePaidOrder,
  getStripeCheckoutOrderStatus,
  getStripeCheckoutSession,
  isValidCheckoutOrderPayload,
  readStripePaymentDiscountDetails,
  readStripePromotionCodeIdFromCheckoutSession,
  readStripeChargeId,
  readStripeCustomerId,
  readStripePaymentIntentId,
  upsertStripePaymentRecord,
} from "@/lib/server/orderPayments";
import { getStripeServerClient } from "@/lib/server/stripe";

function toDateOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}

function getExpandedPaymentIntent(session: Stripe.Checkout.Session) {
  return session.payment_intent && typeof session.payment_intent !== "string" ? session.payment_intent : null;
}

async function reconcilePaidStripeCheckoutSession(userId: number, stripeSessionId: string) {
  const persistedCheckout = await getStripeCheckoutSession(stripeSessionId, userId);
  if (!persistedCheckout) {
    return null;
  }

  if (!isValidCheckoutOrderPayload(persistedCheckout.payload)) {
    throw new Error("Saved Stripe checkout payload is invalid.");
  }

  const stripe = getStripeServerClient();
  const checkoutSession = await stripe.checkout.sessions.retrieve(stripeSessionId, {
    expand: [
      "payment_intent",
      "payment_intent.latest_charge",
      "total_details.breakdown.discounts.discount",
    ],
  });

  if (checkoutSession.payment_status !== "paid") {
    return null;
  }

  const paymentIntent = getExpandedPaymentIntent(checkoutSession);
  const promotionCodeId = readStripePromotionCodeIdFromCheckoutSession(checkoutSession);
  const expandedPromotionCode = promotionCodeId
    ? await stripe.promotionCodes.retrieve(promotionCodeId)
    : null;
  assertStripePaymentMatchesCheckoutPayload({
    payload: persistedCheckout.payload,
    checkoutSession,
    paymentIntent,
  });

  const result = await finalizePaidOrder({
    userId,
    payload: persistedCheckout.payload,
    paymentProvider: "stripe",
    paymentReference: checkoutSession.id,
    paidAt: toDateOrNull(paymentIntent?.created ?? null) ?? new Date(),
  });

  const paymentIntentId = paymentIntent?.id ?? readStripePaymentIntentId(checkoutSession.payment_intent);
  if (paymentIntentId) {
    await upsertStripePaymentRecord({
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCustomerId: readStripeCustomerId(checkoutSession.customer),
      stripeChargeId: readStripeChargeId(paymentIntent?.latest_charge ?? null),
      status: "paid",
      amount: paymentIntent?.amount_received ?? checkoutSession.amount_total ?? 0,
      currency: String(paymentIntent?.currency ?? checkoutSession.currency ?? "usd"),
      customerEmail: checkoutSession.customer_details?.email ?? checkoutSession.customer_email ?? null,
      paidAt: toDateOrNull(paymentIntent?.created ?? null) ?? new Date(result.paidAt),
      orderId: result.orderId,
      discountDetails: readStripePaymentDiscountDetails(checkoutSession, expandedPromotionCode),
    });
  }

  return result;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const payload = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";

  if (!sessionId) {
    return NextResponse.json({ error: "Missing Stripe session id." }, { status: 400 });
  }

  try {
    const status = await getStripeCheckoutOrderStatus(userId, sessionId);

    if (status.state === "not_found") {
      return NextResponse.json(
        {
          status: "not_found",
          error: "Stripe checkout session was not found for this account.",
        },
        { status: 404 }
      );
    }

    if (status.state === "failed") {
      return NextResponse.json(
        {
          status: "failed",
          error: status.errorMessage ?? "Payment failed. Please try again.",
        },
        { status: 409 }
      );
    }

    if (status.state === "pending") {
      const completedOrder = await reconcilePaidStripeCheckoutSession(userId, sessionId);
      if (completedOrder) {
        return NextResponse.json({
          status: "completed",
          orderId: completedOrder.orderId,
          invoiceNumber: completedOrder.invoiceNumber,
          paidAt: completedOrder.paidAt,
        });
      }

      return NextResponse.json(
        {
          status: "pending",
          paymentStatus: status.paymentStatus,
          checkoutStatus: status.checkoutStatus,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      status: "completed",
      orderId: status.orderId,
      invoiceNumber: status.invoiceNumber,
      paidAt: status.paidAt,
    });
  } catch (error) {
    console.error("stripe checkout status error:", error);
    const message = error instanceof Error ? error.message : "Unable to load Stripe checkout status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
