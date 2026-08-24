// Lightweight crypto helpers (scaffold). For production, use a proven E2EE library (Signal Protocol).

export async function generateKeyPair() {
  const kp = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  )
  return kp
}

export async function exportPublicKeyToBase64(pub: CryptoKey) {
  const raw = await window.crypto.subtle.exportKey('raw', pub)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

export async function importPublicKeyFromBase64(b64: string) {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return await window.crypto.subtle.importKey('raw', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
}

export async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey) {
  const derived = await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  return derived
}

export async function encryptWithSharedKey(key: CryptoKey, plaintext: string) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder().encode(plaintext)
  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc)
  return { ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))), iv: btoa(String.fromCharCode(...iv)) }
}

export async function decryptWithSharedKey(key: CryptoKey, ciphertextB64: string, ivB64: string) {
  const ct = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0))
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(decrypted)
}
