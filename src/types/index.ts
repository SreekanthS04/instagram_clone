export interface User {
  id: string;
  username: string;
  fullName: string;
  profilePicture: string;
  bio: string;
  followers: number;
  following: number;
  posts: number;
  isFollowing?: boolean;
}

export interface Post {
  id: string;
  user: User;
  imageUrl: string;
  caption: string;
  likes: number;
  comments: number;
  timestamp: string;
  isLiked?: boolean;
}

export interface Reel {
  id: string;
  user: User;
  videoUrl: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  timestamp: string;
  isLiked?: boolean;
}

export interface Notification {
  id: string;
  user: User;
  type: 'like' | 'comment' | 'follow';
  message: string;
  timestamp: string;
  postImage?: string;
}
