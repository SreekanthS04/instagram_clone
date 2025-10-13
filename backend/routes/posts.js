// backend/routes/posts.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import Post from "../models/post.js";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "secret123";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../uploads");

const sign = (token) => token; // placeholder (not used here)

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// CREATE POST
router.post("/", verifyToken, async (req, res) => {
  try {
    const { caption, image } = req.body;
    if (!image) return res.status(400).json({ message: "Image required" });

    const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ message: "Invalid image format" });

    const ext = matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, "base64");
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, buffer);

    // Build absolute URL for image
    const host = process.env.APP_HOST || `http://localhost:${process.env.PORT || 5000}`;
    const imageUrl = `${host}/uploads/${filename}`;

    const newPost = new Post({
      userId: req.userId,
      caption,
      imageUrl, // now absolute
    });

    await newPost.save();

    // Increment user's post count
    await User.findByIdAndUpdate(req.userId, { $inc: { posts: 1 } });

    // populate author info
    const populated = await Post.findById(newPost._id).populate("userId", "username profilePicture");

    res.status(201).json({
      id: populated._id,
      user: populated.userId,
      caption: populated.caption,
      imageUrl: populated.imageUrl,
      likes: populated.likes,
      comments: populated.comments,
      shares: populated.shares,
      createdAt: populated.createdAt,
    });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET POSTS: supports optional ?userId=<id> to fetch a user's posts
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePicture");

    const shaped = posts.map((p) => ({
      id: p._id,
      user: p.userId,
      caption: p.caption,
      imageUrl: p.imageUrl,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      createdAt: p.createdAt,
    }));
    res.json(shaped);
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
