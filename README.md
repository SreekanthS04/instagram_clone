# InstaCheck — AI-Powered Content Detection Platform

A social media platform inspired by Instagram where users can upload images, videos, and text posts. Every piece of content is automatically analyzed using AI to detect whether it is AI-generated (for images/videos) or factually accurate (for text posts).

---

## Features

- User registration and login with JWT authentication
- Upload images, videos, and text posts
- Automatic AI-generated content detection for images and videos
- Automatic fact-checking for text posts
- Like and comment on posts
- Follow and unfollow users
- View reels (short videos)
- Search for users

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| Tailwind CSS | Styling |
| React Router DOM | Page navigation |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express 5 | Web framework |
| MongoDB Atlas | Cloud database |
| Mongoose | MongoDB ODM |
| JWT | Authentication |
| bcryptjs | Password hashing |

### AI Modules (Python)
| Technology | Purpose |
|---|---|
| PyTorch | Deep learning framework |
| HuggingFace Transformers | Pre-trained detection models |
| OpenCV | Image/video processing |
| NumPy | Numerical operations |

---

## AI Detection System

### Image Detection
Every uploaded image is analyzed by an ensemble of 3 pre-trained AI models:
- **dima806-ViT** — Vision Transformer, weighted 3x (most trusted)
- **Organika SDXL Detector** — Specialized for Stable Diffusion images
- **umm-maybe General Detector** — Broad AI image detector

The system first classifies the image as `anime`, `photo`, or `general` using pixel-level analysis (edge density, saturation, color diversity, noise level) and applies type-specific heuristic rules alongside the models. All scores are combined using a weighted average. Score above 0.5 → flagged as AI generated.

### Video Detection
Videos are analyzed in two stages:
1. **Frame Analysis (80% weight)** — 20 evenly spaced frames are extracted and each frame is passed through the full image detection pipeline
2. **Temporal Analysis (20% weight)** — Optical flow (Farneback method) checks for unnatural or inconsistent motion between frames

Final score = `(image_score × 0.80) + (temporal_score × 0.20)`

---

## Project Structure

```
instagram_clone/
├── backend/
│   ├── AI_modules/
│   │   ├── image.py
│   │   ├── detect_wrapper.py
│   │   ├── video.py
│   │   ├── video_image.py
│   │   ├── video_detect_wrapper.py
│   │   ├── text.py
│   │   ├── text_fact_check_wrapper.py
│   │   ├── claimextractor.py
│   │   ├── verify_paragraph.py
│   │   ├── watermark.py
│   │   └── run_eval.py
│   ├── models/
│   │   ├── User.js
│   │   └── Post.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── posts.js
│   └── server.js
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   ├── Post/
│   │   ├── Reel/
│   │   ├── Profile/
│   │   └── Notification/
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Notifications.tsx
│   │   ├── PostDetail.tsx
│   │   ├── Profile.tsx
│   │   ├── Reels.tsx
│   │   ├── Search.tsx
│   │   ├── Upload.tsx
│   │   └── UserProfile.tsx
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── index.html
└── vite.config.ts
```

## Getting Started

### Prerequisites
- Node.js >= 18
- Python >= 3.8
- MongoDB Atlas account

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/SreekanthS04/instagram_clone.git
cd instagram_clone
```

**2. Install frontend dependencies**
```bash
npm install
```

**3. Install backend dependencies**
```bash
cd backend
npm install
```

**4. Install Python dependencies**
```bash
pip install torch transformers opencv-python pillow numpy
```

**5. Set up environment variables**

Create `backend/.env`:
```env
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_jwt_secret
GOOGLE_API_KEY=your_google_api_key
PORT=5000
```

Create `.env` in root:
```env
VITE_API_URL=http://localhost:5000
```

**6. Run the backend**
```bash
cd backend
npm run dev
```

**7. Run the frontend**
```bash
npm run dev
```

---

## Environment Variables

| Variable | Location | Purpose |
|---|---|---|
| MONGO_URI | backend/.env | MongoDB Atlas connection string |
| JWT_SECRET | backend/.env | JWT signing secret |
| GOOGLE_API_KEY | backend/.env | Google API for fact checking |
| PORT | backend/.env | Backend server port |
| VITE_API_URL | root .env | Frontend API base URL |

---

## Database

**MongoDB Atlas (Cloud)**
Two collections:
- **users** — stores username, email, hashed password, profile info, followers, following
- **posts** — stores content URLs, post type, AI detection results, fact-check results, likes, comments

---

## License
MIT
