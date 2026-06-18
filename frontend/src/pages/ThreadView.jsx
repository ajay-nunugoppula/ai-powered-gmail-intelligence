import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { emailsApi, composeApi } from '../api/client'
import { ArrowLeft, Reply, Sparkles } from 'lucide-react'
import { format } from 'date-fns'

export default function ThreadView() {
  const { id } = useParams()
  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showReply, setShowReply] = useState(false)
  const [replyPrompt, setReplyPrompt] = useState('')
  const [draft, setDraft] = useState(null)
  const [drafting, setDrafting] = useState(false)

  useEffect(() => {
    emailsApi.getThread(id).then((res) => {
      setThread(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const handleDraftReply = async () => {
    if (!replyPrompt.trim()) return
    setDrafting(true)
    try {
      const res = await composeApi.reply({ thread_id: id, prompt: replyPrompt })
      setDraft(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setDrafting(false)
    }
  }

  const handleSend = async () => {
    if (!draft) return
    try {
      await composeApi.send({
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        thread_id: id,
        in_reply_to: draft.in_reply_to,
        references: draft.references,
      })
      setDraft(null)
      setShowReply(false)
      setReplyPrompt('')
      alert('Email sent successfully!')
    } catch (err) {
      alert('Failed to send email')
    }
  }

  if (loading) return <div className="p-8 text-center">Loading thread...</div>
  if (!thread) return <div className="p-8 text-center">Thread not found</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link to="/inbox" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Inbox
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold">{thread.subject}</h1>
        <p className="text-sm text-surface-800/60">{thread.message_count} messages</p>
        {thread.thread_summary && (
          <div className="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-100">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-primary-700">Thread Summary</span>
            </div>
            <p className="text-sm text-surface-800/80">{thread.thread_summary}</p>
          </div>
        )}
      </div>

      <div className="space-y-4 mb-6">
        {thread.emails?.map((email) => (
          <div key={email.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium">{email.sender}</p>
                <p className="text-xs text-surface-800/50">{email.sender_email}</p>
              </div>
              <span className="text-xs text-surface-800/40">
                {email.received_at && format(new Date(email.received_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            {email.summary && (
              <div className="mb-3 p-3 bg-surface-50 rounded text-sm text-surface-800/70">
                <span className="text-xs font-medium text-primary-600">AI Summary: </span>
                {email.summary}
              </div>
            )}
            <p className="text-sm whitespace-pre-wrap">{email.snippet}</p>
          </div>
        ))}
      </div>

      {!showReply ? (
        <button onClick={() => setShowReply(true)} className="btn-primary flex items-center gap-2">
          <Reply className="w-4 h-4" /> Reply with AI
        </button>
      ) : (
        <div className="card p-6">
          <h3 className="font-semibold mb-3">AI Reply</h3>
          {!draft ? (
            <>
              <textarea
                value={replyPrompt}
                onChange={(e) => setReplyPrompt(e.target.value)}
                placeholder="Describe how you want to reply, e.g. 'Politely decline the meeting and suggest next week'"
                className="input h-24 mb-3"
              />
              <div className="flex gap-2">
                <button onClick={handleDraftReply} disabled={drafting} className="btn-primary">
                  {drafting ? 'Drafting...' : 'Generate Reply'}
                </button>
                <button onClick={() => setShowReply(false)} className="btn-secondary">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3">
                <label className="text-sm font-medium">To:</label>
                <input value={draft.to || ''} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="input mt-1" />
              </div>
              <div className="mb-3">
                <label className="text-sm font-medium">Subject:</label>
                <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className="input mt-1" />
              </div>
              <div className="mb-3">
                <label className="text-sm font-medium">Body:</label>
                <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="input h-48 mt-1" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSend} className="btn-primary">Send</button>
                <button onClick={() => setDraft(null)} className="btn-secondary">Regenerate</button>
                <button onClick={() => { setShowReply(false); setDraft(null) }} className="btn-secondary">Discard</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
