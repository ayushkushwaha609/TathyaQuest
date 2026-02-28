export interface Language {
  label: string;
  value: string;
  nativeLabel: string;
}

export const LANGUAGES: Language[] = [
  { label: "Hindi", nativeLabel: "हिंदी", value: "hi-IN" },
  { label: "Tamil", nativeLabel: "தமிழ்", value: "ta-IN" },
  { label: "Telugu", nativeLabel: "తెలుగు", value: "te-IN" },
  { label: "Kannada", nativeLabel: "ಕನ್ನಡ", value: "kn-IN" },
  { label: "Malayalam", nativeLabel: "മലയാളം", value: "ml-IN" },
  { label: "Marathi", nativeLabel: "मराठी", value: "mr-IN" },
];

export const DEFAULT_LANGUAGE = "hi-IN";
