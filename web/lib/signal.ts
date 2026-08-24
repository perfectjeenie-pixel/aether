/*
  Minimal integration with libsignal-protocol-js. This file provides helper functions to generate
  an identity keypair and a one-time prekey bundle, then publish the public parts to your server
  (or directly to Supabase). This is a scaffold — a full Signal implementation requires a proper
  prekey server, ratcheting, and storage of signed prekeys.
*/

export async function registerSignalKeys(username: string) {
  try {
    // dynamic import so server-side builds don't break if the package isn't installed
    const lib = await import('libsignal-protocol')
    const KeyHelper = lib.KeyHelper

    // generate identity keypair
    const identityKeyPair = await KeyHelper.generateIdentityKeyPair()
    const registrationId = await KeyHelper.generateRegistrationId()

    // generate a signed prekey and some one-time prekeys (scaffold)
    const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, 1)
    const preKey = await KeyHelper.generatePreKey(1)

    // prepare public bundle
    const bundle = {
      identityKey: KeyHelper.toString(identityKeyPair.pubKey),
      registrationId,
      signedPreKey: { keyId: signedPreKey.keyId, publicKey: KeyHelper.toString(signedPreKey.keyPair.pubKey), signature: KeyHelper.toString(signedPreKey.signature) },
      preKey: { keyId: preKey.keyId, publicKey: KeyHelper.toString(preKey.pubKey) }
    }

    // POST to server to store public bundle (or to Supabase directly)
    const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/prekeys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, bundle })
    })
    if (!resp.ok) throw new Error('failed to upload prekeys')

    // Save identity keypair locally (secure storage is required in production)
    localStorage.setItem('signal_identity_key', JSON.stringify(identityKeyPair))
    localStorage.setItem('signal_registration_id', String(registrationId))

    return { ok: true }
  } catch (e) {
    console.error('Signal registration failed', e)
    return { ok: false, error: String(e) }
  }
}
