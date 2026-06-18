import { useState } from 'react'
import { composeApi } from '../api/client'
import { PenSquare, Send, Sparkles } from 'lucide-react'

export default function Compose() {
  const [prompt, setPrompt] = useState('')
  const [to, setTo] = useState('')
  const [draft, setDraft] = useState(null)
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)

  const handleDraft = async () => {
    if (!prompt.trim()) return
    setDrafting(true)
    try {
      const res = await composeApi.draft({ prompt, to: to || undefined })
      setDraft(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setDrafting(false)
    }
  }

  const handleSend = async () => {
    if (!draft?.to && !to) return alert('Please specify a recipient')
    setSending(true)
    try {
      await composeApi.send({
        to: draft?.to || to,
        subject: draft.subject,
        body: draft.body,
      })
      setDraft(null)
      setPrompt('')
      setTo('')
      alert('Email sent successfully!')
    } catch (err) {
      alert('Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <PenSquare className="w-6 h-6 text-primary-600" />
        <div>
          <h1 className="text-2xl font-bold">Compose with AI</h1>
          <p className="text-surface-800/60">Describe what you want to write, and AI will draft it</p>
        </div>
      </div>

      {!draft ? (
        <div className="card p-6">
          <div className="mb-4">
            <label className="text-sm font-medium mb-1 block">To (optional)</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="input"
            />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium mb-1 block">What do you want to write?</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "Write a follow-up to the product team about the Q3 launch delay"'
              className="input h-32"
            />
          </div>
          <button onClick={handleDraft} disabled={drafting || !prompt.trim()} className="btn-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {drafting ? 'Generating...' : 'Generate Draft'}
          </button>
        </div>
      ) : (
        <div className="card p-6">
          <div className="mb-4">
            <label className="text-sm font-medium">To:</label>
            <input value={draft.to || to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="input mt-1" />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium">Subject:</label>
            <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className="input mt-1" />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium">Body:</label>
            <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="input h-64 mt-1" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSend} disabled={sending} className="btn-primary flex items-center gap-2">
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Email'}
            </button>
            <button onClick={() => setDraft(null)} className="btn-secondary">Regenerate</button>
            <button onClick={() => { setDraft(null); setPrompt('') }} className="btn-secondary">Discard</button>
          </div>
        </div>
      )}
    </div>
  )
}
