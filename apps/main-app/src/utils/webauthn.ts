// Helper functions to convert between ArrayBuffer and Base64URL

export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(padLength);
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert attestation options from server to browser-friendly format
export function decodeAttestationOptions(options: any): PublicKeyCredentialCreationOptions {
  const publicKey = options.publicKey ? options.publicKey : options;
  
  const decoded: any = {
    ...publicKey,
    challenge: base64UrlToArrayBuffer(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: base64UrlToArrayBuffer(publicKey.user.id)
    }
  };

  if (publicKey.excludeCredentials) {
    decoded.excludeCredentials = publicKey.excludeCredentials.map((cred: any) => ({
      ...cred,
      id: base64UrlToArrayBuffer(cred.id)
    }));
  }

  return decoded;
}

// Convert assertion options from server to browser-friendly format
export function decodeAssertionOptions(options: any): PublicKeyCredentialRequestOptions {
  const publicKey = options.publicKey ? options.publicKey : options;
  
  const decoded: any = {
    ...publicKey,
    challenge: base64UrlToArrayBuffer(publicKey.challenge)
  };

  if (publicKey.allowCredentials) {
    decoded.allowCredentials = publicKey.allowCredentials.map((cred: any) => ({
      ...cred,
      id: base64UrlToArrayBuffer(cred.id)
    }));
  }

  return decoded;
}

// Encode attestation credential to server-friendly format
export function encodeAttestationCredential(credential: any): any {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : []
    }
  };
}

// Encode assertion credential to server-friendly format
export function encodeAssertionCredential(credential: any): any {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      signature: arrayBufferToBase64Url(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : null
    }
  };
}
