import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingScreen({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-page">
      <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
      <p className="text-sm text-mid">{message}</p>
    </div>
  );
}

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`w-4 h-4 animate-spin ${className}`} />;
}

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-strong">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-mid">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Placeholder({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      {icon && (
        <div className="w-12 h-12 rounded-md bg-surface flex items-center justify-center mb-3 text-primary-500">
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold text-strong">{title}</h2>
      <p className="mt-0.5 text-sm text-mid max-w-sm">{description}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-md bg-error-500/10 flex items-center justify-center mb-3 text-error-500">
        <span className="text-lg font-bold">!</span>
      </div>
      <h2 className="text-base font-semibold text-strong">Algo deu errado</h2>
      <p className="mt-0.5 text-sm text-mid max-w-sm">{message}</p>
    </div>
  );
}
