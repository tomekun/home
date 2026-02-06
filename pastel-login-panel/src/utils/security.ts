/**
 * Utility functions for security and sanitization.
 */

/**
 * Sanitizes a URL to prevent XSS attacks.
 * It ensures the URL uses safe protocols (http, https, or relative)
 * and does not contain javascript: or other dangerous components.
 */
export const sanitizeUrl = (url: string | null | undefined): string | undefined => {
    if (!url) return undefined;

    // Basic URL validation
    const trimmedUrl = url.trim();

    // Block dangerous protocols
    const blockedProtocols = ['javascript:', 'data:', 'vbscript:'];
    const isBlocked = blockedProtocols.some(protocol =>
        trimmedUrl.toLowerCase().startsWith(protocol)
    );

    if (isBlocked) {
        console.warn('Blocked a potentially dangerous URL:', trimmedUrl);
        return undefined;
    }

    // Allow safe protocols and relative paths
    const isSafe = /^(https?:\/\/|\/)/i.test(trimmedUrl);

    if (!isSafe) {
        return undefined;
    }

    return trimmedUrl;
};
