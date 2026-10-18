"use client";

import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import styles from "./OrderPuzzleModal.module.css";

const SIZES = [
  {
    id: "120",
    name: "Format Découverte",
    pieces: 120,
    dimensions: "20 × 28 cm",
    price: "19.90",
    popular: false,
  },
  {
    id: "252",
    name: "Format Classique",
    pieces: 252,
    dimensions: "28 × 38 cm",
    price: "24.90",
    popular: true,
  },
  {
    id: "500",
    name: "Format Expert",
    pieces: 500,
    dimensions: "38 × 50 cm",
    price: "29.90",
    popular: false,
  },
];

export default function OrderPuzzleModal({
  isOpen,
  onClose,
  imageUrl,
  imageWidth,
  imageHeight,
  roomCode,
}) {
  const [selectedSize, setSelectedSize] = useState(SIZES[1]); // 252 pcs default
  const [loading, setLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [orderError, setOrderError] = useState("");

  if (!isOpen) return null;

  const isHighRes = (imageWidth || 800) >= 1400;
  const paypalClientId =
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
    "test"; // Uses sandbox demo credentials if not configured in .env

  const recordOrder = async (orderData) => {
    setLoading(true);
    setOrderError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: roomCode || "",
          imageUrl,
          sizeTitle: `${selectedSize.name} (${selectedSize.pieces} pièces)`,
          pieces: selectedSize.pieces,
          dimensions: selectedSize.dimensions,
          price: selectedSize.price,
          paypalOrderId: orderData.id,
          buyerName:
            orderData.payer?.name?.given_name
              ? `${orderData.payer.name.given_name} ${orderData.payer.name.surname || ""}`
              : orderData.buyerName || "Client Puzzle",
          buyerEmail: orderData.payer?.email_address || orderData.buyerEmail || "",
          shippingAddress:
            orderData.purchase_units?.[0]?.shipping?.address ||
            orderData.shippingAddress ||
            {},
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCompletedOrder(data.order);
      } else {
        setOrderError(data.error || "Impossible d'enregistrer la commande.");
      }
    } catch (err) {
      setOrderError(err.message || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  // Simulated order for instant testing without a real PayPal merchant account
  const handleSimulatedOrder = () => {
    recordOrder({
      id: `SIM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      buyerName: "Testeur Démo",
      buyerEmail: "client@example.com",
      shippingAddress: {
        address_line_1: "12 Rue de la Paix",
        admin_area_2: "Paris",
        postal_code: "75001",
        country_code: "FR",
      },
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>

        {completedOrder ? (
          /* Confirmation Screen */
          <div className={styles.successScreen}>
            <div className={styles.successIcon}>🎉</div>
            <h3 className={styles.successTitle}>Commande confirmée !</h3>
            <p className={styles.successText}>
              Votre puzzle personnalisé entre en fabrication. Vous recevrez un
              email de confirmation avec le numéro de suivi du colis.
            </p>

            <div className={styles.orderRecapBox}>
              <div className={styles.recapRow}>
                <span className={styles.recapLabel}>N° Commande</span>
                <span className={styles.recapVal}>{completedOrder.orderNumber}</span>
              </div>
              <div className={styles.recapRow}>
                <span className={styles.recapLabel}>Format</span>
                <span className={styles.recapVal}>
                  {completedOrder.puzzle.pieces} pièces ({completedOrder.puzzle.dimensions})
                </span>
              </div>
              <div className={styles.recapRow}>
                <span className={styles.recapLabel}>Montant réglé</span>
                <span className={styles.recapVal}>{completedOrder.puzzle.price} € TTC</span>
              </div>
              <div className={styles.recapRow}>
                <span className={styles.recapLabel}>Livraison</span>
                <span className={styles.recapVal}>Offerte (5 à 7 jours ouvrés)</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={onClose}
              style={{ width: "100%" }}
            >
              Retour au jeu
            </button>
          </div>
        ) : (
          /* Order Configuration Screen */
          <div>
            <div className={styles.modalHeader}>
              <div className={styles.modalBadge}>
                <span className="badge badge-brand">Édition Physique Personnalisée</span>
              </div>
              <h2 className={styles.modalTitle}>Commandez votre puzzle en vrai</h2>
              <p className={styles.modalSubtitle}>
                Fabriqué sur carton premium haute densité avec votre photo imprimée
                sur le puzzle et sa boîte cadeau sur-mesure.
              </p>
            </div>

            {/* 3D Box Preview */}
            <div className={styles.mockupWrapper}>
              <div className={styles.boxMockup}>
                <div className={styles.boxImageArea}>
                  <img
                    className={styles.boxImage}
                    src={imageUrl}
                    alt="Aperçu du puzzle"
                    crossOrigin="anonymous"
                  />
                  <div className={styles.boxRibbon}>Boîte Cadeau Incluse</div>
                </div>
                <div className={styles.boxFooter}>
                  <span className={styles.boxTitle}>PuzzleTogether</span>
                  <span className={styles.boxPiecesPill}>
                    {selectedSize.pieces} pièces
                  </span>
                </div>
              </div>
            </div>

            {/* Image Resolution Indicator */}
            <div className={styles.qualityRow}>
              <span
                className={`${styles.qualityIndicator} ${
                  isHighRes ? styles.qualityGood : styles.qualityNotice
                }`}
              />
              <span>
                {isHighRes
                  ? "Qualité d'image optimale pour impression HD"
                  : "Résolution standard convenable pour l'impression"}
              </span>
            </div>

            {/* Size Options */}
            <div className={styles.sizeList}>
              {SIZES.map((size) => (
                <div
                  key={size.id}
                  className={`${styles.sizeCard} ${
                    selectedSize.id === size.id ? styles.sizeActive : ""
                  }`}
                  onClick={() => setSelectedSize(size)}
                >
                  <div className={styles.sizeLeft}>
                    <div className={styles.sizeRadio}>
                      {selectedSize.id === size.id && (
                        <div className={styles.sizeRadioDot} />
                      )}
                    </div>
                    <div className={styles.sizeInfo}>
                      <div className={styles.sizeNameRow}>
                        <span className={styles.sizeName}>
                          {size.name} • {size.pieces} pièces
                        </span>
                        {size.popular && (
                          <span className={styles.bestSellerBadge}>Populaire</span>
                        )}
                      </div>
                      <span className={styles.sizeDimensions}>
                        Taille finale : {size.dimensions}
                      </span>
                    </div>
                  </div>
                  <div className={styles.sizePrice}>{size.price} €</div>
                </div>
              ))}
            </div>

            {/* Key Value Propositions */}
            <div className={styles.featuresGrid}>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>🚚</span>
                <span>Livraison suivie offerte</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>🎁</span>
                <span>Boîte personnalisée incluse</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>🧩</span>
                <span>Carton bleu haute densité</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>🛡️</span>
                <span>Satisfait ou remboursé</span>
              </div>
            </div>

            {orderError && (
              <div
                style={{
                  color: "#FCA5A5",
                  background: "rgba(239, 68, 68, 0.15)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  marginBottom: "14px",
                  fontSize: "13px",
                  textAlign: "center",
                }}
              >
                ⚠️ {orderError}
              </div>
            )}

            {/* PayPal Checkout Area */}
            <div className={styles.checkoutArea}>
              <div className={styles.paypalContainer}>
                <PayPalScriptProvider
                  options={{
                    clientId: paypalClientId,
                    currency: "EUR",
                    intent: "capture",
                  }}
                >
                  <PayPalButtons
                    style={{
                      layout: "vertical",
                      color: "gold",
                      shape: "rect",
                      label: "pay",
                    }}
                    createOrder={(data, actions) => {
                      return actions.order.create({
                        purchase_units: [
                          {
                            description: `Puzzle personnalisé ${selectedSize.pieces} pièces (${selectedSize.dimensions})`,
                            amount: {
                              currency_code: "EUR",
                              value: selectedSize.price,
                            },
                          },
                        ],
                        application_context: {
                          shipping_preference: "GET_FROM_FILE", // Retrieves buyer's shipping address automatically!
                        },
                      });
                    }}
                    onApprove={async (data, actions) => {
                      const details = await actions.order.capture();
                      recordOrder(details);
                    }}
                    onError={(err) => {
                      console.error("PayPal Error:", err);
                      setOrderError(
                        "Erreur PayPal. Utilisez le bouton démo ci-dessous pour tester sans carte."
                      );
                    }}
                  />
                </PayPalScriptProvider>
              </div>

              {/* Simulation button for demo / testing */}
              <button
                type="button"
                className={styles.simulatedCheckoutBtn}
                onClick={handleSimulatedOrder}
                disabled={loading}
              >
                {loading ? "Enregistrement..." : "🧪 Tester la commande en mode simulation (sans carte)"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
