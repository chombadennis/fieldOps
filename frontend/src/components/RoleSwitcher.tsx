'use client';

import React from 'react';
import { Shield, UserCheck, HardHat, Scale, Users, Wrench } from 'lucide-react';

export type UserRole = 'admin' | 'engineer' | 'hr' | 'legal' | 'field_officer';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export const ROLES_CONFIG: Record<UserRole, { label: string; icon: any; color: string; visibleTabs: string[] }> = {
  admin: {
    label: 'Company Admin',
    icon: Shield,
    color: 'bg-crimson-violet-50 text-crimson-violet-700 border-crimson-violet-200',
    visibleTabs: ['pmo', 'tech', 'field_ops', 'hr', 'legal'],
  },
  engineer: {
    label: 'Engineer / Tech',
    icon: HardHat,
    color: 'bg-dark-teal-50 text-dark-teal-700 border-dark-teal-200',
    visibleTabs: ['pmo', 'tech', 'field_ops'],
  },
  hr: {
    label: 'HR Department',
    icon: Users,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    visibleTabs: ['pmo', 'hr'],
  },
  legal: {
    label: 'Legal Counsel',
    icon: Scale,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    visibleTabs: ['pmo', 'legal'],
  },
  field_officer: {
    label: 'Field Officer',
    icon: Wrench,
    color: 'bg-princeton-orange-50 text-princeton-orange-700 border-princeton-orange-200',
    visibleTabs: ['pmo', 'field_ops'],
  },
};

export default function RoleSwitcher({ currentRole, onRoleChange }: RoleSwitcherProps) {
  const activeConfig = ROLES_CONFIG[currentRole] || ROLES_CONFIG.admin;
  const RoleIcon = activeConfig.icon;

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center space-x-3.5">
        <div className={`p-3 rounded-2xl border bg-black/40 ${activeConfig.color.replace(/bg-[^ ]+/, '').replace(/text-[^ ]+/, 'text-white drop-shadow-md').replace(/border-[^ ]+/, 'border-white/20')}`}>
          <RoleIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-inter">Role Preview Mode</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <UserCheck className="w-3 h-3 mr-1" /> RBAC Active
            </span>
          </div>
          <h4 className="text-sm font-bold font-lexend text-white drop-shadow-md">{activeConfig.label} View</h4>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400 font-semibold mr-1">Switch Role View:</span>
        {(Object.keys(ROLES_CONFIG) as UserRole[]).map((roleKey) => {
          const cfg = ROLES_CONFIG[roleKey];
          const Icon = cfg.icon;
          const isActive = currentRole === roleKey;
          return (
            <button
              key={roleKey}
              onClick={() => onRoleChange(roleKey)}
              className={`inline-flex items-center px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                isActive
                  ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 shadow-[0_0_15px_rgba(0,243,255,0.3)] scale-[1.02]'
                  : 'bg-black/40 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              {cfg.label.split(' ')[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
