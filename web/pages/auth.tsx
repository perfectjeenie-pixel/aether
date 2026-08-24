import { useState } from 'react'
import { registerSignalKeys } from '../lib/signal'

export default function AuthPage() {
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('')

  async function register() {
    setStatus('Generating key pair...')

    // Simple ECDH public key registration (still used for compatibility),
    // plus Signal key registration for proper E2EE.
    try {
      // Generate a lightweight public key for server indexing (scaffold)
      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey']
      )
      const publicKeyRaw = await window.crypto.subtle.exportKey('raw', keyPair.publicKey)
      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))

      // Save private key locally for scaffold-only flows
      const pk = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
      const pkb64 = btoa(String.fromCharCode(...new Uint8Array(pk)))
      localStorage.setItem('aether_private_key', pkb64)
      localStorage.setItem('aether_username', username)

      setStatus('Registering with server...')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, publicKey: publicKeyBase64 })
      })
      if (!res.ok) throw new Error('register failed')

      setStatus('Registering Signal keys...')
      const sig = await registerSignalKeys(username)
      if (!sig.ok) throw new Error('Signal registration failed')

      setStatus('Registered — redirecting to profile')
      setTimeout(() => {
        window.location.href = '/profile'
      }, 800)
    } catch (e) {
      console.error(e)
      setStatus('Registration failed — check server or console')
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Aether — Sign in / Register</h1>
      <p>Create a username and generate your keypair (private key stored locally for this scaffold).</p>
      <label>
        Username<br />
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <div style={{ marginTop: 12 }}>
        <button onClick={register} disabled={!username}>Generate & Register</button>
      </div>
      <p>{status}</p>
      <p style={{ marginTop: 20 }}>
        This is a scaffold. Production apps must store private keys securely and use a vetted E2EE protocol like Signal. After registering you'll be able to create encrypted sessions with contacts and send E2EE messages.
      </p>
    </main>
  )
}
