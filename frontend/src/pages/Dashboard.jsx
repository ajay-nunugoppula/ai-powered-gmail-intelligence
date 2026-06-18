import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { emailsApi, categoriesApi } from '../api/client'
import { RefreshCw, Mail, MessageSquare, PenSquare, TrendingUp } from 'lucide-react'

const CATEGORY_LABELS = {
  newsletters: 'Newsletters',
  job_recruitment: 'Job / Recruitment',
  finance: 'Finance',
  notifications: 'Notifications',
  personal: 'Personal',
  work_professional: 'Work / Professional',
  uncategorized: 'Uncategorized',
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

export default function Dashboard() {
  const [syncStatus, setSyncStatus] = useState(null)
  const [categories, setCategories] = useState([])
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statusRes, catRes] = await Promise.all([
        emailsApi.syncStatus(),
        categoriesApi.stats(),
      ])
      setSyncStatus(statusRes.data)
      setCategories(catRes.data.categories || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await emailsApi.sync(false)
      const poll = setInterval(async () => {
        const res = await emailsApi.syncStatus()
        setSyncStatus(res.data)
        if (res.data.status === 'idle' || res.data.status === 'error') {
          clearInterval(poll)
          setSyncing(false)
          loadData()
        }
      }, 3000)
    } catch {
      setSyncing(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-surface-800/60">Your email intelligence overview</p>
        </div>
        <button onClick={handleSync} disabled={syncing} className="btn-primary flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Emails'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-primary-600" />
            <span className="text-sm text-surface-800/60">Total Emails</span>
          </div>
          <p className="text-3xl font-bold">{syncStatus?.total_emails_synced || 0}</p>
          {syncStatus?.last_sync_at && (
            <p className="text-xs text-surface-800/40 mt-1">
              Last synced: {new Date(syncStatus.last_sync_at).toLocaleString()}
            </p>
          )}
        </div>

        <Link to="/chat" className="card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="w-5 h-5 text-primary-600" />
            <span className="text-sm text-surface-800/60">AI Chat</span>
          </div>
          <p className="text-lg font-semibold">Ask about your emails</p>
          <p className="text-sm text-surface-800/60 mt-1">Search, summarize, and analyze</p>
        </Link>

        <Link to="/compose" className="card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <PenSquare className="w-5 h-5 text-primary-600" />
            <span className="text-sm text-surface-800/60">Compose</span>
          </div>
          <p className="text-lg font-semibold">Draft with AI</p>
          <p className="text-sm text-surface-800/60 mt-1">Write emails from prompts</p>
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold">Email Categories</h2>
        </div>
        {categories.length === 0 ? (
          <p className="text-surface-800/60">Sync your emails to see category breakdown</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.category}
                to={`/inbox?category=${cat.category}`}
                className="p-4 rounded-lg border border-surface-200 hover:border-primary-300 transition-colors"
              >
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.uncategorized}`}>
                  {CATEGORY_LABELS[cat.category] || cat.category}
                </span>
                <p className="text-2xl font-bold">{cat.count}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
