/**
 * Security headers for HTML documents served by the /game-assets Pages Function.
 *
 * Cloudflare Pages does not apply `public/_headers` to Function responses, so
 * document policy must be emitted here. Non-HTML assets keep the immutable
 * cache contract alone (CSP does not apply to non-documents).
 *
 * Framing: play pages embed these documents in same-origin iframes, so
 * `frame-ancestors` is `'self'` (and XFO SAMEORIGIN) — not `'none'`/DENY,
 * which would break play. Cross-origin embedding remains blocked.
 *
 * Runtime allowances match the site shell (Unity wasm + blob workers) and add
 * `media-src 'self' blob:` for Unity blob-backed audio.
 */
export const GAME_ASSET_DOCUMENT_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'none'",
  "frame-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self' blob:"
].join("; ");

export const GAME_ASSET_DOCUMENT_X_FRAME_OPTIONS = "SAMEORIGIN";

export const GAME_ASSET_IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function isHtmlContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const mediaType = contentType.toLowerCase().split(";", 1)[0]?.trim();
  return mediaType === "text/html";
}

/** Attach document policy without altering Cache-Control or entity validators. */
export function applyGameAssetDocumentSecurityHeaders(headers: Headers): void {
  headers.set("X-Frame-Options", GAME_ASSET_DOCUMENT_X_FRAME_OPTIONS);
  headers.set("Content-Security-Policy", GAME_ASSET_DOCUMENT_CSP);
}
