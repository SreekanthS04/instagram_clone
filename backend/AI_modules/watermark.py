from PIL import Image, ImageDraw, ImageFont
import sys
import os

def add_watermark(image_path, output_path):
    """Add 'AI' watermark to bottom-left corner of image"""
    try:
        # Open image
        img = Image.open(image_path)
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Create drawing context
        draw = ImageDraw.Draw(img)
        
        # Calculate watermark size based on image dimensions
        img_width, img_height = img.size
        font_size = max(30, min(img_width, img_height) // 20)
        
        # Try to use a bold font, fallback to default
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        # Watermark text
        text = "AI"
        
        # Get text bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Position: bottom-left with padding
        padding = 20
        x = padding
        y = img_height - text_height - padding
        
        # Draw semi-transparent background rectangle
        bg_padding = 10
        bg_box = [
            x - bg_padding,
            y - bg_padding,
            x + text_width + bg_padding,
            y + text_height + bg_padding
        ]
        draw.rectangle(bg_box, fill=(0, 0, 0, 180))
        
        # Draw white text
        draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
        
        # Convert back to RGB for JPEG compatibility
        if output_path.lower().endswith(('.jpg', '.jpeg')):
            img = img.convert('RGB')
        
        # Save watermarked image
        img.save(output_path, quality=95)
        print(f"SUCCESS: Watermark added to {output_path}")
        return True
        
    except Exception as e:
        print(f"ERROR: Failed to add watermark: {str(e)}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python watermark.py <input_path> <output_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    
    success = add_watermark(input_path, output_path)
    sys.exit(0 if success else 1)