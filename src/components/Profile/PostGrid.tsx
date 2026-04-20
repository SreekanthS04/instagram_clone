// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { Grid, BookMarked, UserSquare2, Settings } from "lucide-react";

const API = import.meta.env.VITE_API_URL as string;

export default function Profile() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "tagged">("posts");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => {
    if (!user) return;
    fetchUserPosts();
  }, [user]);

  const fetchUserPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/posts?userId=${user._id}`);
      const data = await res.json();
      setPosts(data || []);
    } catch (err) {
      console.error("Failed to load profile posts", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-600">Please login to view profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 md:gap-12">
              {/* Profile Picture */}
              <div className="flex justify-center md:justify-start">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-teal-500 p-1">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white p-1">
                    {user.profilePicture && user.profilePicture.startsWith("http") ? (
                      <img
                        src={user.profilePicture}
                        alt={user.username}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center text-white text-4xl font-bold">
                        {user.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                {/* Username and Edit Button */}
                <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                  <h1 className="text-2xl font-light">{user.username}</h1>
                  <button className="px-6 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-sm transition-colors">
                    Edit Profile
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>

                {/* Stats */}
                <div className="flex justify-center md:justify-start gap-8 mb-4">
                  <div className="text-center">
                    <span className="font-semibold text-lg">{posts.length}</span>
                    <span className="text-gray-600 text-sm ml-1">posts</span>
                  </div>
                  <div className="text-center">
                    <span className="font-semibold text-lg">{user.followers?.length || 0}</span>
                    <span className="text-gray-600 text-sm ml-1">followers</span>
                  </div>
                  <div className="text-center">
                    <span className="font-semibold text-lg">{user.following?.length || 0}</span>
                    <span className="text-gray-600 text-sm ml-1">following</span>
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-1">
                  <p className="font-semibold">{user.fullName || user.username}</p>
                  {user.bio && <p className="text-sm text-gray-700">{user.bio}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-gray-200">
            <div className="flex justify-center gap-12">
              <button
                onClick={() => setActiveTab("posts")}
                className={`flex items-center gap-2 py-3 border-t-2 transition-colors ${
                  activeTab === "posts"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400"
                }`}
              >
                <Grid className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-widest hidden sm:inline">Posts</span>
              </button>
              <button
                onClick={() => setActiveTab("saved")}
                className={`flex items-center gap-2 py-3 border-t-2 transition-colors ${
                  activeTab === "saved"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400"
                }`}
              >
                <BookMarked className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-widest hidden sm:inline">Saved</span>
              </button>
              <button
                onClick={() => setActiveTab("tagged")}
                className={`flex items-center gap-2 py-3 border-t-2 transition-colors ${
                  activeTab === "tagged"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400"
                }`}
              >
                <UserSquare2 className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-widest hidden sm:inline">Tagged</span>
              </button>
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="p-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading posts...</p>
              </div>
            </div>
          ) : activeTab === "posts" && posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-full border-4 border-gray-900 flex items-center justify-center mb-4">
                <Grid className="w-12 h-12 text-gray-900" />
              </div>
              <h3 className="text-2xl font-light mb-2">No Posts Yet</h3>
              <p className="text-gray-600 text-sm">Start sharing moments!</p>
            </div>
          ) : activeTab === "posts" ? (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="aspect-square bg-gray-100 overflow-hidden cursor-pointer group relative"
                >
                  <img
                    src={post.imageUrl}
                    alt={post.caption || "Post"}
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  />
                  {/* Hover Overlay with Stats */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2 text-white">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 48 48">
                        <path d="M34.6 6.1c5.7 0 10.4 5.2 10.4 11.5 0 6.8-5.9 11-11.5 16S25 41.3 24 41.9c-1.1-.7-4.7-4-9.5-8.3-5.7-5-11.5-9.2-11.5-16C3 11.3 7.7 6.1 13.4 6.1c4.2 0 6.5 2 8.1 4.3 1.9 2.6 2.2 3.9 2.5 3.9.3 0 .6-1.3 2.5-3.9 1.6-2.3 3.9-4.3 8.1-4.3m0-3c-4.5 0-7.9 1.8-10.6 5.6-2.7-3.7-6.1-5.5-10.6-5.5C6 3.1 0 9.6 0 17.6c0 7.3 5.4 12 10.6 16.5.6.5 1.3 1.1 1.9 1.7l2.3 2c4.4 3.9 6.6 5.9 7.6 6.5.5.3 1.1.5 1.6.5.6 0 1.1-.2 1.6-.5 1-.6 2.8-2.2 7.8-6.8l2-1.8c.7-.6 1.3-1.2 2-1.7C42.7 29.6 48 25 48 17.6c0-8-6-14.5-13.4-14.5z"></path>
                      </svg>
                      <span className="font-semibold">{post.likes?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 48 48">
                        <path d="M47.5 46.1l-2.8-11c1.8-3.3 2.8-7.1 2.8-11.1C47.5 11 37 .5 24 .5S.5 11 .5 24 11 47.5 24 47.5c4 0 7.8-1 11.1-2.8l11 2.8c.8.2 1.6-.6 1.4-1.4zm-3-22.1c0 4-1 7-2.6 10-.2.4-.3.9-.2 1.4l2.1 8.4-8.3-2.1c-.5-.1-1 0-1.4.2-3 1.6-6 2.6-10 2.6-11.4 0-20.6-9.2-20.6-20.5S12.7 3.5 24 3.5 44.5 12.7 44.5 24z"></path>
                      </svg>
                      <span className="font-semibold">{post.comments?.length || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-center">
                <p className="text-2xl font-light text-gray-600">
                  {activeTab === "saved" ? "No saved posts yet" : "No tagged posts yet"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}