/**
 * Server-side QR Code Decoding
 * Uses jsQR and Jimp to decode QR codes from base64 images
 */

import { Jimp } from "jimp";
import jsQR from "jsqr";

export interface QRDecodeResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * Decode QR code from base64 image string
 * @param base64Image - Base64 encoded image (with or without data URI prefix)
 * @returns QR decode result with data or error
 */
export async function decodeQRFromBase64(base64Image: string): Promise<QRDecodeResult> {
  try {
    // Remove data URI prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, "base64");
    
    // Load image with Jimp
    const image = await Jimp.read(imageBuffer);
    
    // Get image dimensions
    const width = image.width;
    const height = image.height;
    
    // Get raw RGBA pixel data
    const imageData = new Uint8ClampedArray(image.bitmap.data);
    
    // Try to decode QR code at original size
    let code = jsQR(imageData, width, height);
    
    if (code?.data) {
      console.log("[QR Decode] Success at original size:", code.data);
      return {
        success: true,
        data: code.data,
      };
    }
    
    // Try with different resize scales for better detection
    const scales = [0.75, 0.5, 1.5, 2.0];
    
    for (const scale of scales) {
      try {
        const resized = image.clone().scale(scale);
        const resizedWidth = resized.width;
        const resizedHeight = resized.height;
        const resizedData = new Uint8ClampedArray(resized.bitmap.data);
        
        code = jsQR(resizedData, resizedWidth, resizedHeight);
        
        if (code?.data) {
          console.log(`[QR Decode] Success at scale ${scale}:`, code.data);
          return {
            success: true,
            data: code.data,
          };
        }
      } catch {
        continue;
      }
    }
    
    // Try with grayscale conversion for better contrast
    try {
      const grayscale = image.clone().greyscale();
      const grayData = new Uint8ClampedArray(grayscale.bitmap.data);
      
      code = jsQR(grayData, width, height);
      
      if (code?.data) {
        console.log("[QR Decode] Success with grayscale:", code.data);
        return {
          success: true,
          data: code.data,
        };
      }
    } catch {
      // Continue to error
    }
    
    // Try with contrast enhancement
    try {
      const enhanced = image.clone().contrast(0.3);
      const enhancedData = new Uint8ClampedArray(enhanced.bitmap.data);
      
      code = jsQR(enhancedData, width, height);
      
      if (code?.data) {
        console.log("[QR Decode] Success with contrast:", code.data);
        return {
          success: true,
          data: code.data,
        };
      }
    } catch {
      // Continue to error
    }
    
    return {
      success: false,
      error: "Could not detect QR code in the image. Please ensure the QR code is clearly visible and well-lit.",
    };
  } catch (error) {
    console.error("[QR Decode] Error:", error);
    return {
      success: false,
      error: "Failed to process image. Please try a different image.",
    };
  }
}
