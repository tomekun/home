/**
 * Utility functions for security and sanitization.
 */

/**
 * Sanitizes a URL to prevent XSS attacks.
 * It ensures the URL uses safe protocols (http, https, or relative)
 * and does not contain javascript: or other dangerous components.
 */
export const sanitizeUrl = (url: string | null | undefined): string => {
    if (!url) return '';

    // Basic URL validation
    const trimmedUrl = url.trim();

    // Block dangerous protocols
    const blockedProtocols = ['javascript:', 'data:', 'vbscript:'];
    const isBlocked = blockedProtocols.some(protocol =>
        trimmedUrl.toLowerCase().startsWith(protocol)
    );

    if (isBlocked) {
        console.warn('Blocked a potentially dangerous URL:', trimmedUrl);
        return '';
    }

    // Allow safe protocols and relative paths
    // Valid Discord CDN URLs start with https://cdn.discordapp.com/
    // Other valid URLs would start with http:// or https://
    // Relative paths start with /
    const isSafe = /^(https?:\/\/|\/)/i.test(trimmedUrl);

    if (!isSafe) {
        // If it doesn't have a protocol, it might be a partial path.
        // However, for this app's context, if it's not a full URL or absolute path, 
        // it's better to be safe and return empty if we can't verify it.
        // But many Discord assets are full URLs.
        return '';
    }

    return trimmedUrl;
};
