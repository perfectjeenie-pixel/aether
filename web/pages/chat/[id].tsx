import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'

type Msg = { from: string; to: string; text?: string; ciphertext?: string; iv?: string }

export default function ChatPage() {
  const router = useRouter()
  const { id } = router.query // chat partner id
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const me = typeof window !== 'undefined' ? localStorage.getItem('aether_username') || 'anonymous' : 'anonymous'

  useEffect(() => {
    const url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/^http/, 'ws') + '/ws'
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.addEventListener('open', () => {
      console.log('ws open')
      ws.send(JSON.stringify({ type: 'identify', username: me }))
    })
    ws.addEventListener('message', (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.type === 'message') {
          setMessages((m) => [...m, { from: data.from, to: data.to, ciphertext: data.ciphertext, iv: data.iv }])
        }
      } catch (e) { console.error(e) }
    })
    return () => ws.close()
  }, [me])

  function send() {
    if (!id) return
    const payload = { type: 'message', from: me, to: id, plaintext: input }
    wsRef.current?.send(JSON.stringify(payload))
    setMessages((m) => [...m, { from: me, to: String(id), text: input }])
    setInput('')
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
      </div>
    </main>
  )
}
