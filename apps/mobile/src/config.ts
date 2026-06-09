/**
 * App configuration.
 *
 * BACKEND_URL is the deployed ThinkMate backend (the stateless engine API).
 * The phone/laptop never holds the Deepgram/Anthropic keys — it just calls here.
 */
export const BACKEND_URL = "https://thinkmate-ahpg.onrender.com";

/**
 * Public privacy policy, hosted on GitHub Pages from the repo's /docs folder.
 * Linked from the app (App Store requires an in-app, reachable privacy policy)
 * and submitted as the app's Privacy Policy URL in App Store Connect.
 */
export const PRIVACY_POLICY_URL = "https://patmakesapps.github.io/ThinkMate/privacy-policy.html";
