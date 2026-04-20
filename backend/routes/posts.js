import dotenv from "dotenv";
dotenv.config();

import express from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { spawn } from "child_process";
import Post from "../models/Post.js";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../uploads");
const aiModulesDir = path.join(__dirname, "../AI_modules");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ================= PYTHON PATH =================
const getPythonPath = () => {
  if (process.platform === 'win32') {
    const winPath = 'C:\\Users\\HP\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';
    if (fs.existsSync(winPath)) return winPath;
  }
  return 'python';
};

// ================= JWT =================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    console.error('Token verification error:', err.name);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ================= IMAGE AI DETECTION =================
const detectAIImage = (imagePath) => {
  return new Promise((resolve) => {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║         🤖 IMAGE AI DETECTION                ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log(`📁 Image : ${imagePath}`);

    const pythonScript = path.join(aiModulesDir, "detect_wrapper.py");

    if (!fs.existsSync(pythonScript)) {
      console.error(`❌ detect_wrapper.py NOT FOUND`);
      return resolve({ success: false, is_ai: false, confidence: 0 });
    }

    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Image NOT FOUND`);
      return resolve({ success: false, is_ai: false, confidence: 0 });
    }

    console.log("✅ Running detection...\n");

    const pythonExe = getPythonPath();
    const pythonProcess = spawn(pythonExe, [pythonScript, imagePath], {
      cwd: aiModulesDir,
      shell: true,
      windowsHide: true
    });

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('error', (err) => {
      console.error("❌ SPAWN ERROR:", err.message);
      resolve({ success: false, is_ai: false, confidence: 0 });
    });

    let resolved = false;
    pythonProcess.on('close', (code) => {
      if (resolved) return;
      resolved = true;

      if (code !== 0) {
        console.error("❌ Detection failed");
        return resolve({ success: false, is_ai: false, confidence: 0 });
      }

      try {
        const lines = outputData.trim().split('\n').filter(l => l.trim());
        const jsonLine = lines[lines.length - 1];
        const result = JSON.parse(jsonLine);

        console.log("╔══════════════════════════════════════════════╗");
        console.log(`║  AI Generated : ${result.is_ai ? '🤖 YES' : '✅ NO'}`);
        console.log(`║  Confidence   : ${(result.confidence * 100).toFixed(1)}%`);
        console.log("╚══════════════════════════════════════════════╝\n");

        resolve(result);
      } catch (err) {
        console.error("❌ JSON parse failed");
        resolve({ success: false, is_ai: false, confidence: 0 });
      }
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        pythonProcess.kill();
        console.error("⏱️ TIMEOUT");
        resolve({ success: false, is_ai: false, confidence: 0 });
      }
    }, 180000);

    pythonProcess.on('close', () => clearTimeout(timer));
  });
};

// ================= VIDEO AI DETECTION =================
const detectAIVideo = (videoPath) => {
  return new Promise((resolve) => {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║         🎥 VIDEO AI DETECTION                ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log(`📁 Video : ${videoPath}`);

    const pythonScript = path.join(aiModulesDir, "video_detect_wrapper.py");

    if (!fs.existsSync(pythonScript)) {
      console.error(`❌ video_detect_wrapper.py NOT FOUND`);
      return resolve({ success: false, is_ai: false, confidence: 0 });
    }

    if (!fs.existsSync(videoPath)) {
      console.error(`❌ Video NOT FOUND`);
      return resolve({ success: false, is_ai: false, confidence: 0 });
    }

    console.log("✅ Running video detection (30-60 seconds)...\n");

    const pythonExe = getPythonPath();
    const pythonProcess = spawn(pythonExe, [pythonScript, videoPath], {
      cwd: aiModulesDir,
      shell: true,
      windowsHide: true
    });

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('error', (err) => {
      console.error("❌ SPAWN ERROR:", err.message);
      resolve({ success: false, is_ai: false, confidence: 0 });
    });

    let resolved = false;
    pythonProcess.on('close', (code) => {
      if (resolved) return;
      resolved = true;

      if (code !== 0) {
        console.error("❌ Video detection failed");
        return resolve({ success: false, is_ai: false, confidence: 0 });
      }

      try {
        const lines = outputData.trim().split('\n').filter(l => l.trim());
        const jsonLine = lines[lines.length - 1];
        const result = JSON.parse(jsonLine);

        console.log("╔══════════════════════════════════════════════╗");
        console.log(`║  AI Generated : ${result.is_ai ? '🤖 YES' : '✅ NO'}`);
        console.log(`║  Confidence   : ${(result.confidence * 100).toFixed(1)}%`);
        console.log("╚══════════════════════════════════════════════╝\n");

        resolve(result);
      } catch (err) {
        console.error("❌ JSON parse failed");
        resolve({ success: false, is_ai: false, confidence: 0 });
      }
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        pythonProcess.kill();
        console.error("⏱️ VIDEO DETECTION TIMEOUT (5 min)");
        resolve({ success: false, is_ai: false, confidence: 0 });
      }
    }, 300000);

    pythonProcess.on('close', () => clearTimeout(timer));
  });
};

// ================= TEXT FACT-CHECKING =================
const factCheckText = (text) => {
  return new Promise((resolve) => {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║         📝 TEXT FACT-CHECKING                ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log(`📄 Text: ${text.substring(0, 50)}...`);
    

    const pythonScript = path.join(aiModulesDir, "text_fact_check_wrapper.py");

    if (!fs.existsSync(pythonScript)) {
      console.error(`❌ text_fact_check_wrapper.py NOT FOUND`);
      return resolve({ success: false, verdict: "UNVERIFIABLE", confidence: "Script not found" });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      console.error("❌ Google API credentials not configured");
      return resolve({ success: false, verdict: "UNVERIFIABLE", confidence: "API not configured" });
    }

    console.log("✅ Running fact check (this may take 30-60 seconds)...\n");

    console.log("API KEY:", apiKey ? "found" : "MISSING");
    console.log("SEARCH ID:", searchEngineId ? "found" : "MISSING");
    console.log("API KEY VALUE:", `'${apiKey}'`);
    console.log("SEARCH ID VALUE:", `'${searchEngineId}'`);


    // Write text to temp file to avoid argument parsing issues
const tempTextFile = path.join(aiModulesDir, `claim-${Date.now()}.txt`);
fs.writeFileSync(tempTextFile, text, 'utf8');

    const pythonExe = getPythonPath();
    const pythonProcess = spawn(pythonExe, [pythonScript, tempTextFile, apiKey, searchEngineId], {
      cwd: aiModulesDir,
      shell: true,
      windowsHide: true
    });

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('error', (err) => {
      console.error("❌ SPAWN ERROR:", err.message);
      resolve({ success: false, verdict: "UNVERIFIABLE", confidence: "Process error" });
    });

    let resolved = false;
    pythonProcess.on('close', (code) => {
      if (resolved) return;
      resolved = true;

      if (code !== 0) {
        console.error("❌ Fact check failed");
        console.error("🐍 stderr:", errorData || "(empty)");
        console.error("🐍 stdout:", outputData || "(empty)");
        return resolve({ success: false, verdict: "UNVERIFIABLE", confidence: "Check failed" });
      }

      try {
        const lines = outputData.trim().split('\n').filter(l => l.trim());
        const jsonLine = lines[lines.length - 1];
        const result = JSON.parse(jsonLine);

        console.log("╔══════════════════════════════════════════════╗");
        console.log(`║  Verdict     : ${result.verdict}`);
        console.log(`║  Confidence  : ${result.confidence}`);
        console.log(`║  Sources     : ${result.total_sources || 0}`);
        console.log("╚══════════════════════════════════════════════╝\n");

        resolve(result);
      } catch (err) {
        console.error("❌ JSON parse failed");
        resolve({ success: false, verdict: "UNVERIFIABLE", confidence: "Parse error" });
      }
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        pythonProcess.kill();
        console.error("FACT CHECK TIMEOUT (5 min)");
        resolve({ success: false, verdict: "UNVERIFIABLE", confidence: "Timeout", timeout: true });
      }
    }, 300000);

    pythonProcess.on('close', () => clearTimeout(timer));
    pythonProcess.stderr.on('data', (data) => {
    errorData += data.toString();
    console.log("🐍 text.py output:", data.toString());
  });
    console.error("🐍 Full stdout:", outputData);
  });
};

// ================= IMAGE WATERMARK =================
const addImageWatermark = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(aiModulesDir, "watermark.py");

    console.log("\n🎨 Adding AI watermark to image...");

    if (!fs.existsSync(pythonScript)) {
      console.error(`❌ watermark.py NOT FOUND`);
      return reject(new Error("watermark.py not found"));
    }

    const pythonExe = getPythonPath();
    const pythonProcess = spawn(pythonExe, [pythonScript, inputPath, outputPath], {
      cwd: aiModulesDir,
      shell: true,
      windowsHide: true
    });

    let errorData = '';

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('error', (err) => {
      console.error("❌ Watermark spawn error:", err.message);
      reject(err);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error("❌ Watermark failed:", errorData);
        return reject(new Error('Watermark process failed'));
      }
      console.log("✅ Watermark added!\n");
      resolve(true);
    });
  });
};

// ================= CREATE IMAGE POST =================
router.post("/", verifyToken, async (req, res) => {
  try {
    const { caption, image } = req.body;

    console.log("\n════════════════════════════════════════════════");
    console.log("📤 NEW IMAGE POST REQUEST");
    console.log("════════════════════════════════════════════════");

    if (!image) {
      return res.status(400).json({ message: "Image is required" });
    }

    const match = image.match(/^data:image\/(.+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ message: "Invalid image format" });
    }

    const ext = match[1].split('/')[0];
    const data = match[2];
    const buffer = Buffer.from(data, "base64");

    const tempFilename = `temp-${Date.now()}.${ext}`;
    const tempFilepath = path.join(uploadDir, tempFilename);
    fs.writeFileSync(tempFilepath, buffer);

    console.log("⏳ Running AI detection...\n");
    const aiResult = await detectAIImage(tempFilepath);

    let finalFilename;

    if (aiResult.is_ai) {
      console.log("🤖 AI IMAGE → Adding watermark...");
      const watermarkedFilename = `ai-${Date.now()}.${ext}`;
      const watermarkedFilepath = path.join(uploadDir, watermarkedFilename);

      try {
        await addImageWatermark(tempFilepath, watermarkedFilepath);
        fs.unlinkSync(tempFilepath);
        finalFilename = watermarkedFilename;
      } catch (watermarkErr) {
        console.error("❌ Watermark failed, using original");
        const fallbackFilename = `post-${Date.now()}.${ext}`;
        fs.renameSync(tempFilepath, path.join(uploadDir, fallbackFilename));
        finalFilename = fallbackFilename;
      }
    } else {
      console.log("✅ REAL IMAGE → No watermark needed");
      const realFilename = `post-${Date.now()}.${ext}`;
      fs.renameSync(tempFilepath, path.join(uploadDir, realFilename));
      finalFilename = realFilename;
    }

    const post = await Post.create({
      userId: req.userId,
      caption: caption || '',
      imageUrl: `/uploads/${finalFilename}`,
      isReel: false,
      isTextPost: false,
      aiDetection: {
        isAIGenerated: aiResult.is_ai || false,
        confidence: aiResult.confidence || 0,
        detectionDate: new Date()
      }
    });

    await User.findByIdAndUpdate(req.userId, { $inc: { posts: 1 } });
    const populatedPost = await Post.findById(post._id).populate('userId', 'username profilePicture');

    console.log("\n✅ IMAGE POST CREATED\n");

    res.status(201).json({
      success: true,
      post: {
        id: populatedPost._id.toString(),
        user: {
          _id: populatedPost.userId._id.toString(),
          username: populatedPost.userId.username,
          profilePicture: populatedPost.userId.profilePicture,
        },
        caption: populatedPost.caption,
        textContent: populatedPost.textContent,
        imageUrl: populatedPost.imageUrl,
        videoUrl: populatedPost.videoUrl,
        isReel: populatedPost.isReel,
        isTextPost: populatedPost.isTextPost,
        createdAt: populatedPost.createdAt,
        likes: [],
        comments: [],
        shares: 0,
        aiDetection: populatedPost.aiDetection,
        factCheck: populatedPost.factCheck
      }
    });

  } catch (err) {
    console.error('\n❌ POST CREATION ERROR:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================= CREATE VIDEO/REEL POST =================
router.post("/reel", verifyToken, async (req, res) => {
  try {
    const { caption, video } = req.body;

    console.log("\n════════════════════════════════════════════════");
    console.log("🎥 NEW REEL/VIDEO POST REQUEST");
    console.log("════════════════════════════════════════════════");

    if (!video) {
      return res.status(400).json({ message: "Video is required" });
    }

    const match = video.match(/^data:video\/(.+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ message: "Invalid video format" });
    }

    const ext = match[1];
    const data = match[2];
    const buffer = Buffer.from(data, "base64");

    const videoFilename = `reel-${Date.now()}.${ext}`;
    const videoFilepath = path.join(uploadDir, videoFilename);
    fs.writeFileSync(videoFilepath, buffer);

    console.log(`💾 Video saved: ${videoFilename}`);
    console.log("⏳ Running AI video detection (30-60 seconds)...\n");

    const aiResult = await detectAIVideo(videoFilepath);

    const post = await Post.create({
      userId: req.userId,
      caption: caption || '',
      videoUrl: `/uploads/${videoFilename}`,
      isReel: true,
      isTextPost: false,
      aiDetection: {
        isAIGenerated: aiResult.is_ai || false,
        confidence: aiResult.confidence || 0,
        detectionDate: new Date()
      }
    });

    await User.findByIdAndUpdate(req.userId, { $inc: { posts: 1 } });
    const populatedPost = await Post.findById(post._id).populate('userId', 'username profilePicture');

    console.log("\n✅ REEL POST CREATED\n");

    res.status(201).json({
      success: true,
      post: {
        id: populatedPost._id.toString(),
        user: {
          _id: populatedPost.userId._id.toString(),
          username: populatedPost.userId.username,
          profilePicture: populatedPost.userId.profilePicture,
        },
        caption: populatedPost.caption,
        textContent: populatedPost.textContent,
        imageUrl: populatedPost.imageUrl,
        videoUrl: populatedPost.videoUrl,
        isReel: populatedPost.isReel,
        isTextPost: populatedPost.isTextPost,
        createdAt: populatedPost.createdAt,
        likes: [],
        comments: [],
        shares: 0,
        aiDetection: populatedPost.aiDetection,
        factCheck: populatedPost.factCheck
      }
    });

  } catch (err) {
    console.error('\n❌ REEL CREATION ERROR:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================= CREATE TEXT POST =================
router.post("/text", verifyToken, async (req, res) => {
  try {
    const { textContent } = req.body;

    console.log("\n════════════════════════════════════════════════");
    console.log("📝 NEW TEXT POST REQUEST");
    console.log("════════════════════════════════════════════════");

    if (!textContent || textContent.trim().length < 10) {
      return res.status(400).json({ message: "Text must be at least 10 characters long" });
    }

    if (textContent.length > 500) {
      return res.status(400).json({ message: "Text must be less than 500 characters" });
    }

    console.log(`📄 Text: "${textContent.substring(0, 100)}..."`);
    console.log("⏳ Running fact check (30-60 seconds)...\n");

    const factResult = await factCheckText(textContent);

    const post = await Post.create({
      userId: req.userId,
      textContent,
      isTextPost: true,
      isReel: false,
      factCheck: {
        isVerified: factResult.success || false,
        verdict: factResult.verdict || "UNVERIFIABLE",
        confidence: factResult.confidence || "Unknown",
        supportingSources: (factResult.supporting_sources || []).slice(0, 3),
        contradictingSources: (factResult.contradicting_sources || []).slice(0, 3),
        checkedDate: new Date()
      }
    });

    await User.findByIdAndUpdate(req.userId, { $inc: { posts: 1 } });
    const populatedPost = await Post.findById(post._id).populate('userId', 'username profilePicture');

    console.log("\n✅ TEXT POST CREATED\n");

    res.status(201).json({
      success: true,
      post: {
        id: populatedPost._id.toString(),
        user: {
          _id: populatedPost.userId._id.toString(),
          username: populatedPost.userId.username,
          profilePicture: populatedPost.userId.profilePicture,
        },
        caption: populatedPost.caption,
        textContent: populatedPost.textContent,
        imageUrl: populatedPost.imageUrl,
        videoUrl: populatedPost.videoUrl,
        isReel: populatedPost.isReel,
        isTextPost: populatedPost.isTextPost,
        createdAt: populatedPost.createdAt,
        likes: [],
        comments: [],
        shares: 0,
        aiDetection: populatedPost.aiDetection,
        factCheck: populatedPost.factCheck
      }
    });

  } catch (err) {
    console.error('\n❌ TEXT POST CREATION ERROR:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================= GET ALL POSTS =================
router.get("/", async (req, res) => {
  try {
    const { userId, type } = req.query;
    
    const filter = {};
    if (userId) filter.userId = userId;
    if (type === 'reel') filter.isReel = true;
    if (type === 'post') filter.isReel = false;
    if (type === 'text') filter.isTextPost = true;
    
    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePicture fullName")
      .lean();

    if (posts.length === 0) return res.json([]);

    const shaped = posts.map((p) => {
      try {
        return {
          id: p._id.toString(),
          _id: p._id.toString(),
          user: {
            _id: p.userId._id.toString(),
            username: p.userId.username || 'Unknown',
            profilePicture: p.userId.profilePicture || null,
            fullName: p.userId.fullName || p.userId.username || 'Unknown'
          },
          caption: p.caption || '',
          textContent: p.textContent || '',
          imageUrl: p.imageUrl || '',
          videoUrl: p.videoUrl || '',
          isReel: p.isReel || false,
          isTextPost: p.isTextPost || false,
          createdAt: p.createdAt,
          likes: p.likes || [],
          comments: p.comments || [],
          shares: p.shares || 0,
          aiDetection: p.aiDetection || { isAIGenerated: false, confidence: 0 },
          factCheck: p.factCheck || { verdict: "PENDING", confidence: "" }
        };
      } catch (err) {
        return null;
      }
    }).filter(Boolean);

    res.json(shaped);
  } catch (err) {
    console.error('❌ Error fetching posts:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================= GET SINGLE POST =================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID format" });
    }

    const post = await Post.findById(id)
      .populate("userId", "username profilePicture fullName")
      .lean();

    if (!post) return res.status(404).json({ message: "Post not found" });

    res.json({
      id: post._id.toString(),
      _id: post._id.toString(),
      user: {
        _id: post.userId._id.toString(),
        username: post.userId.username,
        profilePicture: post.userId.profilePicture,
        fullName: post.userId.fullName || post.userId.username
      },
      caption: post.caption,
      textContent: post.textContent,
      imageUrl: post.imageUrl,
      videoUrl: post.videoUrl,
      isReel: post.isReel,
      isTextPost: post.isTextPost,
      createdAt: post.createdAt,
      likes: post.likes || [],
      comments: post.comments || [],
      shares: post.shares || 0,
      aiDetection: post.aiDetection || { isAIGenerated: false, confidence: 0 },
      factCheck: post.factCheck || { verdict: "PENDING", confidence: "" }
    });
  } catch (err) {
    console.error('❌ Error fetching post:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================= DELETE POST =================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID format" });
    }

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (post.imageUrl?.startsWith('/uploads/')) {
      const filepath = path.join(uploadDir, post.imageUrl.replace('/uploads/', ''));
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }

    if (post.videoUrl?.startsWith('/uploads/')) {
      const filepath = path.join(uploadDir, post.videoUrl.replace('/uploads/', ''));
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }

    await Post.findByIdAndDelete(id);
    await User.findByIdAndUpdate(req.userId, { $inc: { posts: -1 } });

    res.json({ success: true, message: "Post deleted" });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================= LIKE / UNLIKE POST =================
router.post("/:id/like", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const userId = req.userId;
    const alreadyLiked = post.likes.some(
      (likeId) => likeId.toString() === userId
    );

    if (alreadyLiked) {
      post.likes = post.likes.filter((likeId) => likeId.toString() !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();

    res.json({
      success: true,
      liked: !alreadyLiked,
      likes: post.likes,
      likeCount: post.likes.length
    });

  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;