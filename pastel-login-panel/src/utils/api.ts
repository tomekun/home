/**
 * Utility for making API requests with CSRF protection.
 */

const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
};

const API_BASE_URL = 'http://localhost:3001';

export const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const csrfToken = getCookie('XSRF-TOKEN');

    const headers = new Headers(options.headers || {});
    if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase() || 'GET')) {
        headers.set('X-CSRF-Token', csrfToken);
    }

    return fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include',
    });
};
