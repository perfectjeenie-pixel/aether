// Minimal Signal client glue for the web app (scaffold). Uses libsignal-protocol-js to create sessions and encrypt/decrypt messages.
// This is a simplified store backed by localStorage. For production, use a robust store and follow Signal spec fully.

async function loadLib() {
  const lib = await import('libsignal-protocol')
  return lib
}

function b64ToArrayBuffer(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer
}
function arrayBufferToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

class SignalLocalStore {
  constructor(prefix = 'signal') {
    this.prefix = prefix
  }
  getKey(k) {
    const v = localStorage.getItem(this.prefix + ':' + k)
    return v ? JSON.parse(v) : null
  }
  putKey(k, v) {
    localStorage.setItem(this.prefix + ':' + k, JSON.stringify(v))
  }
  // the libsignal store API expects getIdentityKeyPair, getRegistrationId, loadPreKey, storePreKey, loadSignedPreKey, storeSession, loadSession, etc.
}

export async function ensureIdentityAndKeys() {
  const lib = await loadLib()
  const KeyHelper = lib.KeyHelper
  const store = window.__aether_signal_store || new SignalLocalStore()
  window.__aether_signal_store = store

  // check if identity exists
  let identity = store.getKey('identityKey')
  let registrationId = store.getKey('registrationId')
  if (!identity || !registrationId) {
    // generate and store
    const identityKeyPair = await KeyHelper.generateIdentityKeyPair()
    const regId = await KeyHelper.generateRegistrationId()
    store.putKey('identityKey', { pubKey: arrayBufferToB64(identityKeyPair.pubKey), privKey: arrayBufferToB64(identityKeyPair.privKey) })
    store.putKey('registrationId', regId)
    // note: libsignal's key objects are not serializable directly; production code should use provided KeyHelper serialization helpers
    return { created: true }
  }
  return { created: false }
}

async function importKeyPairFromStored(lib, stored) {
  // stored: { pubKey: b64, privKey: b64 }
  const pub = new Uint8Array(b64ToArrayBuffer(stored.pubKey))
  const priv = new Uint8Array(b64ToArrayBuffer(stored.privKey))
  const pair = { pubKey: pub, privKey: priv }
  return pair
}

export async function createSessionWithRecipient(ourName, theirName) {
  const lib = await loadLib()
  const KeyHelper = lib.KeyHelper
  const SessionBuilder = lib.SessionBuilder
  const SignalProtocolAddress = lib.SignalProtocolAddress

  // ensure local identity exists
  await ensureIdentityAndKeys()

  // fetch their prekey bundle from the server
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/prekeys/${encodeURIComponent(theirName)}`)
  if (!res.ok) throw new Error('failed to fetch prekey bundle')
  const bundle = await res.json()

  // prepare store adapter for libsignal
  const store = createLibSignalStore(lib)

  // import identity keypair from local storage to libsignal store
  const storedIdentity = store.get('identityKey')
  if (!storedIdentity) {
    // try reading our earlier stored raw identity
    const raw = localStorage.getItem('signal_identity_key')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        // The previous store saved some representation; production code should convert properly
        store.put('identityKey', parsed)
      } catch (e) { }
    }
  }

  const address = new SignalProtocolAddress(theirName, 1)

  // use SessionBuilder to process the prekey bundle and create a session
  const builder = new SessionBuilder(store, address)

  // prekey bundle values conversion — libsignal expects certain fields: identityKey, signedPreKey, preKey
  // our server stored a 'bundle' with base64 strings as created earlier in web/lib/signal.ts
  const processedBundle = {
    identityKey: KeyHelper.fromString(bundle.identityKey),
    registrationId: bundle.registrationId,
    signedPreKey: { keyId: bundle.signedPreKey.keyId, publicKey: KeyHelper.fromString(bundle.signedPreKey.publicKey), signature: KeyHelper.fromString(bundle.signedPreKey.signature) },
    preKey: { keyId: bundle.preKey.keyId, publicKey: KeyHelper.fromString(bundle.preKey.publicKey) }
  }

  // process prekey bundle
  await builder.processPreKey(processedBundle)

  return { ok: true }
}

function createLibSignalStore(lib) {
  // minimal store implementing required libsignal methods using localStorage
  const store = {}
  const prefix = 'libsignal:'
  store.put = function (key, value) {
    localStorage.setItem(prefix + key, JSON.stringify(value))
  }
  store.get = function (key, defaultValue) {
    const v = localStorage.getItem(prefix + key)
    if (!v) return defaultValue
    return JSON.parse(v)
  }
  store.remove = function (key) { localStorage.removeItem(prefix + key) }

  // identity key pair
  store.getIdentityKeyPair = async function () {
    const raw = store.get('identityKey')
    if (!raw) return null
    // lib signal expects object with pubKey/privKey Uint8Array. The KeyHelper helper can be used instead in production.
    return { pubKey: raw.pubKey, privKey: raw.privKey }
  }
  store.getLocalRegistrationId = function () { return store.get('registrationId') }

  // Session store API
  store.saveSession = function (addressName, record) {
    store.put('session-' + addressName, record)
  }
  store.loadSession = function (addressName) { return store.get('session-' + addressName) }

  // Prekey store
  store.storePreKey = function (keyId, keyPair) { store.put('preKey-' + keyId, keyPair) }
  store.loadPreKey = function (keyId) { return store.get('preKey-' + keyId) }

  // Signed prekey store
  store.storeSignedPreKey = function (keyId, keyPair) { store.put('signedPreKey-' + keyId, keyPair) }
  store.loadSignedPreKey = function (keyId) { return store.get('signedPreKey-' + keyId) }

  // Identity key store
  store.getIdentity = function (recipientId) { return store.get('identity-' + recipientId) }
  store.saveIdentity = function (recipientId, identityKey) { store.put('identity-' + recipientId, identityKey) }

  return store
}

export async function encryptForRecipient(recipientName, plaintext) {
  const lib = await loadLib()
  const SignalProtocolAddress = lib.SignalProtocolAddress
  const SessionCipher = lib.SessionCipher

  const store = createLibSignalStore(lib)
  const address = new SignalProtocolAddress(recipientName, 1)
  const cipher = new SessionCipher(store, address)
  const encoded = new TextEncoder().encode(plaintext)
  const result = await cipher.encrypt(encoded)
  // result is a CipherMessage; in libsignal it has body as ArrayBuffer or Uint8Array
  if (result && result.body) {
    return arrayBufferToB64(result.body)
  }
  throw new Error('encryption failed')
}

export async function decryptFromSender(senderName, ciphertextB64) {
  const lib = await loadLib()
  const SignalProtocolAddress = lib.SignalProtocolAddress
  const SessionCipher = lib.SessionCipher
  const store = createLibSignalStore(lib)
  const address = new SignalProtocolAddress(senderName, 1)
  const cipher = new SessionCipher(store, address)
  const cipherBuf = b64ToArrayBuffer(ciphertextB64)
  try {
    const decrypted = await cipher.decrypt(new Uint8Array(cipherBuf))
    return new TextDecoder().decode(decrypted)
  } catch (e) {
    console.error('decrypt failed', e)
    throw e
  }
}
