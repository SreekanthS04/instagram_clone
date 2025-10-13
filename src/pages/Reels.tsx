import ReelCard from '../components/Reel/ReelCard';
import { mockReels } from '../data/mockData';

export default function Reels() {
  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory bg-black">
      {mockReels.map((reel) => (
        <ReelCard key={reel.id} reel={reel} />
      ))}
    </div>
  );
}
