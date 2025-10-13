// src/components/Post/PostCard.tsx
import React from "react";

const API = import.meta.env.VITE_API_URL as string;

export default function PostCard({ post }: { post: any }) {
  const src =
    post.imageUrl && post.imageUrl.startsWith("http")
      ? post.imageUrl
      : post.imageUrl
      ? `${API}${post.imageUrl}`
      : "";

  const username = post.user?.username ?? "unknown";
  const avatar =
    post.user?.profilePicture && post.user.profilePicture.startsWith("http")
      ? post.user.profilePicture
      : post.user?.profilePicture
      ? `${API}${post.user.profilePicture}`
      : "/default-avatar.png";

  return (
    <article className="bg-white rounded-lg shadow overflow-hidden">
      <header className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
          <img src={avatar} alt={username} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="font-semibold">{username}</div>
          <div className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString()}</div>
        </div>
      </header>

      {src && <img src={src} alt="post" className="w-full object-cover max-h-[600px]" />}

      <div className="p-3">
        <p className="text-gray-900">
          <span className="font-semibold mr-2">{username}</span>
          {post.caption}
        </p>

        {post.comments > 0 && (
          <button className="text-gray-500 text-sm mt-2 hover:text-gray-700">
            View all {post.comments} comments
          </button>
        )}
      </div>
    </article>
  );
}
