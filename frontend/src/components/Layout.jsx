import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Inbox, PenSquare, MessageSquare, LogOut, Mail,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/compose', icon: PenSquare, label: 'Compose' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-surface-900 text-white flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <Mail className="w-8 h-8 text-primary-500" />
          <div>
            <h1 className="font-bold text-lg">MailMind</h1>
            <p className="text-xs text-surface-200">AI Email Intelligence</p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'text-surface-200 hover:bg-surface-800'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-800">
          <div className="flex items-center gap-3 mb-3">
            {user?.avatar_url && (
              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-surface-200 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-surface-200 hover:text-white w-full px-2 py-1">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
