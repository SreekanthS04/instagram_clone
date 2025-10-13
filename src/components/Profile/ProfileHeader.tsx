import { Settings } from 'lucide-react';
import { User } from '../../types';

interface ProfileHeaderProps {
  user: User;
}

export default function ProfileHeader({ user }: ProfileHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <img
            src={user.profilePicture}
            alt={user.username}
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover ring-4 ring-purple-200"
          />

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">{user.username}</h2>
              <div className="flex items-center gap-3">
                <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-teal-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-teal-700 transition-all">
                  Edit Profile
                </button>
                <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
                  <Settings className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>

            <div className="flex justify-center md:justify-start gap-8 mb-6">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{user.posts}</p>
                <p className="text-gray-600">Posts</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{user.followers.toLocaleString()}</p>
                <p className="text-gray-600">Followers</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{user.following}</p>
                <p className="text-gray-600">Following</p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-1">{user.fullName}</p>
              <p className="text-gray-700">{user.bio}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
