/** Identity Toolkit custom-token response parsing (no Firebase imports). */

export type CustomTokenSignInBody = {
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  error?: { message?: string };
};

/**
 * Documented Identity Toolkit fields are idToken/refreshToken/expiresIn.
 * localId is unreliable — pass uid from the one-time code document.
 */
export function tokensFromCustomTokenResponse(
  body: CustomTokenSignInBody,
  uid: string
): { idToken: string; refreshToken: string; expiresIn: number; uid: string } | null {
  if (!body.idToken || !body.refreshToken || !uid) {
    return null;
  }
  return {
    idToken: body.idToken,
    refreshToken: body.refreshToken,
    expiresIn: Number(body.expiresIn) || 3600,
    uid,
  };
}
