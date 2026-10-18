import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req) {
  try {
    const body = await req.json();
    const { roomCode, imageUrl, pieces, dimensions, price, sizeTitle } = body;

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || secretKey.trim() === "" || secretKey === "sk_test_placeholder") {
      return NextResponse.json({
        success: false,
        requiresKey: true,
        message: "Stripe Secret Key non configurée dans .env.local (ajoute STRIPE_SECRET_KEY=sk_test_... ou teste en mode simulation).",
      }, { status: 400 });
    }

    const stripe = new Stripe(secretKey);

    // Determine base URL from headers or fallback
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;

    // Validate image URL for Stripe line items (Stripe requires absolute https URLs for images)
    const validImage = imageUrl && imageUrl.startsWith("https://") ? [imageUrl] : [];

    const amountInCents = Math.round(parseFloat(price) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Puzzle Photo Personnalisé (${pieces} pièces)`,
              description: `Dimensions : ${dimensions} • Carton premium 2mm • Boîte cadeau personnalisée incluse`,
              images: validImage,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: [
          "FR", "BE", "CH", "LU", "MC", "CA", "US", "DE", "ES", "IT", "GB", "NL", "PT", "IE", "AT"
        ],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "eur" },
            display_name: "Livraison standard suivie (Offerte)",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 4 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
      ],
      metadata: {
        roomCode: roomCode || "",
        pieces: String(pieces),
        dimensions: dimensions || "",
        price: String(price),
        sizeTitle: sizeTitle || "",
        imageUrl: imageUrl || "",
      },
      success_url: `${origin}/room/${roomCode}?order_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/room/${roomCode}?order_status=cancel`,
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("[Stripe Checkout Error]:", err);
    return NextResponse.json({
      success: false,
      message: err.message || "Erreur lors de la création de la session de paiement.",
    }, { status: 500 });
  }
}
