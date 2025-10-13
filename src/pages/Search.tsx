import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { mockUsers, mockPosts } from '../data/mockData';

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = mockUsers.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPosts = mockPosts.filter((post) =>
    post.caption.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-6 pt-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users, posts..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {searchQuery && (
          <div className="space-y-6">
            {filteredUsers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <h2 className="text-lg font-semibold text-gray-900 p-4 border-b border-gray-200">
                  Users
                </h2>
                <div className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.profilePicture}
                          alt={user.username}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-200"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{user.username}</p>
                          <p className="text-sm text-gray-600">{user.fullName}</p>
                        </div>
                      </div>
                      <button className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-teal-600 text-white rounded-lg font-medium text-sm hover:from-purple-700 hover:to-teal-700 transition-all">
                        Follow
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredPosts.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <h2 className="text-lg font-semibold text-gray-900 p-4 border-b border-gray-200">
                  Posts
                </h2>
                <div className="grid grid-cols-3 gap-1">
                  {filteredPosts.map((post) => (
                    <div key={post.id} className="aspect-square cursor-pointer group">
                      <img
                        src={post.imageUrl}
                        alt="Post"
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!searchQuery && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <SearchIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Search for users and posts
              </h2>
              <p className="text-gray-600">
                Start typing to find people and content you love
              </p>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Users</h3>
              <div className="space-y-3">
                {mockUsers.slice(0, 3).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.profilePicture}
                        alt={user.username}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-200"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-600">{user.fullName}</p>
                      </div>
                    </div>
                    <button className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-teal-600 text-white rounded-lg font-medium text-sm hover:from-purple-700 hover:to-teal-700 transition-all">
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
