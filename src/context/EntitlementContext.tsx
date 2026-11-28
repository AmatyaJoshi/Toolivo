import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { SupportedCurrency } from '../data/proPlans';
import { SPONSOR_FRAMES, type SponsorFrame } from '../data/sponsors';
import {
  signInWithGoogleOptional,
  signOutOptional,
  subscribeOptionalAuth,
} from '../lib/firebaseClient';

export interface ActiveEntitlement {
  id: string;
  provider: 'dodo' | 'stripe';
  planId: string;
  planName: string;
  entitlementType: 'pass' | 'subscription' | 'one_time' | 'credits';
  status: string;
  active: boolean;
  creditsBalance: number;
  creditsTotal: number;
  expiresAt: string | null;
  licenseKeyPreview: string;
  customerEmail: string;
  linkedFirebaseUid: string | null;
  deviceCount: number;
}

interface EntitlementContextValue {
  currency: SupportedCurrency;
  setCurrency: (c: SupportedCurrency) => void;
  entitlement: ActiveEntitlement | null;
  isPro: boolean;
  sponsorFrames: SponsorFrame[];
  refreshSponsors: () => Promise<void>;
  activateByKey: (rawKey: string) => Promise<{ ok: boolean; error?: string }>;
  clearEntitlement: () => void;
  optionalUser: User | null;
  connectGoogleAccount: () => Promise<{ ok: boolean; error?: string }>;
  disconnectGoogleAccount: () => Promise<void>;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

const KEY_STORAGE = 'toolivo_pro_recovery_key';
const DEVICE_STORAGE = 'toolivo_device_id';
const CURRENCY_STORAGE = 'toolivo_currency_v2';

function detectDefaultCurrency(): SupportedCurrency {
  const saved = localStorage.getItem(CURRENCY_STORAGE) as SupportedCurrency | null;
  if (saved && ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD'].includes(saved)) {
    return saved;
  }
  return 'USD';
}

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_STORAGE);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(DEVICE_STORAGE, id);
  }
  return id;
}

export const EntitlementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(detectDefaultCurrency);
  const [entitlement, setEntitlement] = useState<ActiveEntitlement | null>(null);
  const [sponsorFrames, setSponsorFrames] = useState<SponsorFrame[]>(SPONSOR_FRAMES);
  const [optionalUser, setOptionalUser] = useState<User | null>(null);

  const setCurrency = useCallback((next: SupportedCurrency) => {
    setCurrencyState(next);
    localStorage.setItem(CURRENCY_STORAGE, next);
  }, []);

  const refreshSponsors = useCallback(async () => {
    try {
      const res = await fetch('/api/sponsors');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.frames) && data.frames.length > 0) {
        setSponsorFrames(data.frames);
      }
    } catch {
      // Keep default frames if offline
    }
  }, []);

  const activateByKey = useCallback(async (rawKey: string) => {
    const cleaned = rawKey.trim().toUpperCase();
    if (!cleaned) return { ok: false, error: 'Enter a recovery key.' };

    try {
      const res = await fetch('/api/pro/entitlement/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: cleaned,
          deviceId: getOrCreateDeviceId(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.valid && data.entitlement) {
        localStorage.setItem(KEY_STORAGE, cleaned);
        setEntitlement(data.entitlement);
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Recovery key is invalid or expired.' };
    } catch {
      return { ok: false, error: 'Could not verify recovery key right now.' };
    }
  }, []);

  const clearEntitlement = useCallback(() => {
    localStorage.removeItem(KEY_STORAGE);
    setEntitlement(null);
  }, []);

  // Validate saved accountless recovery key on mount & fetch live sponsor frames
  useEffect(() => {
    refreshSponsors();
    const savedKey = localStorage.getItem(KEY_STORAGE);
    if (savedKey) {
      activateByKey(savedKey).then((res) => {
        if (!res.ok) {
          localStorage.removeItem(KEY_STORAGE);
        }
      });
    }
  }, [activateByKey, refreshSponsors]);

  // Optional Firebase Auth listener for registered account entitlement sync
  useEffect(() => {
    return subscribeOptionalAuth(async (user) => {
      setOptionalUser(user);
      if (user && user.email) {
        try {
          const savedKey = localStorage.getItem(KEY_STORAGE) || undefined;
          const res = await fetch('/api/pro/entitlement/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firebaseUid: user.uid,
              email: user.email,
              licenseKey: savedKey,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.entitlements) && data.entitlements.length > 0) {
              setEntitlement(data.entitlements[0]);
            }
          }
        } catch {
          // Optional sync silent fallback
        }
      }
    });
  }, []);

  const connectGoogleAccount = useCallback(async () => {
    try {
      const user = await signInWithGoogleOptional();
      if (!user.email) {
        return { ok: false, error: 'Google account did not return an email address.' };
      }
      const savedKey = localStorage.getItem(KEY_STORAGE) || undefined;
      const res = await fetch('/api/pro/entitlement/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: user.uid,
          email: user.email,
          licenseKey: savedKey,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.entitlements) && data.entitlements.length > 0) {
        setEntitlement(data.entitlements[0]);
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Google sign-in was cancelled.',
      };
    }
  }, []);

  const disconnectGoogleAccount = useCallback(async () => {
    await signOutOptional();
    setOptionalUser(null);
  }, []);

  return (
    <EntitlementContext.Provider
      value={{
        currency,
        setCurrency,
        entitlement,
        isPro: Boolean(entitlement?.active),
        sponsorFrames,
        refreshSponsors,
        activateByKey,
        clearEntitlement,
        optionalUser,
        connectGoogleAccount,
        disconnectGoogleAccount,
      }}
    >
      {children}
    </EntitlementContext.Provider>
  );
};

export function useEntitlement(): EntitlementContextValue {
  const ctx = useContext(EntitlementContext);
  if (!ctx) {
    throw new Error('useEntitlement must be used inside EntitlementProvider');
  }
  return ctx;
}
