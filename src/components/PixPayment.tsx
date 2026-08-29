import { useState, useEffect, useCallback } from 'react';
import {
  Copy,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  QrCode,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import type { PixPaymentData, PaymentStatus } from '@/lib/payment';
import { paymentService } from '@/lib/payment';
import { formatCurrency } from '@/lib/format';

interface PixPaymentProps {
  orderId: string;
  amount: number;
  onConfirmed: () => void;
}

export function PixPayment({ orderId, amount, onConfirmed }: PixPaymentProps) {
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [polling, setPolling] = useState(false);

  // Generate PIX data
  useEffect(() => {
    let active = true;

    async function generate() {
      try {
        setLoading(true);
        setError(null);

        // Safety validation: amount must be a positive number
        if (!amount || amount <= 0 || !isFinite(amount)) {
          if (active) {
            setError('Valor do pagamento inválido. Volte ao cardápio e tente novamente.');
            setLoading(false);
          }
          return;
        }

        // Dev audit log
        if (import.meta.env.DEV) {
          console.log(
            `%c[PIX] Gerando cobrança: orderId=${orderId}, amount=${amount.toFixed(2)}`,
            'color: #2563eb; font-weight: bold'
          );
        }

        const data = await paymentService.generatePix(orderId, amount);
        if (active) {
          setPixData(data);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError('Erro ao gerar código PIX. Tente novamente.');
          setLoading(false);
        }
      }
    }

    generate();
    return () => {
      active = false;
    };
  }, [orderId, amount]);

  // Countdown timer
  useEffect(() => {
    if (!pixData) return;

    function updateTimer() {
      const remaining = Math.max(
        0,
        Math.floor(
          (new Date(pixData!.expiresAt).getTime() - Date.now()) / 1000
        )
      );
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setStatus('expired');
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pixData]);

  // Polling for payment status
  const pollStatus = useCallback(async () => {
    if (status !== 'pending' || polling) return;
    setPolling(true);
    try {
      const result = await paymentService.checkStatus(orderId);
      setStatus(result);
      if (result === 'confirmed') {
        onConfirmed();
      }
    } finally {
      setPolling(false);
    }
  }, [orderId, status, polling, onConfirmed]);

  // Auto-poll every 5 seconds
  useEffect(() => {
    if (status !== 'pending') return;
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [status, pollStatus]);

  async function handleCopy() {
    if (!pixData) return;
    try {
      await navigator.clipboard.writeText(pixData.pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = pixData.pixKey;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleConfirmPayment() {
    // In demo mode: mark as confirmed
    setStatus('confirmed');
    onConfirmed();
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Generate a simple visual QR pattern from the PIX key
  function renderQrPattern(key: string): boolean[][] {
    const size = 21;
    const grid: boolean[][] = [];
    // Seed from key hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    for (let y = 0; y < size; y++) {
      grid[y] = [];
      for (let x = 0; x < size; x++) {
        // Corner patterns (finder patterns)
        const inCorner =
          (x < 7 && y < 7) ||
          (x >= size - 7 && y < 7) ||
          (x < 7 && y >= size - 7);
        if (inCorner) {
          const cx = x < 7 ? x : x - (size - 7);
          const cy = y < 7 ? y : y - (size - 7);
          grid[y][x] =
            cx === 0 ||
            cx === 6 ||
            cy === 0 ||
            cy === 6 ||
            (cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4);
        } else {
          hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
          grid[y][x] = (hash % 3) === 0;
        }
      }
    }
    return grid;
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
        <p className="mt-3 text-sm text-mid">
          Gerando código PIX...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-100 bg-rose-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <p className="text-sm font-medium text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-5 text-center">
        <Clock className="mx-auto h-8 w-8 text-amber-500" />
        <p className="mt-3 text-sm font-semibold text-amber-700">
          Código PIX expirado
        </p>
        <p className="mt-1 text-sm text-amber-600">
          O prazo de 30 minutos para pagamento expirou. Volte ao cardápio e
          inicie um novo pedido.
        </p>
      </div>
    );
  }

  if (status === 'confirmed') {
    return (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="mt-3 text-base font-semibold text-emerald-700">
          Pagamento confirmado!
        </p>
        <p className="mt-1 text-sm text-emerald-600">
          Seu pedido está sendo preparado.
        </p>
      </div>
    );
  }

  // Pending state — show PIX details
  return (
    <div className="rounded-lg border border-line bg-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-line bg-neutral-50 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary-600" />
            <h3 className="text-sm font-semibold text-strong">
              Pagamento via PIX
            </h3>
          </div>
          <div className="flex items-center gap-1.5 rounded-sm bg-primary-50 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
            </span>
            <span className="text-xs font-medium text-primary-700">
              Aguardando pagamento
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* QR Code */}
        <div className="flex justify-center">
          <div className="rounded-lg border border-line bg-white p-4">
            {pixData && (() => {
              const grid = renderQrPattern(pixData.pixKey);
              const cellSize = 7;
              const size = grid.length * cellSize;
              return (
                <svg
                  width={size}
                  height={size}
                  viewBox={`0 0 ${size} ${size}`}
                  className="block"
                  role="img"
                  aria-label="QR Code PIX"
                >
                  {grid.map((row, y) =>
                    row.map((cell, x) =>
                      cell ? (
                        <rect
                          key={`${x}-${y}`}
                          x={x * cellSize}
                          y={y * cellSize}
                          width={cellSize}
                          height={cellSize}
                          fill="#171717"
                        />
                      ) : null
                    )
                  )}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* Amount */}
        <div className="text-center">
          <p className="text-xs text-mid">Valor a pagar</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-950">
            {formatCurrency(amount)}
          </p>
        </div>

        {/* PIX Key — Copy & Paste */}
        <div>
          <p className="text-xs font-medium text-mid mb-2">
            Copie a chave PIX abaixo e cole no seu app do banco:
          </p>
          <div className="flex items-center gap-2 rounded-md border border-line bg-neutral-50 p-3">
            <p className="min-w-0 flex-1 truncate font-mono text-sm text-mid">
              {pixData?.pixKey}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center justify-center gap-2 rounded-md bg-neutral-50 py-3">
          <Clock className="h-4 w-4 text-dim" />
          <span className="text-sm text-mid">
            Expira em{' '}
            <span className="font-mono font-semibold text-strong">
              {formatTime(timeLeft)}
            </span>
          </span>
        </div>

        {/* Demo: Manual confirmation */}
        <div className="rounded-md border border-dashed border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700 mb-2">
            Modo de demonstração
          </p>
          <p className="text-xs leading-5 text-amber-600 mb-3">
            Nenhum gateway de pagamento real está conectado. Clique abaixo para
            simular a confirmação do pagamento.
          </p>
          <button
            type="button"
            onClick={handleConfirmPayment}
            className="w-full rounded-md bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Confirmar pagamento (demo)
          </button>
        </div>

        {/* Instructions */}
        <div className="space-y-2 text-xs text-mid">
          <p className="font-medium text-mid">Como pagar:</p>
          <ol className="list-inside list-decimal space-y-1 pl-1">
            <li>Abra o app do seu banco ou carteira digital</li>
            <li>Escolha a opção <strong>Pagar com PIX</strong></li>
            <li>Cole a chave PIX copiada acima</li>
            <li>Confirme o pagamento no app</li>
            <li>O pedido será confirmado automaticamente</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
