// The user's kie.ai key lives ONLY in their browser (BYOK).
const KEY = "kie_api_key";
export const getApiKey = () => localStorage.getItem(KEY) ?? "";
export const setApiKey = (k: string) => localStorage.setItem(KEY, k.trim());
export const clearApiKey = () => localStorage.removeItem(KEY);
export const hasApiKey = () => !!getApiKey();
