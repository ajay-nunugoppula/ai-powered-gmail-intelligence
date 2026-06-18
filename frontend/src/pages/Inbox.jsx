import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { emailsApi } from '../api/client'
import { Search, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const CATEGORY_LABELS = {
  newsletters: 'Newsletters',
  job_recruitment: 'Job',
  finance: 'Finance',
  notifications: 'Notifications',
  personal: 'Personal',
  work_professional: 'Work',
  uncategorized: 'Other',
}

const CATEGORY_COLORS = {
  newsletters: 'bg-purple-100 text-purple-700',
  job_recruitment: 'bg-blue-100 text-blue-700',
  finance: 'bg-green-100 text-green-700',
  notifications: 'bg-yellow-100 text-yellow-700',
  personal: 'bg-pink-100 text-pink-700',
  work_professional: 'bg-indigo-100 text-indigo-700',
  uncategorized: 'bg-gray-100 text-gray-700',
}

export default function Inbox() {
  const [searchParams] = useSearchParams()
  const [emails, setEmails] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const category = searchParams.get('category')

  useEffect(() => {
    loadEmails()
  }, [page, category])

  const loadEmails = async () => {
    setLoading(true)
    try {
      const params = { page, page_size: 20 }
      if (category) params.category = category
      if (search) params.search = search
      const res = await emailsApi.list(params)
      setEmails(res.data.emails)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    loadEmails()
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {category ? CATEGORY_LABELS[category] || 'Inbox' : 'Inbox'}
          </h1>
          <p className="text-surface-800/60">{total} emails</p>
        </div>
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-800/40" />
          <input
            type="text"
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-64"
          />
        </form>
      </div>

      {loading ? (
        <div className="text-center py-12 text-surface-800/60">Loading emails...</div>
      ) : emails.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="w-12 h-12 text-surface-200 mx-auto mb-4" />
          <p className="text-surface-800/60">No emails found. Sync your Gmail to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => (
            <Link
              key={email.id}
              to={`/threads/${email.thread_id}`}
              className="card p-4 flex items-start gap-4 hover:shadow-md transition-shadow block"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-medium ${!email.is_read ? 'text-surface-900' : 'text-surface-800/70'}`}>
                    {email.sender}
                  </span>
                  {email.category && (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${CATEGORY_COLORS[email.category]}`}>
                      {CATEGORY_LABELS[email.category]}
                    </span>
                  )}
                  <span className="text-xs text-surface-800/40 ml-auto shrink-0">
                    {email.received_at && formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                  </span>
                </div>
                <p className={`text-sm truncate ${!email.is_read ? 'font-semibold' : ''}`}>{email.subject}</p>
                <p className="text-sm text-surface-800/50 truncate mt-0.5">
                  {email.summary || email.snippet}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary">Previous</button>
          <span className="px-4 py-2 text-sm">Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="btn-secondary">Next</button>
        </div>
      )}
    </div>
  )
}
