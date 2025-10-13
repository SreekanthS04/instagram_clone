import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Layout/Navigation';
import Login from './pages/Login';
import Home from './pages/Home';
import Reels from './pages/Reels';
import Profile from './pages/Profile';
import Upload from './pages/Upload';
import Search from './pages/Search';
import Notifications from './pages/Notifications';

function App() {
  const isAuthenticated = true;

  return (
    <BrowserRouter>
      {isAuthenticated ? (
        <div className="md:pl-64">
          <Navigation />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/reels" element={<Reels />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/search" element={<Search />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
