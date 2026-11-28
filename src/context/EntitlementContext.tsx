import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { SupportedCurrency } from '../data/proPlans';
import { SPONSOR_FRAMES, type SponsorFrame } from '../data/sponsors';

export interface OptionalAuthUser {
  uid: string;
  email: string | null;
}

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
  activeRecoveryKey: string | null;
  isPro: boolean;
  sponsorFrames: SponsorFrame[];
  refreshSponsors: () => Promise<void>;
  activateByKey: (rawKey: string) => Promise<{ ok: boolean; error?: string }>;
  clearEntitlement: () => void;
  optionalUser: OptionalAuthUser | null;
  connectGoogleAccount: () => Promise<{ ok: boolean; error?: string }>;
  disconnectGoogleAccount: () => Promise<void>;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

const KEY_STORAGE = 'toolivo_pro_recovery_key';
const DEVICE_STORAGE = 'toolivo_device_id';
const CURRENCY_STORAGE = 'toolivo_currency_v2';
const OPTIONAL_SYNC_HINT = 'toolivo_google_sync_enabled';

function detectDefaultCurrency(): SupportedCurrency {
  try {
    const saved = localStorage.getItem(CURRENCY_STORAGE) as SupportedCurrency | null;
    if (saved && ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD'].includes(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'USD';
}

function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_STORAGE);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(DEVICE_STORAGE, id);
    }
    return id;
  } catch {
    return 'dev_ephemeral';
  }
}

export const EntitlementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(detectDefaultCurrency);
  const [entitlement, setEntitlement] = useState<ActiveEntitlement | null>(null);
  const [activeRecoveryKey, setActiveRecoveryKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY_STORAGE);
    } catch {
      return null;
    }
  });
  const [sponsorFrames, setSponsorFrames] = useState<SponsorFrame[]>(SPONSOR_FRAMES);
  const [optionalUser, setOptionalUser] = useState<OptionalAuthUser | null>(null);

  const setCurrency = useCallback((next: SupportedCurrency) => {
    setCurrencyState(next);
    try {
      localStorage.setItem(CURRENCY_STORAGE, next);
    } catch {
      // Ignore storage access errors
    }
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
        try {
          localStorage.setItem(KEY_STORAGE, cleaned);
        } catch {
          // Ignore storage error
        }
        setActiveRecoveryKey(cleaned);
        setEntitlement(data.entitlement);
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Recovery key is invalid or expired.' };
    } catch {
      return { ok: false, error: 'Could not verify recovery key right now.' };
    }
  }, []);

  const clearEntitlement = useCallback(() => {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {
      // Ignore storage error
    }
    setActiveRecoveryKey(null);
    setEntitlement(null);
  }, []);

  // Validate saved accountless recovery key on mount & fetch live sponsor frames
  useEffect(() => {
    refreshSponsors();
    let savedKey: string | null = null;
    try {
      savedKey = localStorage.getItem(KEY_STORAGE);
    } catch {
      savedKey = null;
    }
    if (savedKey) {
      activateByKey(savedKey).then((res) => {
        if (!res.ok) {
          try {
            localStorage.removeItem(KEY_STORAGE);
          } catch {
            // Ignore
          }
          setActiveRecoveryKey(null);
        }
      });
    }
  }, [activateByKey, refreshSponsors]);

  // Lazy-load Firebase Auth ONLY if the user previously opted into optional Google Account Sync
  useEffect(() => {
    let syncOptedIn = false;
    try {
      syncOptedIn = localStorage.getItem(OPTIONAL_SYNC_HINT) === '1';
    } catch {
      syncOptedIn = false;
    }
    if (!syncOptedIn) return;

    let unsubscribe: (() => void) | null = null;
    let active = true;

    import('../lib/firebaseClient')
      .then(({ subscribeOptionalAuth }) => {
        if (!active) return;
        unsubscribe = subscribeOptionalAuth(async (user) => {
          setOptionalUser(user ? { uid: user.uid, email: user.email } : null);
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
      })
      .catch(() => {});

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const connectGoogleAccount = useCallback(async () => {
    try {
      const { signInWithGoogleOptional } = await import('../lib/firebaseClient');
      const user = await signInWithGoogleOptional();
      if (!user.email) {
        return { ok: false, error: 'Google account did not return an email address.' };
      }
      try {
        localStorage.setItem(OPTIONAL_SYNC_HINT, '1');
      } catch {
        // Ignore
      }
      setOptionalUser({ uid: user.uid, email: user.email });
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
    try {
      localStorage.removeItem(OPTIONAL_SYNC_HINT);
      const { signOutOptional } = await import('../lib/firebaseClient');
      await signOutOptional();
    } catch {
      // Ignore
    }
    setOptionalUser(null);
  }, []);

  return (
    <EntitlementContext.Provider
      value={{
        currency,
        setCurrency,
        entitlement,
        activeRecoveryKey,
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
