#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk') || { green: (s) => s, red: (s) => s, yellow: (s) => s };

// Define paths
const publicDir = path.join(__dirname, '../public');
const techVideosDir = path.join(publicDir, 'TechStackVideos');

// Required videos
const requiredVideos = [
  'birdoriginal_original.mp4',
  'birdoriginal_landmarks_overlay.mp4',
  'birdoriginal_landmarks_only.mp4'
];

// Function to check if directory exists and create if not
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    console.log(chalk.yellow(`Directory not found: ${directory}`));
    console.log(chalk.yellow(`Creating directory: ${directory}`));
    fs.mkdirSync(directory, { recursive: true });
    return false;
  }
  return true;
}

// Function to check if videos exist
function checkVideos() {
  console.log(chalk.yellow('Checking for required tech demo videos...'));
  
  // Ensure directories exist
  const publicDirExists = ensureDirectoryExists(publicDir);
  const videosDirExists = ensureDirectoryExists(techVideosDir);
  
  // Check for each required video
  const missingVideos = [];
  for (const videoName of requiredVideos) {
    const videoPath = path.join(techVideosDir, videoName);
    if (!fs.existsSync(videoPath)) {
      console.log(chalk.red(`❌ Missing video: ${videoName}`));
      missingVideos.push(videoName);
    } else {
      // Check file size to ensure it's not empty
      const stats = fs.statSync(videoPath);
      if (stats.size === 0) {
        console.log(chalk.red(`❌ Video is empty (0 bytes): ${videoName}`));
        missingVideos.push(videoName);
      } else {
        console.log(chalk.green(`✅ Found video: ${videoName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`));
      }
    }
  }
  
  return {
    allPresent: missingVideos.length === 0,
    missingVideos
  };
}

// Run the check
const result = checkVideos();

if (!result.allPresent) {
  console.log('\n' + chalk.yellow('Some required videos are missing. Download them or generate using:'));
  console.log(chalk.yellow('node scripts/generate_tech_demos.js <your_video> -o public/TechStackVideos\n'));
  
  console.log(chalk.yellow('Expected video paths:'));
  for (const video of result.missingVideos) {
    console.log(chalk.yellow(`- /public/TechStackVideos/${video}`));
  }
}

// Exit with error code if videos are missing
if (!result.allPresent) {
  process.exit(1);
}
