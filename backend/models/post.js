import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    caption: {
      type: String,
      default: "",
    },
    // For text-only posts
    textContent: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    videoUrl: {
      type: String,
      default: "",
    },
    isReel: {
      type: Boolean,
      default: false,
    },
    isTextPost: {
      type: Boolean,
      default: false,
    },
    // AI Detection Results (for images/videos)
    aiDetection: {
      isAIGenerated: {
        type: Boolean,
        default: false,
      },
      confidence: {
        type: Number,
        default: 0,
      },
      detectionDate: {
        type: Date,
      },
    },
    // Fact Check Results (for text posts)
    factCheck: {
      isVerified: {
        type: Boolean,
        default: false,
      },
      verdict: {
        type: String,
        enum: ["LIKELY TRUE", "LIKELY FALSE", "DISPUTED", "UNVERIFIABLE", "PENDING"],
        default: "PENDING",
      },
      confidence: {
        type: String,
        default: "",
      },
      supportingSources: [{
        title: String,
        url: String,
        domain: String,
        credibility: Number,
        stance: String,
      }],
      contradictingSources: [{
        title: String,
        url: String,
        domain: String,
        credibility: Number,
        stance: String,
      }],
      checkedDate: {
        type: Date,
      },
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        text: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    shares: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);
export default Post;