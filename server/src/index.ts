import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// In-memory store for scaffold. Replace with a persistent DB in production.
const users = new Map<string, string>() // username -> publicKeyBase64
const sockets = new Map<string, any>()

app.post('/register', (req, res) => {
  const { username, publicKey } = req.body
  if (!username || !publicKey) return res.status(400).json({ error: 'missing' })
  users.set(username, publicKey)
  console.log('registered', username)
  return res.json({ ok: true })
})

app.get('/users', (req, res) => {
  return res.json(Array.from(users.keys()))
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  let username = ''
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data))
      if (msg.type === 'identify') {
        username = msg.username
        sockets.set(username, ws)
        console.log('identified', username)
        return
      }
      if (msg.type === 'message') {
        // relay message to recipient if connected
        const to = msg.to
        const toSock = sockets.get(to)
        const payload = { type: 'message', from: msg.from, to: msg.to, plaintext: msg.plaintext, ciphertext: msg.ciphertext, iv: msg.iv }
        if (toSock && toSock.readyState === toSock.OPEN) {
          toSock.send(JSON.stringify(payload))
        }
      }
    } catch (e) {
      console.error('ws message error', e)
    }
  })

  ws.on('close', () => {
    if (username) sockets.delete(username)
  })
})

const PORT = process.env.API_PORT || 4000
server.listen(PORT, () => console.log(`Aether server (scaffold) listening on ${PORT}`))
