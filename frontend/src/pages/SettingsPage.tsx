import { useState } from 'react'
import { LayoutGrid, UtensilsCrossed, Users } from 'lucide-react'
import TablesSettings from '@/pages/settings/TablesSettings'
import MenuSettings from '@/pages/settings/MenuSettings'
import UsersSettings from '@/pages/settings/UsersSettings'

type SettingsTab = 'tables' | 'menu' | 'users'

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'tables', label: 'Tables Configuration', icon: LayoutGrid },
  { id: 'menu', label: 'Menu Management', icon: UtensilsCrossed },
  { id: 'users', label: 'User Management', icon: Users },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('tables')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Sub-tab navigation */}
      <nav className="flex shrink-0 border-b border-[#E5E7EB] bg-white dark:border-gray-700 dark:bg-[#1E2939]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors ${
              activeTab === id
                ? 'border-[#F54900] text-[#F54900]'
                : 'border-transparent text-[#6B7280] hover:text-[#4A5565] dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tables' && <TablesSettings />}
        {activeTab === 'menu' && <MenuSettings />}
        {activeTab === 'users' && <UsersSettings />}
      </div>
    </div>
  )
}
