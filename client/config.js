/**
 * SafeSpace AI – frontend config (single place for ports and API URL).
 * Change these if you run the backend or frontend on different ports.
 */
const isLocalFrontend =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    window.location.port !== "3001";

const APP_CONFIG = {
    /**
     * Production uses the same origin as the hosted app.
     * Set window.SAFESPACE_API_BASE_URL before this script to override it.
     */
    apiBaseUrl: window.SAFESPACE_API_BASE_URL || (isLocalFrontend ? "http://localhost:3001" : ""),
    /** Frontend port (for reference; used when serving with e.g. python -m http.server 5500) */
    frontendPort: 5500
};
