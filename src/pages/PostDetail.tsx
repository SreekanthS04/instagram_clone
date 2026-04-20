// src/pages/PostDetail.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, X, Trash2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL as string;

const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

const getToken = () => localStorage.getItem("token");

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (postId) fetchPost();
  }, [postId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const fetchPost = async () => {
    try {
      const res = await fetch(`${API}/api/posts/${postId}`);
      if (!res.ok) throw new Error("Post not found");
      const data = await res.json();
      setPost(data);
    } catch (err: any) {
      setError(err.message || "Failed to load post");
    } finally {
      setLoading(false);
    }
  };

  const isOwner = currentUser?._id === post?.user?._id;

  const handleDelete = async () => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    setMenuOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      navigate("/profile", { replace: true });
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not delete post. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getImageUrl = () => {
    if (!post?.imageUrl) return "";
    if (post.imageUrl.startsWith("http")) return post.imageUrl;
    return `${API}${post.imageUrl}`;
  };

  const getProfilePictureUrl = () => {
    if (!post?.user) return `https://i.pravatar.cc/150?u=user`;
    if (post.user.profilePicture?.startsWith("http")) return post.user.profilePicture;
    if (post.user.profilePicture) return `${API}${post.user.profilePicture}`;
    return `https://i.pravatar.cc/150?u=${post.user.username}`;
  };

  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return "just now";
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const handleLike = () => {
    setLiked(!liked);
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setComment("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">{error || "Post not found"}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-white hover:text-gray-300 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <h1 className="text-white font-semibold">Post</h1>
          <div className="w-6" />
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-16 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-[1.5fr,1fr] gap-0 bg-black md:h-[calc(100vh-5rem)]">
            {/* Image */}
            <div className="bg-black flex items-center justify-center">
              <img
                src={getImageUrl()}
                alt={post.caption || "Post"}
                className="max-h-[calc(100vh-5rem)] w-full object-contain"
              />
            </div>

            {/* Details */}
            <div className="bg-white flex flex-col h-full md:h-[calc(100vh-5rem)]">
              {/* Post Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  <img
                    src={getProfilePictureUrl()}
                    alt={post.user?.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-sm">{post.user?.username || "Unknown User"}</p>
                    <p className="text-xs text-gray-500">{getTimeAgo(post.createdAt)}</p>
                  </div>
                </div>

                {/* 3-dots menu — only rendered for post owner */}
                {isOwner && (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 top-10 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          {deleting ? "Deleting..." : "Delete post"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="flex-1 overflow-y-auto p-4">
                {post.caption && (
                  <div className="flex gap-3 mb-4">
                    <img src={getProfilePictureUrl()} alt={post.user?.username} className="w-8 h-8 rounded-full object-cover" />
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-semibold mr-2">{post.user?.username}</span>
                        {post.caption}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{getTimeAgo(post.createdAt)}</p>
                    </div>
                  </div>
                )}

                {post.comments && post.comments.length > 0 ? (
                  post.comments.map((c: any, idx: number) => (
                    <div key={idx} className="flex gap-3 mb-4">
                      <img src={`https://i.pravatar.cc/150?u=${c.user?.username}`} alt={c.user?.username} className="w-8 h-8 rounded-full object-cover" />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-semibold mr-2">{c.user?.username || "User"}</span>
                          {c.text}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{getTimeAgo(c.createdAt)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No comments yet</p>
                    <p className="text-gray-400 text-xs mt-1">Be the first to comment!</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t">
                <div className="flex items-center justify-between p-4">
                  <div className="flex gap-4">
                    <button onClick={handleLike} className={`transition-colors ${liked ? "text-red-500" : "hover:text-gray-600"}`}>
                      <Heart className={`w-6 h-6 ${liked ? "fill-current" : ""}`} />
                    </button>
                    <button className="hover:text-gray-600 transition-colors">
                      <MessageCircle className="w-6 h-6" />
                    </button>
                    <button className="hover:text-gray-600 transition-colors">
                      <Send className="w-6 h-6" />
                    </button>
                  </div>
                  <button onClick={() => setSaved(!saved)} className={`transition-colors ${saved ? "text-black" : "hover:text-gray-600"}`}>
                    <Bookmark className={`w-6 h-6 ${saved ? "fill-current" : ""}`} />
                  </button>
                </div>

                <div className="px-4 pb-2">
                  <p className="font-semibold text-sm">
                    {post.likes?.length || 0} {post.likes?.length === 1 ? "like" : "likes"}
                  </p>
                </div>

                <form onSubmit={handleComment} className="border-t p-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 outline-none text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!comment.trim()}
                      className={`font-semibold text-sm ${comment.trim() ? "text-blue-500 hover:text-blue-700" : "text-blue-300 cursor-not-allowed"}`}
                    >
                      Post
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}