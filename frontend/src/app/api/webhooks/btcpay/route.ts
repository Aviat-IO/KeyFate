import { getCryptoPaymentProvider } from "@/lib/payment";
import { serverEnv } from "@/lib/server-env";
import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const signature = request.headers.get("btcpay-sig");

        if (!signature) {
            console.error("BTCPay webhook missing signature header");
            return NextResponse.json({ error: "No signature provided" }, {
                status: 400,
            });
        }

        const cryptoPaymentProvider = getCryptoPaymentProvider();

        // Verify webhook signature
        const event = await cryptoPaymentProvider.verifyWebhookSignature(
            body,
            signature,
            serverEnv.BTCPAY_WEBHOOK_SECRET,
        );

        const supabase = await createClient();

        // Handle different event types
        switch (event.type) {
            case "InvoiceSettled":
                await handleInvoiceSettled(
                    event.data.object as Record<string, unknown>,
                    supabase,
                );
                break;
            case "InvoiceExpired":
                await handleInvoiceExpired(
                    event.data.object as Record<string, unknown>,
                );
                break;
            case "InvoiceInvalid":
                await handleInvoiceInvalid(
                    event.data.object as Record<string, unknown>,
                );
                break;
            case "InvoiceProcessing":
                await handleInvoiceProcessing(
                    event.data.object as Record<string, unknown>,
                );
                break;
            case "InvoiceCreated":
                await handleInvoiceCreated(
                    event.data.object as Record<string, unknown>,
                );
                break;
            default:
                console.log(`Unhandled BTCPay event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("BTCPay webhook error:", error);

        // Provide more specific error responses
        if (
            error instanceof Error &&
            error.message.includes("Invalid webhook signature")
        ) {
            return NextResponse.json({
                error: "Invalid webhook signature",
                details: error.message,
            }, {
                status: 401,
            });
        }

        if (error instanceof SyntaxError) {
            return NextResponse.json({
                error: "Invalid JSON payload",
            }, {
                status: 400,
            });
        }

        return NextResponse.json({
            error: "Webhook processing failed",
            details: error instanceof Error ? error.message : "Unknown error",
        }, {
            status: 500,
        });
    }
}

async function handleInvoiceSettled(
    invoice: Record<string, unknown>,
    supabase: SupabaseClient,
) {
    const metadata = (invoice.metadata as Record<string, string>) || {};
    const userId = metadata.user_id;
    if (!userId) {
        console.error("No user_id in invoice metadata");
        return;
    }

    if (metadata.mode === "subscription") {
        await supabase
            .from("user_subscriptions")
            .upsert({
                user_id: userId,
                provider: "btcpay",
                provider_subscription_id: String(invoice.id || ""),
                status: "active",
                tier_name: "pro",
                current_period_start: new Date(),
                current_period_end: calculateNextBillingDate(
                    (metadata.interval as string) || "month",
                ),
            });

        // Ensure user_tiers reflects Pro
        const { data: proTier } = await supabase
            .from("tiers")
            .select("id")
            .eq("name", "pro")
            .single();
        if (proTier?.id) {
            await supabase
                .from("user_tiers")
                .upsert({ user_id: userId, tier_id: proTier.id });
        }
    }
    console.log(`Bitcoin payment settled for user ${userId}`);
}

async function handleInvoiceExpired(invoice: Record<string, unknown>) {
    console.log(`Invoice expired: ${String(invoice.id || "unknown")}`);
}

async function handleInvoiceInvalid(invoice: Record<string, unknown>) {
    console.log(`Invoice invalid: ${String(invoice.id || "unknown")}`);
}

async function handleInvoiceProcessing(invoice: Record<string, unknown>) {
    console.log(`Invoice processing: ${String(invoice.id || "unknown")}`);
}

async function handleInvoiceCreated(invoice: Record<string, unknown>) {
    console.log(`Invoice created: ${String(invoice.id || "unknown")}`);
    // TODO: Save a record of the invoice in the database. Can be used to send coupons later.
}

function calculateNextBillingDate(interval: string): Date {
    const now = new Date();
    switch (interval) {
        case "month":
            now.setMonth(now.getMonth() + 1);
            return now;
        case "year":
            now.setFullYear(now.getFullYear() + 1);
            return now;
        default:
            now.setMonth(now.getMonth() + 1);
            return now;
    }
}
