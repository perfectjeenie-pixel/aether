import { useState } from 'react'

export default function ProfilePage() {
  const [status, setStatus] = useState(localStorage.getItem('aether_status') || '')
  const [privacy, setPrivacy] = useState(localStorage.getItem('aether_privacy') || 'everyone')

  function save() {
    localStorage.setItem('aether_status', status)
    localStorage.setItem('aether_privacy', privacy)
    alert('Saved locally. In production this would save to your encrypted profile on the server.')
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>Profile</h1>
      <label>
        Status message<br />
        <input value={status} onChange={(e) => setStatus(e.target.value)} />
      </label>

      <div style={{ marginTop: 12 }}>
        <label>
          Privacy for profile photo / last seen<br />
          <select value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
            <option value="everyone">Everyone</option>
            <option value="contacts">Contacts</option>
            <option value="nobody">Nobody</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={save}>Save</button>
      </div>
    </main>
  )
}
