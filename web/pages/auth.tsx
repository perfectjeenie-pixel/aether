import { useState } from 'react'

export default function AuthPage() {
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('')

  async function register() {
    setStatus('Generating key pair...')
    // Simple placeholder key generation using ECDH P-256 for scaffold.
    const keyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    )

    const publicKeyRaw = await window.crypto.subtle.exportKey('raw', keyPair.publicKey)
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))

    // Save private key in IndexedDB/localStorage in production use secure storage
    const pk = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    const pkb64 = btoa(String.fromCharCode(...new Uint8Array(pk)))
    localStorage.setItem('aether_private_key', pkb64)
    localStorage.setItem('aether_username', username)

    setStatus('Registering with server...')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, publicKey: publicKeyBase64 })
      })
      if (!res.ok) throw new Error('register failed')
      setStatus('Registered — go to chat')
    } catch (e) {
      console.error(e)
      setStatus('Registration failed — check server')
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Aether — Sign in / Register</h1>
      <p>Create a username and generate your keypair (private key stored locally).</p>
      <label>
        Username<br />
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <div style={{ marginTop: 12 }}>
        <button onClick={register} disabled={!username}>Generate & Register</button>
      </div>
      <p>{status}</p>
      <p style={{ marginTop: 20 }}>
        This is a scaffold. Production apps must store private keys securely and use a vetted E2EE protocol like Signal.
      </p>
    </main>
  )
}
