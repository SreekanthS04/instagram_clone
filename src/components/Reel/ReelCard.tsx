import { useState, useRef, useEffect } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreVertical, Volume2, VolumeX, Play, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL as string;

interface ReelCardProps {
  reel: {
    id?: string;
    _id?: string;
    user: {
      _id: string;
      username: string;
      profilePicture?: string;
      fullName?: string;
    };
    caption?: string;
    videoUrl: string;
    likes?: any[];
    comments?: any[];
    shares?: number;
    createdAt?: string;
    aiDetection?: {
      isAIGenerated: boolean;
      confidence: number;
      detectionDate?: string;
    };
  };
  onDelete?: (reelId: string) => void;
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

export default function ReelCard({ reel, onDelete }: ReelCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const currentUser = getCurrentUser();
  const reelId = reel.id || reel._id;
  const isOwner = currentUser?._id === reel.user?._id;

  const [likes, setLikes] = useState<string[]>(
    (reel.likes || []).map((l: any) => (typeof l === "string" ? l : l._id || l.toString()))
  );
  const [liked, setLiked] = useState(
    currentUser ? likes.includes(currentUser._id) : false
  );
  const [likeLoading, setLikeLoading] = useState(false);

  // Auto-play when scrolled into view
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.6 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

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

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
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
      const res = await fetch(`${API}/api/posts/${reelId}/like`, {
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
    if (!window.confirm("Delete this reel? This cannot be undone.")) return;
    setMenuOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/posts/${reelId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      onDelete?.(reelId!);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not delete reel. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getVideoUrl = () => {
    if (!reel.videoUrl) return "";
    if (reel.videoUrl.startsWith("http")) return reel.videoUrl;
    return `${API}${reel.videoUrl}`;
  };

  const getProfilePictureUrl = () => {
    if (reel.user?.profilePicture?.startsWith("http")) return reel.user.profilePicture;
    if (reel.user?.profilePicture) return `${API}${reel.user.profilePicture}`;
    return `https://i.pravatar.cc/150?u=${reel.user?.username || "user"}`;
  };

  const isAI = reel.aiDetection?.isAIGenerated === true;
  const aiConfidence = reel.aiDetection?.confidence ?? 0;

  return (
    <div className="h-screen w-full snap-start snap-always relative bg-black flex items-center justify-center">
      {/* Video */}
      <video
        ref={videoRef}
        src={getVideoUrl()}
        loop
        playsInline
        muted={isMuted}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
        onError={() => console.error("Video failed to load:", getVideoUrl())}
      />

      {/* AI Badge */}
      {isAI && (
        <div className="absolute top-4 right-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-2 rounded-lg shadow-2xl backdrop-blur-sm bg-opacity-90 z-20 flex flex-col leading-tight">
          <span className="font-bold text-sm">AI Generated</span>
          <span className="text-xs opacity-90">{Math.round(aiConfidence * 100)}% confidence</span>
        </div>
      )}

      {/* Play/Pause overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black bg-opacity-50 rounded-full p-6">
            <Play className="w-16 h-16 text-white" />
          </div>
        </div>
      )}

      {/* Gradients */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* User Info — Bottom Left */}
      <div className="absolute bottom-20 left-4 right-20 z-10">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={getProfilePictureUrl()}
            alt={reel.user?.username}
            className="w-10 h-10 rounded-full object-cover border-2 border-white cursor-pointer"
            onClick={() => navigate(`/user/${reel.user._id}`)}
            onError={(e) => {
              e.currentTarget.src = `https://i.pravatar.cc/150?u=${reel.user?.username}`;
            }}
          />
          <p
            className="font-semibold text-white text-sm cursor-pointer"
            onClick={() => navigate(`/user/${reel.user._id}`)}
          >
            {reel.user?.username || "Unknown User"}
          </p>
        </div>
        {reel.caption && (
          <p className="text-white text-sm mb-2 line-clamp-2">{reel.caption}</p>
        )}
      </div>

      {/* Actions — Bottom Right */}
      <div className="absolute bottom-20 right-4 flex flex-col gap-6 z-10">
        {/* Like */}
        <button
          onClick={handleLike}
          disabled={likeLoading}
          className={`flex flex-col items-center gap-1 ${likeLoading ? "opacity-50" : ""}`}
        >
          <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition-colors">
            <Heart className={`w-7 h-7 ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
          </div>
          <span className="text-white text-xs font-semibold">{likes.length}</span>
        </button>

        {/* Comment */}
        <button className="flex flex-col items-center gap-1">
          <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition-colors">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs font-semibold">{reel.comments?.length || 0}</span>
        </button>

        {/* Share */}
        <button className="flex flex-col items-center gap-1">
          <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition-colors">
            <Send className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs font-semibold">{reel.shares || 0}</span>
        </button>

        {/* Save */}
        <button onClick={() => setSaved(!saved)} className="flex flex-col items-center gap-1">
          <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition-colors">
            <Bookmark className={`w-7 h-7 ${saved ? "fill-white" : ""} text-white`} />
          </div>
        </button>

        {/* More — with delete dropdown */}
        <div className="relative flex flex-col items-center gap-1" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col items-center gap-1"
          >
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full hover:bg-white/30 transition-colors">
              <MoreVertical className="w-7 h-7 text-white" />
            </div>
          </button>

          {menuOpen && (
            <div className="absolute bottom-14 right-0 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
              {isOwner ? (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? "Deleting..." : "Delete reel"}
                </button>
              ) : (
                <div className="px-4 py-3 text-gray-400 text-sm text-center">
                  No options
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mute toggle */}
      <button
        onClick={toggleMute}
        className="absolute bottom-6 left-4 bg-white/20 backdrop-blur-sm p-2 rounded-full hover:bg-white/30 transition-colors z-10"
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>
    </div>
  );
}