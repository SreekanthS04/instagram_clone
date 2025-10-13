import NotificationItem from '../components/Notification/NotificationItem';
import { mockNotifications } from '../data/mockData';

export default function Notifications() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-6 pt-6">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Notifications</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {mockNotifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
