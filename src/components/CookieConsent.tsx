import { useState, useEffect } from 'react';
import { Cookie, X, Check, Settings } from 'lucide-react';

const STORAGE_KEY = 'cookie_consent';

export type CookieConsentValue = 'accepted' | 'rejected' | null;

function getStoredConsent(): CookieConsentValue {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'accepted' || stored === 'rejected') return stored;
  } catch {
    // ignore
  }
  return null;
}

function saveConsent(value: CookieConsentValue) {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function CookieConsent() {
  const [consent, setConsent] = useState<CookieConsentValue>(null);
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) {
      setConsent(stored);
      return;
    }
    // Show after a short delay to avoid blocking initial render
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  function handleAccept() {
    saveConsent('accepted');
    setConsent('accepted');
    setVisible(false);
  }

  function handleReject() {
    saveConsent('rejected');
    setConsent('rejected');
    setVisible(false);
  }

  if (consent || !visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6">
      <div            className="mx-auto max-w-2xl rounded-lg border border-line bg-white p-5 shadow-elevated sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50">
            <Cookie className="h-5 w-5 text-primary-600" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-strong">
              Cookies e Privacidade
            </h3>

            <p className="mt-1 text-sm leading-5 text-mid">
              Utilizamos cookies para melhorar sua experiência, manter seu carrinho
              e analisar o uso da plataforma. Você pode aceitar todos ou recusar
              cookies não essenciais.
            </p>

            {showDetails && (
              <div className="mt-3 rounded-md bg-neutral-50 p-4 text-sm leading-5 text-mid space-y-2">
                <p>
                  <strong className="text-strong">Essenciais:</strong> Necessários
                  para o funcionamento básico do site (carrinho, autenticação, sessão).
                </p>
                <p>
                  <strong className="text-strong">Funcionais:</strong> Permitem
                  salvar preferências como dados de entrega para agilizar próximos pedidos.
                </p>
                <p>
                  <strong className="text-strong">Analíticos:</strong> Nos ajudam a
                  entender como o site é utilizado para melhorar a experiência.
                </p>
                <p className="text-xs text-dim">
                  Ao aceitar, você concorda com o uso de cookies conforme descrito.
                  Você pode alterar suas preferências a qualquer momento limpando
                  os dados do navegador.
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleAccept}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-neutral-900 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                <Check className="h-4 w-4" />
                Aceitar todos
              </button>

              <button
                type="button"
                onClick={handleReject}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-5 text-sm font-semibold text-mid transition hover:bg-page"
              >
                Apenas essenciais
              </button>

              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-mid transition hover:text-mid"
              >
                <Settings className="h-4 w-4" />
                {showDetails ? 'Ocultar detalhes' : 'Gerenciar preferências'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReject}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dim transition hover:bg-surface hover:text-mid"
            aria-label="Rejeitar cookies"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
