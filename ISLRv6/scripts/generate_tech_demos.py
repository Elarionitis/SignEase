import os
import cv2
import numpy as np
import mediapipe as mp
import time
import argparse
from pathlib import Path

def generate_tech_demos(input_file, output_dir=None, duration=None):
    """
    Generate three videos demonstrating the technology stack:
    1. Original video - Raw input from source
    2. Video with landmarks overlay - Same video with MediaPipe landmarks overlaid on it
    3. Only landmarks visualization - Just the landmarks on a black background
    
    Args:
        input_file (str): Path to input video file
        output_dir (str): Directory to save output videos
        duration (int): Optional duration limit in seconds
    """
    # Create output directory if it doesn't exist
    if output_dir is None:
        output_dir = Path("../public/TechStackVideos")
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Get input file name without extension for output naming
    input_filename = Path(input_file).stem
    
    print(f"Processing video: {input_file}")
    print(f"Output will be saved to: {output_dir}")
    
    # Initialize MediaPipe Holistic
    mp_holistic = mp.solutions.holistic
    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles
    
    # Theme-matched modern color scheme for landmarks
    # Updated colors to match website's aesthetic
    face_color = (80, 110, 255)  # Light blue
    pose_color = (245, 117, 66)  # Light orange
    hand_left_color = (121, 22, 76)  # Purple-pink
    hand_right_color = (219, 112, 147)  # Pink
    
    # Drawing specs for better visualization with website theme colors
    face_landmark_drawing_spec = mp_drawing.DrawingSpec(color=face_color, thickness=1, circle_radius=1)
    face_connection_drawing_spec = mp_drawing.DrawingSpec(color=(80, 256, 121), thickness=1)
    
    pose_landmark_drawing_spec = mp_drawing.DrawingSpec(color=pose_color, thickness=2, circle_radius=2)
    pose_connection_drawing_spec = mp_drawing.DrawingSpec(color=(245, 66, 230), thickness=2)
    
    hand_left_landmark_drawing_spec = mp_drawing.DrawingSpec(color=hand_left_color, thickness=2, circle_radius=2)
    hand_left_connection_drawing_spec = mp_drawing.DrawingSpec(color=(121, 44, 250), thickness=2)
    
    hand_right_landmark_drawing_spec = mp_drawing.DrawingSpec(color=hand_right_color, thickness=2, circle_radius=2)
    hand_right_connection_drawing_spec = mp_drawing.DrawingSpec(color=(219, 112, 219), thickness=2)
    
    # Video capture setup
    cap = cv2.VideoCapture(input_file)
    if not cap.isOpened():
        print(f"Error: Could not open video file {input_file}")
        return
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_duration = total_frames / fps if fps > 0 else 0
    
    # Limit duration if specified
    if duration is not None and duration < video_duration:
        processing_frames = int(duration * fps)
        print(f"Processing {duration} seconds of video...")
    else:
        processing_frames = total_frames
        duration = video_duration
        print(f"Processing entire video ({duration:.1f} seconds)...")
    
    # Video writers setup - Using more descriptive filenames
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    original_video_path = str(output_dir / f'{input_filename}_original.mp4')
    landmarks_overlay_path = str(output_dir / f'{input_filename}_landmarks_overlay.mp4')
    landmarks_only_path = str(output_dir / f'{input_filename}_landmarks_only.mp4')
    
    original_video = cv2.VideoWriter(original_video_path, fourcc, fps, (width, height))
    landmarks_overlay_video = cv2.VideoWriter(landmarks_overlay_path, fourcc, fps, (width, height))
    landmarks_only_video = cv2.VideoWriter(landmarks_only_path, fourcc, fps, (width, height))
    
    # Initialize MediaPipe Holistic
    with mp_holistic.Holistic(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5) as holistic:
        
        frame_count = 0
        
        # Processing progress variables
        last_percent = -1
        start_time = time.time()
        
        while frame_count < processing_frames:
            ret, frame = cap.read()
            if not ret:
                print("End of video reached earlier than expected")
                break
            
            # Calculate progress
            current_percent = int((frame_count / processing_frames) * 100)
            if current_percent > last_percent:
                elapsed = time.time() - start_time
                estimated_total = elapsed / (frame_count + 1) * processing_frames
                remaining = max(0, estimated_total - elapsed)
                print(f"Processing: {current_percent}% complete | Remaining time: {remaining:.1f}s")
                last_percent = current_percent
            
            # Process the frame with MediaPipe
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = holistic.process(frame_rgb)
            
            # 1. Save original frame - FIRST OUTPUT VIDEO (without text overlay)
            original_video.write(frame)
            
            # 2. Create landmarks overlay frame - SECOND OUTPUT VIDEO
            overlay_frame = frame.copy()
            
            # Draw face landmarks with theme-matched colors
            if results.face_landmarks:
                mp_drawing.draw_landmarks(
                    overlay_frame,
                    results.face_landmarks,
                    mp_holistic.FACEMESH_CONTOURS,
                    landmark_drawing_spec=face_landmark_drawing_spec,
                    connection_drawing_spec=face_connection_drawing_spec)
            
            # Draw pose landmarks with theme-matched colors
            if results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    overlay_frame,
                    results.pose_landmarks,
                    mp_holistic.POSE_CONNECTIONS,
                    landmark_drawing_spec=pose_landmark_drawing_spec,
                    connection_drawing_spec=pose_connection_drawing_spec)
            
            # Draw hand landmarks with theme-matched colors
            if results.left_hand_landmarks:
                mp_drawing.draw_landmarks(
                    overlay_frame,
                    results.left_hand_landmarks,
                    mp_holistic.HAND_CONNECTIONS,
                    landmark_drawing_spec=hand_left_landmark_drawing_spec,
                    connection_drawing_spec=hand_left_connection_drawing_spec)
            
            if results.right_hand_landmarks:
                mp_drawing.draw_landmarks(
                    overlay_frame,
                    results.right_hand_landmarks,
                    mp_holistic.HAND_CONNECTIONS,
                    landmark_drawing_spec=hand_right_landmark_drawing_spec,
                    connection_drawing_spec=hand_right_connection_drawing_spec)
            
            # No text labels on actual output video
            landmarks_overlay_video.write(overlay_frame)
            
            # 3. Create landmarks only frame (black background) - THIRD OUTPUT VIDEO
            # Create a slightly different background for better aesthetics
            # Use dark gradient background instead of solid black
            landmarks_only = np.zeros_like(frame)
            
            # Optional: Add subtle gradient background
            h, w = landmarks_only.shape[:2]
            for y in range(h):
                for x in range(w):
                    # Create subtle dark gradient
                    r = int(10 * (1 - y/h))  # Dark blue-ish tint
                    g = int(5 * (1 - y/h))   # Almost black
                    b = int(20 * (1 - y/h))  # Slightly more blue
                    landmarks_only[y, x] = (r, g, b)
            
            # Add subtle glow effect
            glow_radius = 100
            center_x, center_y = w // 2, h // 2
            for y in range(h):
                for x in range(w):
                    dist = np.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
                    if dist < glow_radius:
                        intensity = (1 - dist / glow_radius) * 0.15  # Subtle glow
                        r = min(landmarks_only[y, x][0] + int(intensity * 50), 255)
                        g = min(landmarks_only[y, x][1] + int(intensity * 30), 255)
                        b = min(landmarks_only[y, x][2] + int(intensity * 80), 255)
                        landmarks_only[y, x] = (r, g, b)
            
            # Draw face landmarks with enhanced color scheme
            if results.face_landmarks:
                mp_drawing.draw_landmarks(
                    landmarks_only,
                    results.face_landmarks,
                    mp_holistic.FACEMESH_CONTOURS,
                    landmark_drawing_spec=face_landmark_drawing_spec,
                    connection_drawing_spec=face_connection_drawing_spec)
            
            # Draw pose landmarks with enhanced color scheme
            if results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    landmarks_only,
                    results.pose_landmarks,
                    mp_holistic.POSE_CONNECTIONS,
                    landmark_drawing_spec=pose_landmark_drawing_spec,
                    connection_drawing_spec=pose_connection_drawing_spec)
            
            # Draw hand landmarks with enhanced color scheme
            if results.left_hand_landmarks:
                mp_drawing.draw_landmarks(
                    landmarks_only,
                    results.left_hand_landmarks,
                    mp_holistic.HAND_CONNECTIONS,
                    landmark_drawing_spec=hand_left_landmark_drawing_spec,
                    connection_drawing_spec=hand_left_connection_drawing_spec)
            
            if results.right_hand_landmarks:
                mp_drawing.draw_landmarks(
                    landmarks_only,
                    results.right_hand_landmarks,
                    mp_holistic.HAND_CONNECTIONS,
                    landmark_drawing_spec=hand_right_landmark_drawing_spec,
                    connection_drawing_spec=hand_right_connection_drawing_spec)
            
            # No text labels on actual output video
            landmarks_only_video.write(landmarks_only)
            
            # Display frames for preview only (not in saved videos)
            if frame_count % 30 == 0:  # Show only every 30th frame to speed up processing
                # Add labels and info just for the preview display, not for the saved videos
                preview_original = frame.copy()
                preview_overlay = overlay_frame.copy()
                preview_landmarks = landmarks_only.copy()
                
                # Add frame count and labels to preview frames only
                for preview in [preview_original, preview_overlay, preview_landmarks]:
                    cv2.putText(preview, f"Frame: {frame_count}/{processing_frames}", (10, 30), 
                             cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                
                # Add labels to preview display (not saved videos)
                cv2.putText(preview_original, "1. Original Video", 
                         (10, height - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                cv2.putText(preview_overlay, "2. Landmarks Overlay", 
                         (10, height - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                cv2.putText(preview_landmarks, "3. Landmarks Only", 
                         (10, height - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                
                # Resize for display
                scale_factor = min(1.0, 1200 / (width * 3))  # Ensure it fits on screen
                display_width = int(width * scale_factor)
                display_height = int(height * scale_factor)
                
                # Create combined display for preview only
                combined = np.hstack((preview_original, preview_overlay, preview_landmarks))
                combined_display = cv2.resize(combined, (display_width * 3, display_height))
                
                # Show progress on preview only
                cv2.putText(combined_display, f"Processing: {current_percent}%", 
                           (10, display_height - 10), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
                cv2.imshow('Tech Stack Videos Generator (Preview Only)', combined_display)
                
                # Break loop if 'q' is pressed
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("Processing canceled by user")
                    break
            
            frame_count += 1
    
    # Release resources
    cap.release()
    original_video.release()
    landmarks_overlay_video.release()
    landmarks_only_video.release()
    cv2.destroyAllWindows()
    
    total_time = time.time() - start_time
    print("\nVideo generation complete!")
    print(f"Total processing time: {total_time:.1f} seconds")
    print(f"Videos saved to: {output_dir}")
    print(f"Output videos:")
    print(f"1. {input_filename}_original.mp4: Original source video (clean)")
    print(f"2. {input_filename}_landmarks_overlay.mp4: MediaPipe landmarks overlaid (no text)")
    print(f"3. {input_filename}_landmarks_only.mp4: Only landmarks visualization (no text)")
    
    # Return paths to the generated videos for further use
    return {
        "original": original_video_path,
        "landmarks_overlay": landmarks_overlay_path, 
        "landmarks_only": landmarks_only_path
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate tech demo videos with MediaPipe landmark processing")
    parser.add_argument("input_file", help="Path to input video file")
    parser.add_argument("-o", "--output_dir", help="Directory to save output videos", default="../public/TechStackVideos")
    parser.add_argument("-d", "--duration", type=float, help="Duration limit in seconds (optional)")
    
    args = parser.parse_args()
    
    generate_tech_demos(args.input_file, args.output_dir, args.duration)
