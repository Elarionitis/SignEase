/**
 * Script to generate thumbnails from tech demo videos
 * Run this after generating the tech demo videos to create thumbnails
 * Usage: node create-thumbnails.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const videoDir = path.join(__dirname, '..', 'public', 'TechStackVideos');
const assetsDir = path.join(__dirname, '..', 'public', 'assets');

// Make sure the directories exist
if (!fs.existsSync(videoDir)) {
  console.error(`Video directory does not exist: ${videoDir}`);
  process.exit(1);
}

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Map video files to their corresponding tech IDs
const videoToTechMap = {
  'birdoriginal_original.mp4': 'frame-capture',
  'birdoriginal_landmarks_overlay.mp4': 'mediapipe',
  'birdoriginal_landmarks_only.mp4': 'ai-model'
};

try {
  // Check if ffmpeg is installed
  execSync('ffmpeg -version', { stdio: 'ignore' });
  
  console.log('Creating thumbnails from tech demo videos...');
  
  // Get all mp4 files in the directory
  const files = fs.readdirSync(videoDir).filter(file => file.endsWith('.mp4'));
  
  files.forEach(file => {
    // Find the corresponding tech ID
    const techId = Object.keys(videoToTechMap).find(key => file.includes(key));
    if (!techId) return;
    
    const targetName = videoToTechMap[techId];
    const videoPath = path.join(videoDir, file);
    const thumbnailPath = path.join(videoDir, `${targetName}-thumbnail.jpg`);
    
    console.log(`Generating thumbnail for ${file} → ${targetName}-thumbnail.jpg`);
    
    // Generate a thumbnail from the middle of the video
    execSync(`ffmpeg -i "${videoPath}" -ss 00:00:01.000 -vframes 1 -filter:v scale="640:-1" "${thumbnailPath}" -y`, { 
      stdio: 'ignore' 
    });
    
    // Also copy to assets directory as a backup
    const assetPath = path.join(assetsDir, `${targetName}-thumb.jpg`);
    fs.copyFileSync(thumbnailPath, assetPath);
    
    console.log(`✅ Generated ${thumbnailPath}`);
  });
  
  console.log('All thumbnails generated successfully!');
  
} catch (error) {
  console.error('Error creating thumbnails:');
  console.error(error.message || error);
  
  // Create placeholders using basic HTML if ffmpeg fails
  console.log('Creating basic text placeholders instead...');
  
  Object.entries(videoToTechMap).forEach(([_, techId]) => {
    const placeholderPath = path.join(assetsDir, `${techId}-thumb.jpg`);
    
    // Check if we need to create a placeholder
    if (!fs.existsSync(placeholderPath)) {
      console.log(`Creating placeholder for ${techId}...`);
      
      // Since we can't create an image directly, just make an empty file
      // In a real app, you might want to have pre-made placeholders
      fs.writeFileSync(placeholderPath, '');
      
      console.log(`Created empty placeholder: ${placeholderPath}`);
    }
  });
}
