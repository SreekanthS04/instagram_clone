import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import PostCard from "../components/Post/PostCard";
import TextPostCard from "../components/Post/TextPostCard";

const API = import.meta.env.VITE_API_URL as string;

// Mini video player component for feed
function VideoPostCard({ post }: { post: any }) {
  const [isMuted, setIsMuted] = useState(true);
  const isAI = post.aiDetection?.isAIGenerated === true;
  const aiConfidence = post.aiDetection?.confidence ?? 0;

  return (
    <div className="bg-white border rounded-lg mb-6">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center">
          <img
            src={
              post.user?.profilePicture?.startsWith("http")
                ? post.user.profilePicture
                : post.user?.profilePicture
                ? `${API}${post.user.profilePicture}`
                : `https://i.pravatar.cc/150?u=${post.user?.username || 'user'}`
            }
            alt={post.user?.username}
            className="w-8 h-8 rounded-full object-cover mr-3"
          />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{post.user?.username || "Unknown User"}</p>
              {isAI && (
                <span className="text-xs bg-gradient-to-r from-purple-600 to-pink-500 text-white px-2 py-0.5 rounded-full font-semibold">
                  🤖 AI
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Video */}
      <div className="w-full bg-black relative">
        <video
          src={post.videoUrl?.startsWith("http") ? post.videoUrl : `${API}${post.videoUrl}`}
          controls
          loop
          muted={isMuted}
          playsInline
          className="w-full max-h-[600px] object-contain"
        />

        {/* AI Badge on video */}
        {isAI && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm bg-opacity-90 flex items-center gap-2 z-10">
            <span className="text-base">🤖</span>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-xs">AI Generated</span>
              <span className="text-[10px] opacity-90">{Math.round(aiConfidence * 100)}% confidence</span>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsMuted(!isMuted)}
          className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm p-2 rounded-full text-white hover:bg-black/70 transition-colors"
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Actions & Caption */}
      <div className="p-3">
        {post.caption && (
          <p className="text-sm">
            <span className="font-semibold mr-2">{post.user?.username || "Unknown"}</span>
            {post.caption}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    fetchPosts();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (location.state?.refresh) {
      console.log('🔄 Refreshing posts after upload');
      fetchPosts();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchPosts = async () => {
    try {
      console.log('🔄 Fetching all posts (images + videos + text)...');

      const res = await fetch(`${API}/api/posts`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache'
      });

      if (!res.ok) {
        console.error('❌ Response not OK:', res.status);
        setLoading(false);
        return;
      }

      const data = await res.json();
      const postsArray = Array.isArray(data) ? data : [];

      console.log('✅ Posts fetched:', postsArray.length);
      console.log('   Images:', postsArray.filter(p => !p.isReel && !p.isTextPost).length);
      console.log('   Videos:', postsArray.filter(p => p.isReel).length);
      console.log('   Text:', postsArray.filter(p => p.isTextPost).length);

      // Sort by date
      postsArray.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setPosts(postsArray);

    } catch (err) {
      console.error("❌ Failed fetching posts:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/api/auth/users`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed fetching users", err);
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => (p.id || p._id) !== postId));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto pt-6 pb-24 md:pb-6 px-4">
        {/* Stories Section */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-4 pb-2">
            {users.map((user) => (
              <div key={user._id || user.id} className="flex flex-col items-center gap-2 min-w-fit">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-tr from-purple-600 to-pink-500 p-[2px] cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white p-[2px]">
                    <img
                      src={
                        user.profilePicture?.startsWith("http")
                          ? user.profilePicture
                          : user.profilePicture
                          ? `${API}${user.profilePicture}`
                          : `https://i.pravatar.cc/150?u=${user.username}`
                      }
                      alt={user.username}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                </div>
                <div className="text-xs text-center truncate w-16">{user.username}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mixed Feed - Images + Videos + Text */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading posts...</p>
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No posts available</p>
            </div>
          ) : (
            posts.map((post) => {
              // Text posts
              if (post.isTextPost && post.textContent) {
                return <TextPostCard key={post.id || post._id} post={post} onDelete={handleDeletePost} />;
              }
              // Video posts
              if (post.isReel && post.videoUrl) {
                return <VideoPostCard key={post.id || post._id} post={post} />;
              }
              // Image posts
              return <PostCard key={post.id || post._id} post={post} onDelete={handleDeletePost} />;
            })
          )}
        </div>
      </div>
    </div>
  );
}