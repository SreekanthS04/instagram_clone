import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Grid, ArrowLeft, MoreVertical, Play } from "lucide-react";

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

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return null;
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  };

  const currentUser = getCurrentUser();
  const isOwnProfile = currentUser?._id === userId;

  useEffect(() => {
    if (userId) {
      if (isOwnProfile) {
        navigate("/profile", { replace: true });
        return;
      }
      fetchUserData();
      fetchUserPosts();
    }
  }, [userId, isOwnProfile]);

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${API}/api/auth/users`);
      if (!res.ok) throw new Error("Failed to fetch user");
      const allUsers = await res.json();
      const foundUser = allUsers.find((u: User) => u._id === userId);
      if (!foundUser) throw new Error("User not found");
      setUser(foundUser);
    } catch (err: any) {
      setError(err.message || "Failed to load user");
    }
  };

  const fetchUserPosts = async () => {
    try {
      const res = await fetch(`${API}/api/posts?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
    }
  };

  // Images → /post/:id  |  Reels → /reels?id=:id
  const handlePostClick = (post: any) => {
    const id = post.id || post._id;
    if (post.isReel) {
      navigate(`/reels?id=${id}`);
    } else {
      navigate(`/post/${id}`);
    }
  };

  const getProfilePictureUrl = () => {
    if (!user) return "";
    if (user.profilePicture?.startsWith("http")) return user.profilePicture;
    if (user.profilePicture) return `${API}${user.profilePicture}`;
    return `https://i.pravatar.cc/150?u=${user.username}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "User not found"}</p>
          <button onClick={() => navigate(-1)} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold">{user.username}</h1>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <MoreVertical className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Profile Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 md:gap-12">
              {/* Profile Picture */}
              <div className="flex justify-center md:justify-start">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-teal-500 p-1">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white p-1">
                    <img
                      src={getProfilePictureUrl()}
                      alt={user.username}
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = `https://i.pravatar.cc/150?u=${user.username}`;
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                  <h1 className="text-2xl font-light">{user.username}</h1>
                  <button
                    onClick={() => setIsFollowing(!isFollowing)}
                    className={`px-6 py-1.5 rounded-lg font-semibold text-sm transition-all ${
                      isFollowing
                        ? "bg-gray-200 text-gray-900 hover:bg-gray-300"
                        : "bg-gradient-to-r from-purple-600 to-teal-500 text-white hover:shadow-lg"
                    }`}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                  <button className="px-6 py-1.5 bg-gray-100 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors">
                    Message
                  </button>
                </div>

                <div className="flex justify-center md:justify-start gap-8 mb-4">
                  <div><span className="font-semibold">{posts.length}</span> posts</div>
                  <div><span className="font-semibold">{user.followers || 0}</span> followers</div>
                  <div><span className="font-semibold">{user.following || 0}</span> following</div>
                </div>

                <p className="font-semibold">{user.fullName || user.username}</p>
                {user.bio && <p className="text-sm text-gray-700 mt-1">{user.bio}</p>}
              </div>
            </div>
          </div>

          {/* Posts Tab */}
          <div className="border-t border-gray-200 flex justify-center">
            <div className="py-3 flex items-center gap-2 border-t-2 border-gray-900 text-gray-900">
              <Grid className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase">Posts</span>
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="p-1">
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full border-4 border-gray-900 mx-auto mb-4 flex items-center justify-center">
                <Grid className="w-8 h-8" />
              </div>
              <p className="text-2xl font-light mb-2">No Posts Yet</p>
              <p className="text-gray-600">{user.username} hasn't shared anything yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => {
                const isAI = post.aiDetection?.isAIGenerated === true;
                const isReel = post.isReel === true;
                const rawUrl = isReel ? post.videoUrl : post.imageUrl;
                const mediaUrl = rawUrl?.startsWith("http") ? rawUrl : `${API}${rawUrl}`;

                return (
                  <div
                    key={post.id || post._id}
                    className="aspect-square overflow-hidden cursor-pointer relative group bg-gray-900"
                    onClick={() => handlePostClick(post)}
                  >
                    {/* Reel → video element for thumbnail */}
                    {isReel ? (
                      <video
                        src={mediaUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          (e.currentTarget as HTMLVideoElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt={post.caption || "Post"}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          e.currentTarget.src = "https://via.placeholder.com/400?text=Not+Found";
                        }}
                      />
                    )}

                    {/* Reel play icon */}
                    {isReel && (
                      <div className="absolute top-2 right-2 z-10 text-white drop-shadow-lg">
                        <Play className="w-5 h-5 fill-white" />
                      </div>
                    )}

                    {/* AI Badge — no emoji, safe on all platforms */}
                    {isAI && (
                      <div className="absolute top-2 left-2 z-10 bg-black/75 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1 shadow-lg">
                        <span>AI</span>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-6 text-white">
                        <div className="flex items-center gap-2">
                          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          <span className="font-semibold">{post.likes?.length || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                          </svg>
                          <span className="font-semibold">{post.comments?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}