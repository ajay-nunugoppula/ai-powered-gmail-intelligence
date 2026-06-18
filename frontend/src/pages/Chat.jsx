import { useState, useRef, useEffect } from 'react'
import { chatApi } from '../api/client'
import { Send, Bot, User, Mail } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const SUGGESTIONS = [
  'Summarize all emails from this month',
  'Which companies rejected my job application?',
  'List all important tech news from the past 4 days',
  'What has been discussed about recent projects?',
]

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const msg = text || input
    if (!msg.trim() || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const res = await chatApi.sendMessage({ message: msg, session_id: sessionId })
      if (!sessionId && res.data.session_id) setSessionId(res.data.session_id)

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.data.content,
          sources: res.data.sources || [],
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-surface-200">
        <h1 className="text-2xl font-bold">AI Email Assistant</h1>
        <p className="text-surface-800/60 text-sm">Ask questions about your emails — I only use your synced email data</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-primary-300 mx-auto mb-4" />
            <p className="text-surface-800/60 mb-6">Try asking something about your emails</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg hover:border-primary-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary-600" />
              </div>
            )}
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-white border border-surface-200'} rounded-xl px-4 py-3`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
              {msg.sources?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-100">
                  <p className="text-xs font-medium text-surface-800/50 mb-2">Sources:</p>
                  <div className="space-y-1">
                    {msg.sources.map((src, j) => (
                      <div key={j} className="flex items-start gap-2 text-xs text-surface-800/60">
                        <Mail className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                          <strong>{src.sender}</strong> — {src.subject}
                          {src.received_at && ` (${new Date(src.received_at).toLocaleDateString()})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-surface-800" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-600" />
            </div>
            <div className="bg-white border border-surface-200 rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-surface-200 bg-white">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2 max-w-3xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your emails..."
            className="input flex-1"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
