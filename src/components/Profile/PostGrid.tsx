import { Heart, MessageCircle } from 'lucide-react';
import { Post } from '../../types';

interface PostGridProps {
  posts: Post[];
}

export default function PostGrid({ posts }: PostGridProps) {
  return (
    <div className="grid grid-cols-3 gap-1 md:gap-4">
      {posts.map((post) => (
        <div
          key={post.id}
          className="relative aspect-square group cursor-pointer overflow-hidden"
        >
          <img
            src={post.imageUrl}
            alt="Post"
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-white">
              <Heart className="w-6 h-6 fill-white" />
              <span className="font-semibold">{post.likes}</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <MessageCircle className="w-6 h-6 fill-white" />
              <span className="font-semibold">{post.comments}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
