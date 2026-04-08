import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getDeviceId } from '../utils/deviceId';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://tathya-api.onrender.com';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || '';

const AUTH_STATE_KEY = '@tathya/auth_state';

interface AuthStore {
  deviceId: string | null;
  isAuthenticated: boolean;
  isExempt: boolean;
  googleEmail: string | null;
  googleName: string | null;
  // Per-platform usage
  ytDailyLimit: number;
  ytChecksUsed: number;
  ytChecksRemaining: number;
  igDailyLimit: number;
  igChecksUsed: number;
  igChecksRemaining: number;
  isAuthLoading: boolean;
  // Subscription
  subscriptionPlan: 'free' | 'pro';
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  subscriptionId: string | null;

  initDevice: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  fetchSubscription: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<boolean>;
  signInWithAdmin: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  cancelSubscription: () => Promise<{ success: boolean; message: string }>;
}

function parseUsageFromResponse(data: any) {
  // Support new nested format and backward-compat flat format
  if (data.youtube && data.instagram) {
    return {
      ytDailyLimit: data.youtube.daily_limit,
      ytChecksUsed: data.youtube.checks_used,
      ytChecksRemaining: data.youtube.checks_remaining,
      igDailyLimit: data.instagram.daily_limit,
      igChecksUsed: data.instagram.checks_used,
      igChecksRemaining: data.instagram.checks_remaining,
    };
  }
  // Fallback for old flat format
  return {
    ytDailyLimit: data.daily_limit ?? 3,
    ytChecksUsed: data.checks_used ?? 0,
    ytChecksRemaining: data.checks_remaining ?? 3,
    igDailyLimit: data.daily_limit ?? 3,
    igChecksUsed: data.checks_used ?? 0,
    igChecksRemaining: data.checks_remaining ?? 3,
  };
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  deviceId: null,
  isAuthenticated: false,
  isExempt: false,
  googleEmail: null,
  googleName: null,
  ytDailyLimit: 3,
  ytChecksUsed: 0,
  ytChecksRemaining: 3,
  igDailyLimit: 3,
  igChecksUsed: 0,
  igChecksRemaining: 3,
  isAuthLoading: false,
  subscriptionPlan: 'free',
  subscriptionStatus: 'none',
  subscriptionEndDate: null,
  subscriptionId: null,

  initDevice: async () => {
    const deviceId = await getDeviceId();
    set({ deviceId });

    // Restore persisted auth state
    let restoredAuthenticated = false;
    try {
      const saved = await AsyncStorage.getItem(AUTH_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        restoredAuthenticated = parsed.isAuthenticated || false;
        set({
          isAuthenticated: restoredAuthenticated,
          isExempt: parsed.isExempt || false,
          googleEmail: parsed.googleEmail || null,
          googleName: parsed.googleName || null,
        });
      }
    } catch {}

    // Always fetch live subscription state on startup if authenticated
    if (restoredAuthenticated) {
      await get().fetchSubscription();
    }
  },

  fetchUsage: async () => {
    const { deviceId } = get();
    if (!deviceId) return;

    try {
      const response = await axios.get(`${API_URL}/api/usage`, {
        headers: {
          'X-Device-Id': deviceId,
          ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
        },
      });

      const data = response.data;
      set({
        ...parseUsageFromResponse(data),
        isAuthenticated: data.is_authenticated,
        isExempt: data.is_exempt || false,
        googleEmail: data.email || null,
        googleName: data.name || null,
      });

      // Persist auth state
      await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
        isAuthenticated: data.is_authenticated,
        isExempt: data.is_exempt || false,
        googleEmail: data.email,
        googleName: data.name,
      }));

      // Refresh subscription status alongside usage
      if (data.is_authenticated) await get().fetchSubscription();
    } catch (e) {
      // Silently fail — usage will show defaults
    }
  },

  signInWithGoogle: async (idToken: string) => {
    const { deviceId } = get();
    if (!deviceId) return false;

    set({ isAuthLoading: true });
    try {
      const response = await axios.post(`${API_URL}/api/auth/google`, {
        id_token: idToken,
        device_id: deviceId,
      }, {
        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
      });

      const data = response.data;
      set({
        isAuthenticated: true,
        isExempt: data.is_exempt || false,
        googleEmail: data.email,
        googleName: data.name,
        ...parseUsageFromResponse(data),
        isAuthLoading: false,
      });

      await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
        isAuthenticated: true,
        isExempt: data.is_exempt || false,
        googleEmail: data.email,
        googleName: data.name,
      }));

      // Fetch subscription immediately after sign-in
      await get().fetchSubscription();

      return true;
    } catch {
      set({ isAuthLoading: false });
      return false;
    }
  },

  signInWithAdmin: async (email: string, password: string) => {
    const { deviceId } = get();
    if (!deviceId) return false;

    set({ isAuthLoading: true });
    try {
      const response = await axios.post(`${API_URL}/api/auth/admin`, {
        email,
        password,
        device_id: deviceId,
      }, {
        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
      });

      const data = response.data;
      set({
        isAuthenticated: true,
        isExempt: data.is_exempt || false,
        googleEmail: data.email,
        googleName: data.name,
        ...parseUsageFromResponse(data),
        isAuthLoading: false,
      });

      await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
        isAuthenticated: true,
        isExempt: data.is_exempt || false,
        googleEmail: data.email,
        googleName: data.name,
      }));

      return true;
    } catch {
      set({ isAuthLoading: false });
      return false;
    }
  },

  fetchSubscription: async () => {
    const { deviceId } = get();
    if (!deviceId) return;
    try {
      const response = await axios.get(`${API_URL}/api/subscription/status`, {
        headers: {
          'X-Device-Id': deviceId,
          ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
        },
      });
      const data = response.data;
      set({
        subscriptionPlan: data.plan ?? 'free',
        subscriptionStatus: data.status ?? 'none',
        subscriptionEndDate: data.current_period_end ?? null,
        subscriptionId: data.subscription_id ?? null,
      });
    } catch {
      // silently fail — defaults stay as free
    }
  },

  cancelSubscription: async () => {
    const { deviceId } = get();
    if (!deviceId) return { success: false, message: 'No device ID' };
    try {
      const response = await axios.post(`${API_URL}/api/subscription/cancel`, {}, {
        headers: {
          'X-Device-Id': deviceId,
          ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
        },
      });
      set({ subscriptionPlan: 'free', subscriptionStatus: 'cancelled' });
      return { success: true, message: response.data.message };
    } catch (e: any) {
      const msg = e.response?.data?.detail?.message || 'Failed to cancel subscription.';
      return { success: false, message: msg };
    }
  },

  signOut: async () => {
    const { deviceId } = get();
    if (!deviceId) return;

    set({ isAuthLoading: true });
    try {
      // Sign out from native Google session
      try { await GoogleSignin.signOut(); } catch {}

      const response = await axios.post(`${API_URL}/api/auth/logout`, {
        device_id: deviceId,
      }, {
        headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
      });

      const data = response.data;
      set({
        isAuthenticated: false,
        isExempt: false,
        googleEmail: null,
        googleName: null,
        ...parseUsageFromResponse(data),
        isAuthLoading: false,
      });

      await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
        isAuthenticated: false,
        isExempt: false,
        googleEmail: null,
        googleName: null,
      }));
    } catch {
      set({ isAuthLoading: false });
    }
  },
}));
