"use client";

import { useEffect } from "react";

// Create a component to pre-fetch videos and check availability
export function EnsureTechVideos() {
  useEffect(() => {
    // Update to .webm file extensions
    const videoUrls = [
      "/TechStackVideos/birdoriginal_original.webm",
      "/TechStackVideos/birdoriginal_landmarks_overlay.webm", 
      "/TechStackVideos/birdoriginal_landmarks_only.webm"
    ];

    console.log("🎬 Checking for tech demo videos...");
    
    // Check if files exist with fetch to get proper error handling
    videoUrls.forEach(url => {
      fetch(url, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            console.log(`✅ Video found: ${url}`);
            // Try to preload video content
            const video = document.createElement('video');
            video.preload = 'auto';
            video.muted = true;
            video.style.display = 'none';
            video.src = url;
            
            video.onloadeddata = () => {
              console.log(`✅ Video preloaded successfully: ${url}`);
              document.body.removeChild(video);
            };
            
            video.onerror = (err) => {
              console.error(`❌ Error preloading video: ${url}`, err);
              document.body.removeChild(video);
            };
            
            document.body.appendChild(video);
          } else {
            console.error(`❌ Video not found (${response.status}): ${url}`);
          }
        })
        .catch(error => {
          console.error(`❌ Error checking video: ${url}`, error);
        });
    });
    
    // Cleanup function
    return () => {
      const videos = document.querySelectorAll('video[style="display: none;"]');
      videos.forEach(video => {
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      });
    };
  }, []);

  return null;
}

export default EnsureTechVideos;
