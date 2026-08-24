import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { createSessionWithRecipient, encryptForRecipient, decryptFromSender } from '../lib/signalClient'

type Msg = { from: string; to: string; text?: string; ciphertext?: string }

export default function ChatPage() {
  const router = useRouter()
  const { id } = router.query // chat partner id
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const me = typeof window !== 'undefined' ? localStorage.getItem('aether_username') || 'anonymous' : 'anonymous'

  useEffect(() => {
    if (!id) return
    setStatus('Creating session...')
    (async () => {
      try {
        await createSessionWithRecipient(me, String(id))
        setStatus('Session ready')
      } catch (e) {
        console.warn('session create failed', e)
        setStatus('Could not create session — may still work if recipient has no prekey')
      }

      const url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/^http/, 'ws') + '/ws'
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'identify', username: me }))
      })
      ws.addEventListener('message', async (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'message') {
            if (data.ciphertext) {
              try {
                const plaintext = await decryptFromSender(data.from, data.ciphertext)
                setMessages((m) => [...m, { from: data.from, to: data.to, text: plaintext }])
              } catch (e) {
                // If decrypt fails, show placeholder
                setMessages((m) => [...m, { from: data.from, to: data.to, ciphertext: data.ciphertext }])
              }
            } else if (data.plaintext) {
              setMessages((m) => [...m, { from: data.from, to: data.to, text: data.plaintext }])
            }
          }
        } catch (e) { console.error(e) }
      })
    })()

    return () => wsRef.current?.close()
  }, [id])

  async function send() {
    if (!id || !input) return
    try {
      setStatus('Encrypting...')
      const ciphertext = await encryptForRecipient(String(id), input)
      setStatus('Sending...')
      const payload = { type: 'message', from: me, to: id, ciphertext }
      wsRef.current?.send(JSON.stringify(payload))
      setMessages((m) => [...m, { from: me, to: String(id), text: input }])
      setInput('')
      setStatus('')
    } catch (e) {
      console.error('send failed', e)
      setStatus('Send failed')
    }
  }

  return (
    <main style={{ padding: 20 }}>
      <h2>Chat with {id || '(no id)'}</h2>
      <div style={{ border: '1px solid #e5e7eb', padding: 12, minHeight: 300 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{m.from}:</strong> {m.text ?? '[encrypted message]'}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <input style={{ width: '70%' }} value={input} onChange={(e) => setInput(e.target.value)} />
        <button onClick={send}>Send</button>
        <span style={{ marginLeft: 12, color: '#6b7280' }}>{status}</span>
      </div>
    </main>
  )
}
