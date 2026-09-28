// Picks the real backend or the in-browser mock (REACT_APP_MOCK_API=true).
import { realApi, isNetworkError, errorText } from "./realApi";
import { mockApi } from "./mockApi";

export const USE_MOCK = process.env.REACT_APP_MOCK_API === "true";
export const flowApi = USE_MOCK ? mockApi : realApi;
export { isNetworkError, errorText };
