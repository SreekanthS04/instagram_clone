// src/pages/Home.tsx
import { useEffect, useState } from "react";
import PostCard from "../components/Post/PostCard";

const API = import.meta.env.VITE_API_URL as string;

export default function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
    fetchUsers();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API}/api/posts`);
      const data = await res.json();
      setPosts(data || []);
    } catch (err) {
      console.error("Failed fetching posts", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/api/auth/users`);
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error("Failed fetching users", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto pt-6 pb-24 md:pb-6 px-4">
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-4 pb-2">
            {users.map((user) => (
              <div key={user._id || user.id} className="flex flex-col items-center gap-2 min-w-fit">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
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
                <div className="text-xs text-center">{user.username}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">Loading posts…</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8">No posts yet</div>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </div>
    </div>
  );
}
