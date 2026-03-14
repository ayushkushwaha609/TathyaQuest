import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getDeviceId } from '../utils/deviceId';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://tathya-api.onrender.com';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || '';

const AUTH_STATE_KEY = '@tathya/auth_state';

interface AuthStore {
  deviceId: string | null;
  isAuthenticated: boolean;
  isExempt: boolean;
  googleEmail: string | null;
  googleName: string | null;
  dailyLimit: number;
  checksUsed: number;
  checksRemaining: number;
  isAuthLoading: boolean;

  initDevice: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<boolean>;
  signInWithAdmin: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  incrementUsage: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  deviceId: null,
  isAuthenticated: false,
  isExempt: false,
  googleEmail: null,
  googleName: null,
  dailyLimit: 3,
  checksUsed: 0,
  checksRemaining: 3,
  isAuthLoading: false,

  initDevice: async () => {
    const deviceId = await getDeviceId();
    set({ deviceId });

    // Restore persisted auth state
    try {
      const saved = await AsyncStorage.getItem(AUTH_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        set({
          isAuthenticated: parsed.isAuthenticated || false,
          isExempt: parsed.isExempt || false,
          googleEmail: parsed.googleEmail || null,
          googleName: parsed.googleName || null,
        });
      }
    } catch {}
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
        dailyLimit: data.daily_limit,
        checksUsed: data.checks_used,
        checksRemaining: data.checks_remaining,
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
      const authState = {
        isAuthenticated: true,
        isExempt: data.is_exempt || false,
        googleEmail: data.email,
        googleName: data.name,
        dailyLimit: data.daily_limit,
        checksUsed: data.checks_used,
        checksRemaining: data.checks_remaining,
        isAuthLoading: false,
      };
      set(authState);

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
        dailyLimit: data.daily_limit,
        checksUsed: data.checks_used,
        checksRemaining: data.checks_remaining,
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

  signOut: async () => {
    const { deviceId } = get();
    if (!deviceId) return;

    set({ isAuthLoading: true });
    try {
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
        dailyLimit: data.daily_limit,
        checksUsed: data.checks_used,
        checksRemaining: data.checks_remaining,
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

  incrementUsage: () => {
    const { checksUsed, dailyLimit } = get();
    set({
      checksUsed: checksUsed + 1,
      checksRemaining: Math.max(0, dailyLimit - checksUsed - 1),
    });
  },
}));
