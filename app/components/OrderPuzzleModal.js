"use client";

import { useState } from "react";
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
  initialCompletedOrder = null,
}) {
  const [selectedSize, setSelectedSize] = useState(SIZES[1]); // 252 pcs default
  const [loading, setLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(initialCompletedOrder);
  const [orderError, setOrderError] = useState("");

  if (!isOpen) return null;

  const isHighRes = (imageWidth || 800) >= 1400;

  // Handle Stripe Checkout Redirection
  const handleStripeCheckout = async () => {
    setLoading(true);
    setOrderError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: roomCode || "",
          imageUrl,
          sizeId: selectedSize.id,
          sizeTitle: `${selectedSize.name} (${selectedSize.pieces} pièces)`,
          pieces: selectedSize.pieces,
          dimensions: selectedSize.dimensions,
          price: selectedSize.price,
        }),
      });

      const data = await res.json();

      if (data.success && data.url) {
        // Redirect to secure Stripe Checkout hosted page
        window.location.href = data.url;
        return;
      }

      if (data.requiresKey) {
        setOrderError(
          "Clé Stripe non configurée : ajoute STRIPE_SECRET_KEY=sk_test_... dans .env.local, ou clique sur 'Tester en simulation' ci-dessous pour tester sans carte."
        );
      } else {
        setOrderError(data.message || "Erreur lors de la redirection vers Stripe.");
      }
    } catch (err) {
      setOrderError(err.message || "Impossible de contacter le serveur de paiement.");
    } finally {
      setLoading(false);
    }
  };

  // Simulated order for instant testing without a configured Stripe Secret Key
  const handleSimulatedOrder = async () => {
    setLoading(true);
    setOrderError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "simulation",
          roomCode: roomCode || "",
          imageUrl,
          sizeTitle: `${selectedSize.name} (${selectedSize.pieces} pièces)`,
          pieces: selectedSize.pieces,
          dimensions: selectedSize.dimensions,
          price: selectedSize.price,
          buyerName: "Testeur Démo",
          buyerEmail: "client@example.com",
          shippingAddress: {
            line1: "12 Rue de la Paix",
            postal_code: "75001",
            city: "Paris",
            country: "France",
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCompletedOrder(data.order);
      } else {
        setOrderError(data.error || "Impossible d'enregistrer la commande simulée.");
      }
    } catch (err) {
      setOrderError(err.message || "Erreur lors de la simulation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fermer la fenêtre"
        >
          ✕
        </button>

        {completedOrder ? (
          /* Confirmation / Success Screen */
          <div className={styles.successCard}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.successTitle}>Commande confirmée !</h2>
            <p className={styles.successDesc}>
              Merci {completedOrder.buyer?.name || "pour votre commande"} ! Votre puzzle physique personnalisé
              est envoyé en fabrication.
            </p>

            <div className={styles.orderReferenceBox}>
              <span className={styles.refLabel}>Référence de suivi</span>
              <span className={styles.refCode}>{completedOrder.orderNumber}</span>
            </div>

            <div className={styles.orderDetailsGrid}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Format</span>
                <span className={styles.detailValue}>
                  {completedOrder.puzzle?.sizeTitle || `${completedOrder.puzzle?.pieces} pièces`}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Dimensions</span>
                <span className={styles.detailValue}>
                  {completedOrder.puzzle?.dimensions || "Format standard"}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Montant réglé</span>
                <span className={styles.detailValue}>
                  {completedOrder.puzzle?.price} € (TTC)
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Expédition</span>
                <span className={styles.detailValue} style={{ color: "#34D399" }}>
                  Livraison suivie offerte
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={onClose}
              style={{ marginTop: "1rem" }}
            >
              Retourner au puzzle
            </button>
          </div>
        ) : (
          /* Order Configuration Screen */
          <>
            <div className={styles.header}>
              <div className={styles.badge}>
                <span>✨</span> Puzzle Réel Personnalisé
              </div>
              <h2 className={styles.title}>Recevez votre chef-d'œuvre chez vous</h2>
              <p className={styles.subtitle}>
                Faites fabriquer votre puzzle en version physique avec sa boîte cadeau illustrée.
              </p>
            </div>

            <div className={styles.body}>
              {/* 3D Box Mockup Column */}
              <div className={styles.previewCol}>
                <div className={styles.boxCard}>
                  <div className={styles.mockupWrapper}>
                    <div className={styles.boxLid}>
                      <div className={styles.boxImageWrapper}>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt="Aperçu sur boîte puzzle"
                            className={styles.boxImage}
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              background: "#334155",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#94A3B8",
                            }}
                          >
                            Image puzzle
                          </div>
                        )}
                        <div className={styles.boxHeaderOverlay}>
                          <div className={styles.boxLogoBadge}>
                            <span>🧩</span> Puzzle Online
                          </div>
                          <div className={styles.boxPieceCount}>
                            {selectedSize.pieces} pièces
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles.boxEdgeShadow} />
                  </div>
                </div>

                <div className={styles.qualityIndicator}>
                  <span className={styles.qualityDot} />
                  <span>
                    {isHighRes
                      ? "Résolution HD optimale pour l'impression"
                      : "Impression offset sur carton bleu premium 2mm"}
                  </span>
                </div>
              </div>

              {/* Selection & Payment Column */}
              <div className={styles.optionsCol}>
                <div>
                  <div className={styles.sectionLabel}>Choisissez votre format</div>
                  <div className={styles.sizeGrid}>
                    {SIZES.map((size) => {
                      const isSelected = selectedSize.id === size.id;
                      return (
                        <div
                          key={size.id}
                          className={`${styles.sizeCard} ${
                            isSelected ? styles.sizeCardActive : ""
                          }`}
                          onClick={() => setSelectedSize(size)}
                        >
                          {size.popular && (
                            <span className={styles.popularBadge}>Le plus populaire</span>
                          )}
                          <div className={styles.sizeLeft}>
                            <div className={styles.radioIndicator}>
                              {isSelected && <div className={styles.radioInner} />}
                            </div>
                            <div>
                              <div className={styles.sizeTitle}>{size.name}</div>
                              <div className={styles.sizeMeta}>
                                {size.pieces} pièces • {size.dimensions}
                              </div>
                            </div>
                          </div>
                          <div className={styles.sizePrice}>{size.price} €</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.featuresList}>
                  <div className={styles.featureItem}>
                    <span className={styles.featureIcon}>📦</span>
                    <span>Livraison suivie offerte</span>
                  </div>
                  <div className={styles.featureItem}>
                    <span className={styles.featureIcon}>🎁</span>
                    <span>Boîte illustrée incluse</span>
                  </div>
                  <div className={styles.featureItem}>
                    <span className={styles.featureIcon}>🔒</span>
                    <span>Paiement Stripe sécurisé</span>
                  </div>
                  <div className={styles.featureItem}>
                    <span className={styles.featureIcon}>↩️</span>
                    <span>Remboursement garanti en 1 clic</span>
                  </div>
                </div>

                {orderError && (
                  <div className={styles.errorBanner}>{orderError}</div>
                )}

                <div className={styles.actionSection}>
                  <button
                    type="button"
                    className={styles.stripePayBtn}
                    onClick={handleStripeCheckout}
                    disabled={loading}
                  >
                    {loading ? (
                      <span>Chargement...</span>
                    ) : (
                      <>
                        <span>💳</span>
                        <span>
                          Commander avec Stripe • {selectedSize.price} €
                        </span>
                      </>
                    )}
                  </button>

                  <div className={styles.paymentBadgesRow}>
                    <span className={styles.payBadgeItem}>🍎 Apple Pay</span>
                    <span className={styles.payBadgeItem}>⚡ Google Pay</span>
                    <span className={styles.payBadgeItem}>💳 Cartes Bancaires / Visa</span>
                  </div>

                  <button
                    type="button"
                    className={styles.simulateBtn}
                    onClick={handleSimulatedOrder}
                    disabled={loading}
                    title="Teste tout le flux de commande sans utiliser de vraie carte bancaire"
                  >
                    🧪 Tester la commande en mode simulation (sans carte)
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
