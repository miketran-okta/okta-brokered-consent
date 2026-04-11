'use client';

import { User } from 'lucide-react';

interface UserIdentityCardProps {
  name?: string | null;
  email?: string | null;
  groups?: string[];
}

export default function UserIdentityCard({ name, email, groups }: UserIdentityCardProps) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="rounded-xl border-2 shadow-sm p-4" style={{ backgroundColor: '#e0f2f1', borderColor: '#26a69a' }}>
      <div className="flex items-center gap-3">
        {/* Avatar - Light Blue */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md"
          style={{ backgroundColor: '#60a5fa' }}
        >
          {initials}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-800">{name || 'User'}</div>
          <div className="text-xs text-gray-500">{email || 'user@example.com'}</div>
        </div>
        {/* User Icon - Red */}
        <div style={{ color: '#ef4444' }}>
          <User className="w-5 h-5" />
        </div>
      </div>

      {groups && groups.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Groups</div>
          <div className="flex flex-wrap gap-1">
            {groups.slice(0, 3).map((group, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 text-[10px] rounded-full font-mono"
                style={{ backgroundColor: 'rgba(74, 222, 128, 0.2)', color: '#16a34a' }}
              >
                {group}
              </span>
            ))}
            {groups.length > 3 && (
              <span
                className="px-2 py-0.5 text-[10px] rounded-full"
                style={{ backgroundColor: 'rgba(74, 222, 128, 0.15)', color: '#16a34a' }}
              >
                +{groups.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
