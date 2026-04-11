'use client';

import { FolderGit2, GitPullRequest, Bug, Zap, KeyRound, Clipboard, TicketPlus, Search, Play } from 'lucide-react';

interface QuickActionsCardProps {
  onAction: (message: string) => void;
  onTestConsent?: () => void;
  activeService?: 'github' | 'jira';
}

const githubActions = [
  {
    icon: <FolderGit2 className="w-4 h-4" />,
    label: 'View All Repos',
    message: 'Show all my GitHub repositories',
    color: 'text-gray-700'
  },
  {
    icon: <GitPullRequest className="w-4 h-4" />,
    label: 'Review PRs',
    message: 'List all open pull requests',
    color: 'text-purple-600'
  },
  {
    icon: <Bug className="w-4 h-4" />,
    label: 'Triage Issues',
    message: 'Show all open issues',
    color: 'text-red-600'
  },
  {
    icon: <Zap className="w-4 h-4" />,
    label: 'Quick Help',
    message: 'What can you do?',
    color: 'text-green-600'
  },
];

const jiraActions = [
  {
    icon: <Clipboard className="w-4 h-4" />,
    label: 'List Projects',
    message: 'List all my Jira projects',
    color: 'text-blue-600'
  },
  {
    icon: <Bug className="w-4 h-4" />,
    label: 'My Open Issues',
    message: 'Show open issues assigned to me',
    color: 'text-orange-600'
  },
  {
    icon: <TicketPlus className="w-4 h-4" />,
    label: 'Create Issue',
    message: 'Create a new issue in Jira',
    color: 'text-green-600'
  },
  {
    icon: <Search className="w-4 h-4" />,
    label: 'Search (JQL)',
    message: 'Find issues with JQL query',
    color: 'text-purple-600'
  },
];

export default function QuickActionsCard({ onAction, onTestConsent, activeService = 'github' }: QuickActionsCardProps) {
  const quickActions = activeService === 'github' ? githubActions : jiraActions;
  const isJira = activeService === 'jira';

  return (
    <div
      className="rounded-xl border-2 p-4 shadow-sm"
      style={{
        backgroundColor: isJira ? '#e3f2fd' : '#e0f2f1',
        borderColor: isJira ? '#2196f3' : '#26a69a'
      }}
    >
      <div className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        {isJira ? (
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
          </svg>
        ) : (
          <Zap className="w-4 h-4 text-teal-600" />
        )}
        Quick Actions ({isJira ? 'Jira' : 'GitHub'})
      </div>
      <div className="space-y-2">
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => onAction(action.message)}
            className="w-full text-left px-3 py-2 bg-white hover:bg-accent/10 rounded-lg transition-all hover:shadow-md hover:scale-[1.02] flex items-center gap-2 group"
          >
            <div className={`${action.color} group-hover:scale-110 transition-transform`}>
              {action.icon}
            </div>
            <span className="text-sm text-gray-700 group-hover:text-accent transition-colors">
              {action.label}
            </span>
          </button>
        ))}
        {onTestConsent && (
          <button
            onClick={onTestConsent}
            className="w-full text-left px-3 py-2 bg-orange-100 hover:bg-orange-200 rounded-lg transition-all hover:shadow-md hover:scale-[1.02] flex items-center gap-2 group border border-orange-300"
          >
            <div className="text-orange-600 group-hover:scale-110 transition-transform">
              <KeyRound className="w-4 h-4" />
            </div>
            <span className="text-sm text-orange-700 font-medium">
              Test Consent Flow
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
