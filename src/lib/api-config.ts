/**
 * Centralized API prefix for backoffice endpoints.
 * Use this instead of hardcoding paths — makes it easy to add v1 later (e.g. /api/backoffice/v1).
 */
export const API_BACKOFFICE_PREFIX = '/api/backoffice'

/** Base URL for backend (used for slip images, etc.) */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
