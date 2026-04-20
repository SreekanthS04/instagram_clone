// src/pages/Search.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Loader2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL as string;

interface User {
  _id: string;
  username: string;
  fullName?: string;
  profilePicture?: string;
  bio?: string;
  followers?: number;
  following?: number;
  posts?: number;
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  // Fetch all users on mount
  useEffect(() => {
    fetchAllUsers();
  }, []);

  // Filter users whenever search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const query = searchQuery.toLowerCase().trim();
    
    const filtered = allUsers.filter((user) => {
      const username = user.username?.toLowerCase() || '';
      const fullName = user.fullName?.toLowerCase() || '';
      const bio = user.bio?.toLowerCase() || '';
      
      return username.includes(query) || 
             fullName.includes(query) || 
             bio.includes(query);
    });

    setFilteredUsers(filtered);
    setSearching(false);
  }, [searchQuery, allUsers]);

  const fetchAllUsers = async () => {
    try {
      console.log('🔄 Fetching all users...');
      const res = await fetch(`${API}/api/auth/users`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await res.json();
      console.log('✅ Users fetched:', data.length);
      
      setAllUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('❌ Failed to fetch users:', err);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  const getProfilePictureUrl = (user: User) => {
    if (user.profilePicture?.startsWith('http')) {
      return user.profilePicture;
    }
    if (user.profilePicture) {
      return `${API}${user.profilePicture}`;
    }
    return `https://i.pravatar.cc/150?u=${user.username}`;
  };

  // Get suggested users (first 5 users)
  const suggestedUsers = allUsers.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-6 pt-6">
      <div className="max-w-4xl mx-auto px-4">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by username, name, or bio..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-600 animate-spin" />
            )}
          </div>
        </div>

        {loading ? (
          /* Loading State */
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading users...</p>
            </div>
          </div>
        ) : searchQuery ? (
          /* Search Results */
          <div className="space-y-6">
            {filteredUsers.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <h2 className="text-lg font-semibold text-gray-900 p-4 border-b border-gray-200">
                  Users ({filteredUsers.length})
                </h2>
                <div className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <div 
                      key={user._id} 
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(user._id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <img
                          src={getProfilePictureUrl(user)}
                          alt={user.username}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-200 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{user.username}</p>
                          <p className="text-sm text-gray-600 truncate">{user.fullName || 'Instagram User'}</p>
                          {user.bio && (
                            <p className="text-xs text-gray-500 truncate mt-1">{user.bio}</p>
                          )}
                        </div>
                      </div>
                      <button 
                        className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-teal-600 text-white rounded-lg font-medium text-sm hover:from-purple-700 hover:to-teal-700 transition-all flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Add follow functionality
                        }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <SearchIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600">
                  Try searching for a different username or name
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Default View - Suggested Users */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <SearchIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Search for users
              </h2>
              <p className="text-gray-600">
                Start typing to find people on InstaClone
              </p>
            </div>

            {suggestedUsers.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Users</h3>
                <div className="space-y-3">
                  {suggestedUsers.map((user) => (
                    <div 
                      key={user._id} 
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(user._id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <img
                          src={getProfilePictureUrl(user)}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-200 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{user.username}</p>
                          <p className="text-sm text-gray-600 truncate">{user.fullName || 'Instagram User'}</p>
                        </div>
                      </div>
                      <button 
                        className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-teal-600 text-white rounded-lg font-medium text-sm hover:from-purple-700 hover:to-teal-700 transition-all flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUserClick(user._id);
                        }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}