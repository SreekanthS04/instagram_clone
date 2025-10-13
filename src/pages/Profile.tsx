// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import PostCard from "../components/Post/PostCard";

const API = import.meta.env.VITE_API_URL as string;

export default function Profile() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
      <div className="p-6 text-center">
        <p>Please login to view profile</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200">
              <img
                src={
                  user.profilePicture && user.profilePicture.startsWith("http")
                    ? user.profilePicture
                    : user.profilePicture
                    ? `${API}${user.profilePicture}`
                    : "/default-avatar.png"
                }
                alt={user.username}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="font-semibold text-lg">{user.username}</div>
              <div className="text-sm text-gray-600">{user.fullName}</div>
              <div className="text-sm text-gray-600 mt-2">{user.bio}</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">Loading posts…</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8">You have no posts yet</div>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </div>
    </div>
  );
}
