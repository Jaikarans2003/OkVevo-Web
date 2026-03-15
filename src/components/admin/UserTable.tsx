'use client';

import { useState } from 'react';
import type { UserWithStats } from '@/types/admin';
import { formatPrice } from '@/services/SubscriptionService';
import { Trash2, Edit, Search } from 'lucide-react';

interface UserTableProps {
    users: UserWithStats[];
    onEditCredits: (user: UserWithStats) => void;
    onDeleteUser: (user: UserWithStats) => void;
}

export default function UserTable({ users, onEditCredits, onDeleteUser }: UserTableProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<keyof UserWithStats>('createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Filter users
    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.uid.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort users
    const sortedUsers = [...filteredUsers].sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue === undefined || bValue === undefined) return 0;

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;

        return sortDirection === 'asc' ? comparison : -comparison;
    });

    const handleSort = (field: keyof UserWithStats) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const getStatusBadge = (status?: string) => {
        const colors = {
            active: 'bg-green-500/20 text-green-400 border-green-500/30',
            cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
            paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        };

        const color = colors[status as keyof typeof colors] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

        return (
            <span className={`px-2 py-1 rounded-full text-xs border ${color}`}>
                {status || 'none'}
            </span>
        );
    };

    const getPlanBadge = (planType?: string) => {
        const colors = {
            hobby: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            pro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        };

        const color = colors[planType as keyof typeof colors] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

        return (
            <span className={`px-2 py-1 rounded-full text-xs border ${color}`}>
                {planType || 'free'}
            </span>
        );
    };

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Search by email or user ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-[#1a1a1a] border-b border-gray-700">
                        <tr>
                            <th
                                className="px-6 py-3 cursor-pointer hover:bg-gray-800"
                                onClick={() => handleSort('email')}
                            >
                                Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="px-6 py-3 cursor-pointer hover:bg-gray-800"
                                onClick={() => handleSort('userType')}
                            >
                                Type {sortField === 'userType' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3">Plan</th>
                            <th className="px-6 py-3">Status</th>
                            <th
                                className="px-6 py-3 cursor-pointer hover:bg-gray-800 text-right"
                                onClick={() => handleSort('creditsAllocated')}
                            >
                                Allocated {sortField === 'creditsAllocated' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="px-6 py-3 cursor-pointer hover:bg-gray-800 text-right"
                                onClick={() => handleSort('creditsSpent')}
                            >
                                Spent {sortField === 'creditsSpent' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="px-6 py-3 cursor-pointer hover:bg-gray-800 text-right"
                                onClick={() => handleSort('creditsRemaining')}
                            >
                                Remaining {sortField === 'creditsRemaining' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="px-6 py-3 cursor-pointer hover:bg-gray-800"
                                onClick={() => handleSort('createdAt')}
                            >
                                Joined {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedUsers.map((user) => (
                            <tr
                                key={user.uid}
                                className="bg-[#141413] border-b border-gray-700 hover:bg-[#1a1a1a] transition-colors"
                            >
                                <td className="px-6 py-4 font-medium text-white">
                                    <div className="flex flex-col">
                                        <span>{user.email}</span>
                                        <span className="text-xs text-gray-500">{user.uid}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-300">
                                    {user.userType || 'single'}
                                </td>
                                <td className="px-6 py-4">
                                    {getPlanBadge(user.planType)}
                                </td>
                                <td className="px-6 py-4">
                                    {getStatusBadge(user.subscriptionStatus)}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-300">
                                    {user.creditsAllocated.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-300">
                                    {user.creditsSpent.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-white">
                                    {user.creditsRemaining.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-gray-400 text-sm">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => onEditCredits(user)}
                                            className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors group"
                                            title="Edit Credits"
                                        >
                                            <Edit className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
                                        </button>
                                        <button
                                            onClick={() => onDeleteUser(user)}
                                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group"
                                            title="Delete User"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-400 group-hover:text-red-300" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Results Summary */}
            <div className="text-sm text-gray-400">
                Showing {sortedUsers.length} of {users.length} users
            </div>
        </div>
    );
}
