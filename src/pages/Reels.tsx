import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import ReelCard from "../components/Reel/ReelCard";

const API = import.meta.env.VITE_API_URL as string;

export default function Reels() {
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get("id");
  const reelRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    fetchReels();
  }, []);

  // Scroll to target reel when navigated from Profile
  useEffect(() => {
    if (!targetId || reels.length === 0) return;
    const timer = setTimeout(() => {
      const el = reelRefs.current.get(targetId);
      if (el) el.scrollIntoView({ behavior: "instant" });
    }, 100);
    return () => clearTimeout(timer);
  }, [reels, targetId]);

  const fetchReels = async () => {
    try {
      const res = await fetch(`${API}/api/posts?type=reel`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-cache",
      });
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setReels(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching reels:", err);
    } finally {
      setLoading(false);
    }
  };

  // Remove deleted reel from local state immediately
  const handleReelDeleted = (deletedId: string) => {
    setReels((prev) => prev.filter((r) => (r.id || r._id) !== deletedId));
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading reels...</p>
        </div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-xl mb-2">No reels yet</p>
          <p className="text-gray-400 text-sm">Upload a video to see it here!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-hide">
      {reels.map((reel) => {
        const id = reel.id || reel._id;
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) reelRefs.current.set(id, el);
              else reelRefs.current.delete(id);
            }}
          >
            <ReelCard reel={reel} onDelete={handleReelDeleted} />
          </div>
        );
      })}
    </div>
  );
}