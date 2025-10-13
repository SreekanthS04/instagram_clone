import { Notification } from '../../types';

interface NotificationItemProps {
  notification: Notification;
}

export default function NotificationItem({ notification }: NotificationItemProps) {
  return (
    <div className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
      <img
        src={notification.user.profilePicture}
        alt={notification.user.username}
        className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-200"
      />

      <div className="flex-1">
        <p className="text-gray-900">
          <span className="font-semibold">{notification.user.username}</span>{' '}
          <span className="text-gray-700">{notification.message}</span>
        </p>
        <p className="text-sm text-gray-500">{notification.timestamp}</p>
      </div>

      {notification.postImage && (
        <img
          src={notification.postImage}
          alt="Post"
          className="w-12 h-12 object-cover rounded"
        />
      )}

      {notification.type === 'follow' && (
        <button className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-teal-600 text-white rounded-lg font-medium text-sm hover:from-purple-700 hover:to-teal-700 transition-all">
          Follow Back
        </button>
      )}
    </div>
  );
}
