import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Supabase client for server-side operations (requires service role key)
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
let supabase: any = null
if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
} else {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — falling back to in-memory store')
}

// In-memory store for scaffold when Supabase is not configured.
const users = new Map<string, any>() // username -> { publicKey, bundle }
const sockets = new Map<string, any>()

app.post('/register', async (req, res) => {
  const { username, publicKey } = req.body
  if (!username || !publicKey) return res.status(400).json({ error: 'missing' })

  if (supabase) {
    try {
      const { data, error } = await supabase.from('users').upsert({ username, public_key: publicKey }, { onConflict: 'username' })
      if (error) throw error
      return res.json({ ok: true, data })
    } catch (e) {
      console.error('supabase upsert user', e)
      return res.status(500).json({ error: 'supabase error' })
    }
  }

  users.set(username, { publicKey })
  return res.json({ ok: true })
})

app.post('/prekeys', async (req, res) => {
  const { username, bundle } = req.body
  if (!username || !bundle) return res.status(400).json({ error: 'missing' })

  if (supabase) {
    try {
      const { data, error } = await supabase.from('prekeys').upsert({ username, bundle }, { onConflict: 'username' })
      if (error) throw error
      return res.json({ ok: true, data })
    } catch (e) {
      console.error('supabase upsert prekeys', e)
      return res.status(500).json({ error: 'supabase error' })
    }
  }

  const existing = users.get(username) || {}
  existing.bundle = bundle
  users.set(username, existing)
  return res.json({ ok: true })
})

app.get('/users', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('users').select('username')
      if (error) throw error
      return res.json(data.map((r: any) => r.username))
    } catch (e) {
      console.error('supabase fetch users', e)
      return res.status(500).json({ error: 'supabase error' })
    }
  }
  return res.json(Array.from(users.keys()))
})

app.get('/prekeys/:username', async (req, res) => {
  const { username } = req.params
  if (supabase) {
    try {
      const { data, error } = await supabase.from('prekeys').select('bundle').eq('username', username).single()
      if (error) return res.status(404).json({ error: 'not found' })
      return res.json(data.bundle)
    } catch (e) {
      console.error('supabase fetch prekeys', e)
      return res.status(500).json({ error: 'supabase error' })
    }
  }
  const entry = users.get(username)
  if (!entry || !entry.bundle) return res.status(404).json({ error: 'not found' })
  return res.json(entry.bundle)
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  let username = ''
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(String(data))
      if (msg.type === 'identify') {
        username = msg.username
        sockets.set(username, ws)
        console.log('identified', username)
        return
      }
      if (msg.type === 'message') {
        const to = msg.to
        const toSock = sockets.get(to)
        const payload = { type: 'message', from: msg.from, to: msg.to, ciphertext: msg.ciphertext, iv: msg.iv }
        if (toSock && toSock.readyState === toSock.OPEN) {
          toSock.send(JSON.stringify(payload))
        }
        // optionally persist metadata to Supabase messages table
        if (supabase) {
          try {
            await supabase.from('messages').insert({ from_user: msg.from, to_user: msg.to, ciphertext: msg.ciphertext, iv: msg.iv })
          } catch (e) {
            console.warn('failed to persist message metadata', e)
          }
        }
      }
    } catch (e) { console.error('ws message error', e) }
  })

  ws.on('close', () => {
    if (username) sockets.delete(username)
  })
})

const PORT = process.env.API_PORT || 4000
server.listen(PORT, () => console.log(`Aether server (scaffold) listening on ${PORT}`))
