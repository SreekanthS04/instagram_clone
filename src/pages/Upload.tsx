import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Video, X, Image as ImageIcon, FileText } from "lucide-react";

const API = import.meta.env.VITE_API_URL as string;

type UploadType = 'image' | 'video' | 'text';

export default function Upload() {
  const [uploadType, setUploadType] = useState<UploadType>('image');
  const [caption, setCaption] = useState("");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (uploadType === 'image' && !selectedFile.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    if (uploadType === 'video' && !selectedFile.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }

    const maxSize = uploadType === 'image' ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError(`File size should be less than ${uploadType === 'image' ? '5MB' : '50MB'}`);
      return;
    }

    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setFile(result);
      setPreviewUrl(result);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsDataURL(selectedFile);
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl(null);
    setTextContent("");
    setCaption("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (uploadType === 'text') {
      if (!textContent || textContent.trim().length < 10) {
        setError("Text must be at least 10 characters long");
        return;
      }
      if (textContent.length > 500) {
        setError("Text must be less than 500 characters");
        return;
      }
    } else {
      if (!file) {
        setError(`Please select ${uploadType === 'image' ? 'an image' : 'a video'}`);
        return;
      }
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("You must be logged in to post");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let endpoint = '';
      let body = {};

      if (uploadType === 'text') {
        endpoint = '/api/posts/text';
        body = { textContent: textContent.trim() };
      } else if (uploadType === 'video') {
        endpoint = '/api/posts/reel';
        body = { caption: caption.trim(), video: file };
      } else {
        endpoint = '/api/posts';
        body = { caption: caption.trim(), image: file };
      }

      console.log(`📤 Uploading ${uploadType}...`);

      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      console.log('✅ Post created successfully!');
      setTimeout(() => navigate("/"), 500);

    } catch (err: any) {
      console.error('❌ Upload error:', err);
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-purple-600 to-teal-500 bg-clip-text text-transparent">
          Create New Post
        </h2>

        {/* Type Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setUploadType('image');
              clearFile();
            }}
            className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              uploadType === 'image'
                ? 'bg-gradient-to-r from-purple-600 to-teal-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            Image
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadType('video');
              clearFile();
            }}
            className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              uploadType === 'video'
                ? 'bg-gradient-to-r from-purple-600 to-teal-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Video className="w-5 h-5" />
            Video
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadType('text');
              clearFile();
            }}
            className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              uploadType === 'text'
                ? 'bg-gradient-to-r from-purple-600 to-teal-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-5 h-5" />
            Text
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Text Post Input */}
          {uploadType === 'text' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                What's on your mind? *
              </label>
              <textarea
                placeholder="Share your thoughts... (will be fact-checked)"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Minimum 10 characters</span>
                <span>{textContent.length}/500</span>
              </div>
            </div>
          ) : (
            <>
              {/* File Upload for Image/Video */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Upload {uploadType === 'image' ? 'Image' : 'Video'} *
                </label>

                {!previewUrl ? (
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-500 transition-colors bg-gray-50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {uploadType === 'image' ? (
                        <Camera className="w-12 h-12 mb-3 text-gray-400" />
                      ) : (
                        <Video className="w-12 h-12 mb-3 text-gray-400" />
                      )}
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        {uploadType === 'image' ? 'PNG, JPG, JPEG (MAX. 5MB)' : 'MP4, WEBM (MAX. 50MB)'}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept={uploadType === 'image' ? 'image/*' : 'video/*'}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative">
                    {uploadType === 'image' ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-64 object-cover rounded-lg" />
                    ) : (
                      <video src={previewUrl} controls className="w-full h-64 object-cover rounded-lg bg-black" />
                    )}
                    <button
                      type="button"
                      onClick={clearFile}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Caption for Image/Video */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Caption</label>
                <textarea
                  placeholder="Write a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (uploadType !== 'text' && !file) || (uploadType === 'text' && textContent.trim().length < 10)}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
              loading || (uploadType !== 'text' && !file) || (uploadType === 'text' && textContent.trim().length < 10)
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-teal-500 hover:shadow-lg transform hover:-translate-y-0.5"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {uploadType === 'video' ? 'Analyzing & Posting (30-60s)...' : 
                 uploadType === 'text' ? 'Fact-checking (30-60s)...' : 
                 'Posting...'}
              </span>
            ) : (
              "Share Post"
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}