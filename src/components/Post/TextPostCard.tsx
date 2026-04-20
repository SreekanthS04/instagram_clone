import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Trash2, AlertTriangle, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL as string;

interface TextPostCardProps {
  post: {
    id?: string;
    _id?: string;
    user: {
      _id: string;
      username: string;
      profilePicture?: string;
      fullName?: string;
    };
    textContent: string;
    likes?: any[];
    comments?: any[];
    shares?: number;
    createdAt?: string;
    factCheck?: {
      isVerified: boolean;
      verdict: string;
      confidence: string;
      supportingSources?: any[];
      contradictingSources?: any[];
      checkedDate?: string;
    };
  };
  onDelete?: (postId: string) => void;
}

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

export default function TextPostCard({ post, onDelete }: TextPostCardProps) {
  const currentUser = getCurrentUser();
  const postId = post.id || post._id;
  const isOwner = currentUser?._id === post.user?._id;

  const [likes, setLikes] = useState<string[]>(
    (post.likes || []).map((l: any) => (typeof l === "string" ? l : l._id || l.toString()))
  );
  const [liked, setLiked] = useState(
    currentUser ? likes.includes(currentUser._id) : false
  );
  const [likeLoading, setLikeLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    const newLikes = (post.likes || []).map((l: any) =>
      typeof l === "string" ? l : l._id || l.toString()
    );
    setLikes(newLikes);
    setLiked(currentUser ? newLikes.includes(currentUser._id) : false);
  }, [post.likes]);

  const getProfilePictureUrl = () => {
    if (post.user?.profilePicture?.startsWith("http")) return post.user.profilePicture;
    if (post.user?.profilePicture) return `${API}${post.user.profilePicture}`;
    return `https://i.pravatar.cc/150?u=${post.user?.username || "user"}`;
  };

  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return "just now";
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const handleLike = async () => {
    if (!currentUser || likeLoading) return;
    const nowLiked = !liked;
    setLiked(nowLiked);
    setLikes((prev) =>
      nowLiked ? [...prev, currentUser._id] : prev.filter((id) => id !== currentUser._id)
    );
    try {
      setLikeLoading(true);
      const res = await fetch(`${API}/api/posts/${postId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const serverLikes = (data.likes || []).map((l: any) =>
        typeof l === "string" ? l : l._id || l.toString()
      );
      setLikes(serverLikes);
      setLiked(serverLikes.includes(currentUser._id));
    } catch {
      setLiked(!nowLiked);
      setLikes((prev) =>
        !nowLiked ? [...prev, currentUser._id] : prev.filter((id) => id !== currentUser._id)
      );
    } finally {
      setLikeLoading(false);
    }
  };

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
      onDelete?.(postId!);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not delete post. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getVerdictColor = (verdict: string) => {
    if (verdict.includes("TRUE")) return "bg-green-500";
    if (verdict.includes("FALSE")) return "bg-red-500";
    if (verdict.includes("DISPUTED")) return "bg-yellow-500";
    return "bg-gray-500";
  };

  const getVerdictIcon = (verdict: string) => {
    if (verdict.includes("TRUE")) return <CheckCircle className="w-5 h-5" />;
    if (verdict.includes("FALSE")) return <XCircle className="w-5 h-5" />;
    if (verdict.includes("DISPUTED")) return <AlertTriangle className="w-5 h-5" />;
    return <HelpCircle className="w-5 h-5" />;
  };

  const getVerdictText = (verdict: string) => {
    if (verdict === "LIKELY TRUE") return "Likely True";
    if (verdict === "LIKELY FALSE") return "Likely False";
    if (verdict === "DISPUTED") return "Disputed";
    if (verdict === "UNVERIFIABLE") return "Cannot Verify";
    return verdict;
  };

  const factCheck = post.factCheck;
  const hasFactCheck = factCheck && factCheck.verdict !== "PENDING";

  return (
    <div className="bg-white border rounded-lg mb-6">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center">
          <img
            src={getProfilePictureUrl()}
            alt={post.user?.username || "User"}
            className="w-8 h-8 rounded-full object-cover mr-3"
            onError={(e) => {
              e.currentTarget.src = `https://i.pravatar.cc/150?u=${post.user?.username || "user"}`;
            }}
          />
          <div>
            <p className="font-semibold text-sm">{post.user?.username || "Unknown User"}</p>
            <p className="text-xs text-gray-500">{getTimeAgo(post.createdAt)}</p>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
              {isOwner ? (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? "Deleting..." : "Delete post"}
                </button>
              ) : (
                <div className="px-4 py-3 text-gray-400 text-sm text-center">No options</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fact-Check Badge */}
      {hasFactCheck && (
        <div className="mx-3 mb-3">
          <div className={`${getVerdictColor(factCheck.verdict)} text-white rounded-lg p-3 shadow-lg`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getVerdictIcon(factCheck.verdict)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-sm">Fact Check: {getVerdictText(factCheck.verdict)}</p>
                  {factCheck.confidence && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      {factCheck.confidence}
                    </span>
                  )}
                </div>
                
                {(factCheck.supportingSources && factCheck.supportingSources.length > 0) || 
                 (factCheck.contradictingSources && factCheck.contradictingSources.length > 0) ? (
                  <button
                    onClick={() => setShowSources(!showSources)}
                    className="text-xs underline hover:no-underline mt-1"
                  >
                    {showSources ? "Hide sources" : `View ${
                      (factCheck.supportingSources?.length || 0) + (factCheck.contradictingSources?.length || 0)
                    } sources`}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Sources Dropdown */}
            {showSources && (
              <div className="mt-3 pt-3 border-t border-white/20">
                {factCheck.supportingSources && factCheck.supportingSources.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Supporting Sources ({factCheck.supportingSources.length})
                    </p>
                    {factCheck.supportingSources.map((source: any, idx: number) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs bg-white/10 hover:bg-white/20 rounded p-2 mb-1 transition-colors"
                      >
                        <p className="font-medium truncate">{source.title}</p>
                        <p className="text-white/80 text-[10px]">{source.domain}</p>
                      </a>
                    ))}
                  </div>
                )}

                {factCheck.contradictingSources && factCheck.contradictingSources.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Contradicting Sources ({factCheck.contradictingSources.length})
                    </p>
                    {factCheck.contradictingSources.map((source: any, idx: number) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs bg-white/10 hover:bg-white/20 rounded p-2 mb-1 transition-colors"
                      >
                        <p className="font-medium truncate">{source.title}</p>
                        <p className="text-white/80 text-[10px]">{source.domain}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text Content */}
      <div className="px-3 pb-3">
        <div className="bg-gradient-to-br from-purple-50 to-teal-50 rounded-lg p-4 border border-purple-100">
          <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
            {post.textContent}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-4">
            <button
              onClick={handleLike}
              disabled={likeLoading}
              className={`transition-colors ${liked ? "text-red-500" : "hover:text-gray-600"} ${likeLoading ? "opacity-50" : ""}`}
            >
              <Heart className={liked ? "fill-current" : ""} />
            </button>
            <button className="hover:text-gray-600 transition-colors">
              <MessageCircle />
            </button>
            <button className="hover:text-gray-600 transition-colors">
              <Send />
            </button>
          </div>
          <button
            onClick={() => setSaved(!saved)}
            className={`transition-colors ${saved ? "text-black" : "hover:text-gray-600"}`}
          >
            <Bookmark className={saved ? "fill-current" : ""} />
          </button>
        </div>

        {likes.length > 0 && (
          <p className="font-semibold text-sm mb-2">
            {likes.length} {likes.length === 1 ? "like" : "likes"}
          </p>
        )}

        {post.comments && post.comments.length > 0 && (
          <button className="text-sm text-gray-500 mt-2">
            View all {post.comments.length} comments
          </button>
        )}
      </div>
    </div>
  );
}