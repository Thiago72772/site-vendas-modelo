/**
 * Payment service abstraction.
 *
 * This module defines the interface for payment operations (currently PIX).
 * The default implementation simulates PIX generation without a real gateway.
 * To integrate a real gateway (Mercado Pago, Efí, Stripe), replace the
 * implementation functions below without changing the UI layer.
 */

export interface PixPaymentData {
  /** The PIX key string (copy-and-paste) */
  pixKey: string;
  /** Encoded payload for QR code generation */
  payload: string;
  /** When the PIX charge expires */
  expiresAt: string;
  /** Amount in BRL */
  amount: number;
}

export type PaymentStatus =
  | 'pending'
  | 'confirmed'
  | 'expired'
  | 'error';

export interface PaymentService {
  /** Generate a PIX charge for a given order */
  generatePix(orderId: string, amount: number): Promise<PixPaymentData>;

  /** Check if a PIX payment has been confirmed */
  checkStatus(orderId: string): Promise<PaymentStatus>;
}

/**
 * Generates a realistic-looking PIX key for demo purposes.
 * In production, this would come from the payment gateway.
 */
function generatePixKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) => {
      let seg = '';
      for (let i = 0; i < len; i++) {
        seg += chars[Math.floor(Math.random() * chars.length)];
      }
      return seg;
    })
    .join('-');
}

/**
 * Simulated payment service for development/demo.
 *
 * IMPORTANT: In production, replace this with a real gateway integration.
 * The interface stays the same — only the implementation changes.
 */
export const paymentService: PaymentService = {
  async generatePix(_orderId: string, amount: number): Promise<PixPaymentData> {
    // Safety invariant: amount must be a positive finite number
    if (!amount || amount <= 0 || !isFinite(amount)) {
      throw new Error(
        `[PIX] Valor inválido recebido: ${amount}. ` +
        'O valor deve ser o total do pedido (subtotal + entrega - desconto).'
      );
    }

    // Simulate a network delay
    await new Promise((r) => setTimeout(r, 600));

    const pixKey = generatePixKey();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    // In a real gateway, the payload would be the BR Code / EMV string
    const payload = `00020126580014br.gov.bcb.pix0136${pixKey}5204000053039865${amount.toFixed(2)}5404${amount.toFixed(2)}5802BR5913LOJA DEMO6009SAO PAULO62070503***6304`;

    return { pixKey, payload, expiresAt, amount };
  },

  async checkStatus(_orderId: string): Promise<PaymentStatus> {
    // Simulate a network delay
    await new Promise((r) => setTimeout(r, 300));

    // In demo mode, we always return 'pending'.
    // The UI provides a manual "confirm payment" button for testing.
    return 'pending';
  },
};

/**
 * Swap this import to use a real gateway:
 * export { realPaymentService as paymentService } from './payment/mercadopago';
 */
