import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  createStripeWebhookEvent,
  finalizePaidOrder,
  getStripeCheckoutSessionById,
  isValidCheckoutOrderPayload,
  markStripeWebhookEventProcessed,
  readStripeChargeId,
  readStripeCustomerId,
  readStripePaymentIntentId,
  upsertStripePaymentRecord,
} from "@/lib/server/orderPayments";
import { getStripeServerClient } from "@/lib/server/stripe";

export const runtime = "nodejs";

function getWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }

  return webhookSecret;
}

function toDateOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}

async function retrievePaymentIntentForSession(session: Stripe.Checkout.Session) {
  if (!session.payment_intent) {
    return null;
  }

  if (typeof session.payment_intent !== "string") {
    return session.payment_intent;
  }

  const paymentIntentId = readStripePaymentIntentId(session.payment_intent);
  if (!paymentIntentId) {
    return null;
  }

  const stripe = getStripeServerClient();
  return stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
}

async function recordSuccessfulCheckoutSession(
  stripeEventId: string,
  checkoutSession: Stripe.Checkout.Session
) {
  const persistedCheckout = await getStripeCheckoutSessionById(checkoutSession.id);
  if (!persistedCheckout || !persistedCheckout.userId || !isValidCheckoutOrderPayload(persistedCheckout.payload)) {
    await markStripeWebhookEventProcessed(stripeEventId);
    return;
  }

  const paymentIntent = await retrievePaymentIntentForSession(checkoutSession);

  const result = await finalizePaidOrder({
    userId: persistedCheckout.userId,
    payload: persistedCheckout.payload,
    paymentProvider: "stripe",
    paymentReference: checkoutSession.id,
    paidAt: new Date(),
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
    });
  }

  await markStripeWebhookEventProcessed(stripeEventId, result.orderId);
}

async function recordPendingCheckoutSession(
  stripeEventId: string,
  checkoutSession: Stripe.Checkout.Session
) {
  const paymentIntent = await retrievePaymentIntentForSession(checkoutSession);
  const paymentIntentId = paymentIntent?.id ?? readStripePaymentIntentId(checkoutSession.payment_intent);

  if (paymentIntentId) {
    await upsertStripePaymentRecord({
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCustomerId: readStripeCustomerId(checkoutSession.customer),
      stripeChargeId: readStripeChargeId(paymentIntent?.latest_charge ?? null),
      status: "pending",
      amount: paymentIntent?.amount ?? checkoutSession.amount_total ?? 0,
      currency: String(paymentIntent?.currency ?? checkoutSession.currency ?? "usd"),
      customerEmail: checkoutSession.customer_details?.email ?? checkoutSession.customer_email ?? null,
    });
  }

  await markStripeWebhookEventProcessed(stripeEventId);
}

async function recordFailedCheckoutSession(
  stripeEventId: string,
  checkoutSession: Stripe.Checkout.Session
) {
  const paymentIntent = await retrievePaymentIntentForSession(checkoutSession);
  const paymentIntentId = paymentIntent?.id ?? readStripePaymentIntentId(checkoutSession.payment_intent);

  if (paymentIntentId) {
    await upsertStripePaymentRecord({
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCustomerId: readStripeCustomerId(checkoutSession.customer),
      stripeChargeId: readStripeChargeId(paymentIntent?.latest_charge ?? null),
      status: "failed",
      amount: paymentIntent?.amount ?? checkoutSession.amount_total ?? 0,
      currency: String(paymentIntent?.currency ?? checkoutSession.currency ?? "usd"),
      customerEmail: checkoutSession.customer_details?.email ?? checkoutSession.customer_email ?? null,
      failureCode: paymentIntent?.last_payment_error?.code ?? null,
      failureMessage: paymentIntent?.last_payment_error?.message ?? "Payment failed.",
      failedAt: new Date(),
    });
  }

  await markStripeWebhookEventProcessed(stripeEventId);
}

async function recordFailedPaymentIntent(
  stripeEventId: string,
  paymentIntent: Stripe.PaymentIntent
) {
  const checkoutSessionId =
    typeof paymentIntent.metadata?.checkout_session_id === "string"
      ? paymentIntent.metadata.checkout_session_id
      : null;

  await upsertStripePaymentRecord({
    stripePaymentIntentId: paymentIntent.id,
    stripeCheckoutSessionId: checkoutSessionId,
    stripeCustomerId: readStripeCustomerId(paymentIntent.customer),
    stripeChargeId: readStripeChargeId(paymentIntent.latest_charge),
    status: "failed",
    amount: paymentIntent.amount,
    currency: String(paymentIntent.currency ?? "usd"),
    customerEmail: paymentIntent.receipt_email ?? null,
    failureCode: paymentIntent.last_payment_error?.code ?? null,
    failureMessage: paymentIntent.last_payment_error?.message ?? "Payment failed.",
    failedAt: new Date(),
  });

  await markStripeWebhookEventProcessed(stripeEventId);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const payload = await request.text();
    event = getStripeServerClient().webhooks.constructEvent(payload, signature, getWebhookSecret());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe webhook payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const checkoutSessionObject =
      event.data.object && "object" in event.data.object && event.data.object.object === "checkout.session"
        ? (event.data.object as Stripe.Checkout.Session)
        : null;
    const paymentIntentObject =
      event.data.object && "object" in event.data.object && event.data.object.object === "payment_intent"
        ? (event.data.object as Stripe.PaymentIntent)
        : null;

    const checkoutSessionId =
      checkoutSessionObject?.id ??
      (paymentIntentObject?.metadata && typeof paymentIntentObject.metadata.checkout_session_id === "string"
        ? paymentIntentObject.metadata.checkout_session_id
        : null);
    const paymentIntentId =
      readStripePaymentIntentId(checkoutSessionObject?.payment_intent ?? null) ?? paymentIntentObject?.id ?? null;

    const insertResult = await createStripeWebhookEvent(
      event.id,
      event.type,
      event,
      checkoutSessionId,
      paymentIntentId
    );

    if (!insertResult.inserted) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        if (!checkoutSessionObject) {
          break;
        }

        if (checkoutSessionObject.payment_status === "paid") {
          await recordSuccessfulCheckoutSession(event.id, checkoutSessionObject);
        } else {
          await recordPendingCheckoutSession(event.id, checkoutSessionObject);
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        if (checkoutSessionObject) {
          await recordSuccessfulCheckoutSession(event.id, checkoutSessionObject);
        }
        break;
      }
      case "checkout.session.async_payment_failed": {
        if (checkoutSessionObject) {
          await recordFailedCheckoutSession(event.id, checkoutSessionObject);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        if (paymentIntentObject) {
          await recordFailedPaymentIntent(event.id, paymentIntentObject);
        }
        break;
      }
      default: {
        await markStripeWebhookEventProcessed(event.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
