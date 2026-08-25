import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Tenant } from '@/lib/types';

/**
 * Loads a tenant by slug from the public store and applies its brand colors
 * as CSS custom properties on :root so the entire app re-themes at runtime.
 */
export function useTenant(slug: string | undefined) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let active = true;

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', slug)
        .eq('ativo', true)
        .maybeSingle();

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Loja não encontrada ou inativa.');
        setLoading(false);
        return;
      }

      setTenant(data as Tenant);
      applyTenantColors(data.cor_primaria, data.cor_secundaria);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  return { tenant, loading, error };
}

/**
 * Converts a hex color (#RRGGBB) into a 10-step Tailwind-compatible ramp
 * and sets the CSS custom properties --cor-primaria-* / --cor-secundaria-*.
 */
export function applyTenantColors(
  corPrimaria: string | null | undefined,
  corSecundaria: string | null | undefined
) {
  const root = document.documentElement;

  if (corPrimaria) {
    const ramp = generateColorRamp(corPrimaria);
    ramp.forEach((rgb, i) => {
      const shade = (i + 1) * 50;
      root.style.setProperty(`--cor-primaria-${shade}`, rgb);
    });
  }

  if (corSecundaria) {
    const ramp = generateColorRamp(corSecundaria);
    ramp.forEach((rgb, i) => {
      const shade = (i + 1) * 50;
      root.style.setProperty(`--cor-secundaria-${shade}`, rgb);
    });
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function mix(channel: number, target: number, weight: number): number {
  return Math.round(channel + (target - channel) * weight);
}

function rgbString(r: number, g: number, b: number): string {
  return `${r} ${g} ${b}`;
}

/**
 * Generates a 10-step ramp (50–500) from a base hex color.
 * Shades 50–400 lighten the color toward white; 500 is the base; 600–900 darken toward black.
 */
function generateColorRamp(hex: string): string[] {
  const [r, g, b] = hexToRgb(hex);
  const ramp: string[] = [];

  const lightStops = [0.9, 0.8, 0.6, 0.3];
  lightStops.forEach((w) => {
    ramp.push(rgbString(mix(r, 255, w), mix(g, 255, w), mix(b, 255, w)));
  });

  ramp.push(rgbString(r, g, b));

  const darkStops = [0.15, 0.3, 0.45, 0.6, 0.7];
  darkStops.forEach((w) => {
    ramp.push(rgbString(mix(r, 0, w), mix(g, 0, w), mix(b, 0, w)));
  });

  return ramp;
}
