import { create } from 'zustand';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export interface CheckResult {
  claim: string;
  verdict: 'TRUE' | 'FALSE' | 'MISLEADING' | 'PARTIALLY_TRUE';
  confidence: number;
  reason: string;
  verdict_text: string;
  audio_base64: string | null;
}

interface CheckStore {
  url: string;
  languageCode: string;
  isLoading: boolean;
  result: CheckResult | null;
  error: string | null;
  setUrl: (url: string) => void;
  setLanguageCode: (code: string) => void;
  runCheck: () => Promise<boolean>;
  reset: () => void;
}

export const useCheckStore = create<CheckStore>((set, get) => ({
  url: '',
  languageCode: 'hi-IN',
  isLoading: false,
  result: null,
  error: null,

  setUrl: (url: string) => set({ url, error: null }),
  
  setLanguageCode: (code: string) => set({ languageCode: code }),

  runCheck: async () => {
    const { url, languageCode } = get();
    
    // Validate URL
    const urlPattern = /(instagram\.com|instagr\.am|youtube\.com|youtu\.be)/i;
    if (!url || !urlPattern.test(url)) {
      set({ error: 'Please paste a valid Instagram or YouTube link' });
      return false;
    }

    set({ isLoading: true, error: null, result: null });

    try {
      const response = await axios.post(`${API_URL}/api/check`, {
        url,
        language_code: languageCode,
      }, {
        timeout: 120000, // 2 minutes timeout
      });

      set({ result: response.data, isLoading: false });
      return true;
    } catch (error: any) {
      let errorMessage = 'Something went wrong. Please try again.';
      
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

  reset: () => set({
    url: '',
    result: null,
    error: null,
    isLoading: false,
  }),
}));
