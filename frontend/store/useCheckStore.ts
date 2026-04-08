import { create } from 'zustand';
import axios from 'axios';
import { useAuthStore } from './useAuthStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://tathya-api.onrender.com';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || '';

// Module-level counter: incremented on every runCheck call.
// If a newer request starts while an older one is in-flight, the older
// response is discarded when it eventually arrives.
let latestRequestId = 0;

// Synchronous lock to prevent duplicate requests (zustand state updates are async)
let isRequestInFlight = false;

export interface CheckResult {
  claim: string;
  claim_regional: string;
  verdict: 'TRUE' | 'FALSE' | 'MISLEADING' | 'PARTIALLY_TRUE';
  confidence: number;
  reason: string;
  reason_regional: string;
  verdict_text: string;
  verdict_text_english: string;
  verdict_text_regional: string;
  audio_base64: string | null;
  // Enhanced context fields
  category: string;
  key_points: string[];
  key_points_regional: string[];
  fact_details: string;
  fact_details_regional: string;
  what_to_know: string;
  what_to_know_regional: string;
  sources_note: string;
  why_misleading: string;
  why_misleading_regional: string;
}

interface CheckStore {
  url: string;
  languageCode: string;
  isLoading: boolean;
  result: CheckResult | null;
  error: string | null;
  limitReached: boolean;
  setUrl: (url: string) => void;
  setLanguageCode: (code: string) => void;
  runCheck: (urlOverride?: string) => Promise<boolean>;
  reset: () => void;
}

export const useCheckStore = create<CheckStore>((set, get) => ({
  url: '',
  languageCode: 'hi-IN',
  isLoading: false,
  result: null,
  error: null,
  limitReached: false,

  setUrl: (url: string) => set({ url, error: null }),
  
  setLanguageCode: (code: string) => set({ languageCode: code }),

  runCheck: async (urlOverride?: string) => {
    const { url: storeUrl, languageCode } = get();

    // Prevent duplicate requests (synchronous check — zustand setState is async)
    if (isRequestInFlight) return false;
    isRequestInFlight = true;

    const url = urlOverride || storeUrl;

    // Validate URL
    const urlPattern = /(instagram\.com|instagr\.am|youtube\.com|youtu\.be)/i;
    if (!url || !urlPattern.test(url)) {
      isRequestInFlight = false;
      set({ error: 'Please paste a valid Instagram or YouTube link' });
      return false;
    }

    // Pre-check daily limit per platform (exempt users skip this)
    const authState = useAuthStore.getState();
    const isYouTube = /(youtube\.com|youtu\.be)/i.test(url);
    const checksRemaining = isYouTube ? authState.ytChecksRemaining : authState.igChecksRemaining;
    const platformLabel = isYouTube ? 'YouTube' : 'Instagram';

    if (!authState.isExempt && checksRemaining <= 0) {
      isRequestInFlight = false;
      set({ error: `${platformLabel} daily limit reached.`, limitReached: true });
      return false;
    }

    // Tag this request; any response with a stale ID is discarded
    latestRequestId++;
    const myId = latestRequestId;

    set({ isLoading: true, error: null, result: null });

    try {
      const headers: Record<string, string> = {};
      if (API_KEY) headers['X-API-Key'] = API_KEY;
      if (authState.deviceId) headers['X-Device-Id'] = authState.deviceId;

      const response = await axios.post(`${API_URL}/api/check`, {
        url,
        language_code: languageCode,
      }, {
        timeout: 120000, // 2 minutes timeout
        headers,
      });

      // Discard if a newer request has already been started
      if (myId !== latestRequestId) return false;

      isRequestInFlight = false;
      useAuthStore.getState().fetchUsage();
      set({ result: response.data, isLoading: false });
      return true;
    } catch (error: any) {
      if (myId !== latestRequestId) return false;

      isRequestInFlight = false;

      let errorMessage = 'Something went wrong. Please try again.';

      if (error.response?.status === 429) {
        set({ error: null, limitReached: true, isLoading: false });
        return false;
      }

      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'object') {
          errorMessage = detail.message || errorMessage;
        } else {
          errorMessage = detail;
        }
      } else if (error.message === 'Network Error') {
        errorMessage = "Can't reach server. Check your connection.";
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please try again.';
      }

      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  reset: () => {
    latestRequestId++;
    isRequestInFlight = false;
    set({ url: '', result: null, error: null, isLoading: false, limitReached: false });
  },
}));
