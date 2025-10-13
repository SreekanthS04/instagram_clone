import { useState } from 'react';
import { Heart, MessageCircle, Send, MoreHorizontal } from 'lucide-react';
import { Reel } from '../../types';

interface ReelCardProps {
  reel: Reel;
}

export default function ReelCard({ reel }: ReelCardProps) {
  const [isLiked, setIsLiked] = useState(reel.isLiked || false);
  const [likes, setLikes] = useState(reel.likes);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
  };

  return (
    <div className="relative h-screen w-full snap-start snap-always">
      <img
        src={reel.videoUrl}
        alt="Reel"
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />

      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
        <div className="flex items-end justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={reel.user.profilePicture}
                alt={reel.user.username}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white"
              />
              <div>
                <p className="font-semibold text-white">{reel.user.username}</p>
                <p className="text-sm text-white/90">{reel.timestamp}</p>
              </div>
              <button className="ml-2 px-6 py-1.5 border-2 border-white rounded-full font-semibold text-sm hover:bg-white hover:text-purple-600 transition-all">
                Follow
              </button>
            </div>
            <p className="text-white mb-2">{reel.caption}</p>
          </div>

          <div className="flex flex-col items-center gap-6 ml-4">
            <button
              onClick={handleLike}
              className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
            >
              <Heart
                className={`w-8 h-8 ${
                  isLiked ? 'fill-red-500 text-red-500' : 'text-white'
                }`}
              />
              <span className="text-sm font-semibold">{likes.toLocaleString()}</span>
            </button>

            <button className="flex flex-col items-center gap-1 transition-transform hover:scale-110">
              <MessageCircle className="w-8 h-8 text-white" />
              <span className="text-sm font-semibold">{reel.comments}</span>
            </button>

            <button className="flex flex-col items-center gap-1 transition-transform hover:scale-110">
              <Send className="w-8 h-8 text-white" />
              <span className="text-sm font-semibold">{reel.shares}</span>
            </button>

            <button className="transition-transform hover:scale-110">
              <MoreHorizontal className="w-8 h-8 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
