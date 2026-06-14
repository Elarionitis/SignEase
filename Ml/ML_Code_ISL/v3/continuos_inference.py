#venv path ~/PythonVenv/ISLRv2git/bin/python3.12
#Coded by Pavan Chauhan!
import streamlit as st
import cv2
import mediapipe as mp
import pandas as pd
import time
import tensorflow.lite as tflite
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from IPython.display import HTML
from gtts import gTTS
import os

mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_holistic = mp.solutions.holistic

def create_frame_landmark_df(results, frame, xyz):
    """
    Takes the results from mediapipe and creates a dataframe of the landmarks
    """
    # for having values and rows for every landmark index
    xyz_skel = xyz[['type', 'landmark_index']].drop_duplicates().reset_index(drop=True).copy()
    face = pd.DataFrame()
    pose = pd.DataFrame()
    left_hand = pd.DataFrame()
    right_hand = pd.DataFrame()

    if results.face_landmarks is not None:
        for i, point in enumerate(results.face_landmarks.landmark):
            face.loc[i, ['x', 'y', 'z']] = [point.x, point.y, point.z]
    if results.pose_landmarks is not None:
        for i, point in enumerate(results.pose_landmarks.landmark):
            pose.loc[i, ['x', 'y', 'z']] = [point.x, point.y, point.z]
    if results.left_hand_landmarks is not None:
        for i, point in enumerate(results.left_hand_landmarks.landmark):
            left_hand.loc[i, ['x', 'y', 'z']] = [point.x, point.y, point.z]
    if results.right_hand_landmarks is not None:
        for i, point in enumerate(results.right_hand_landmarks.landmark):
            right_hand.loc[i, ['x', 'y', 'z']] = [point.x, point.y, point.z]

    face = face.reset_index().rename(columns={'index': 'landmark_index'}).assign(type='face')
    pose = pose.reset_index().rename(columns={'index': 'landmark_index'}).assign(type='pose')
    left_hand = left_hand.reset_index().rename(columns={'index': 'landmark_index'}).assign(type='left_hand')
    right_hand = right_hand.reset_index().rename(columns={'index': 'landmark_index'}).assign(type='right_hand')

    landmarks = pd.concat([face, pose, left_hand, right_hand]).reset_index(drop=True)
    # So that skel will have landmarks even if they do not exist
    landmarks = xyz_skel.merge(landmarks, on=['type', 'landmark_index'], how='left')
    # to have actual unique frames
    landmarks = landmarks.assign(frame=frame)
    return landmarks

def do_capture_loop(xyz, buffer_duration=6):
    all_landmarks = []
    recognized_signs = []  # List to store recognized signs
    cap = cv2.VideoCapture(0)
    video_placeholder = st.empty()
    capturing_message = st.empty()
    capturing_message.write("Capturing")

    frame = 0
    start_time = time.time()
    with mp_holistic.Holistic( 
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5) as holistic:
        while cap.isOpened():
            frame += 1
            success, image = cap.read()
            if not success:
                print("Ignoring empty camera frame.")
                continue

            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            video_placeholder.image(image, channels="RGB", caption="Camera Feed")

            results = holistic.process(image)
            landmarks = create_frame_landmark_df(results, frame, xyz)
            all_landmarks.append(landmarks)

            # Check if the buffer duration has passed
            if time.time() - start_time >= buffer_duration:
                # Process the captured landmarks
                captured_landmarks_df = pd.concat(all_landmarks).reset_index(drop=True)
                captured_landmarks_df.to_parquet(captured_parquet_file)
                sign = pd.read_parquet(captured_parquet_file)
                sign.y = sign.y * -1 

                # Display the animated video and make predictions
                st.write(animate_sign_video(sign), unsafe_allow_html=True)  
                recognized_sign = get_prediction(prediction_fn, captured_parquet_file)
                if recognized_sign:
                    recognized_signs.append(recognized_sign)  # Append recognized sign to the list

                # Reset the buffer and timer
                all_landmarks = []
                start_time = time.time()

            # Check for stop condition
            if st.session_state.get("stop_capturing", False):
                break

    cap.release()
    video_placeholder.empty()
    capturing_message.empty()

    return recognized_signs

def load_relevant_data_subset(pq_path):
    ROWS_PER_FRAME = 543  # number of landmarks per frame
    data_columns = ['x', 'y', 'z']
    data = pd.read_parquet(pq_path, columns=data_columns)
    n_frames = int(len(data) / ROWS_PER_FRAME)
    data = data.values.reshape(n_frames, ROWS_PER_FRAME, len(data_columns))
    return data.astype(np.float32)

def get_prediction(prediction_fn, pq_file):
    xyz_np = load_relevant_data_subset(pq_file)
    prediction = prediction_fn(inputs=xyz_np)
    pred = prediction['outputs'].argmax()
    sign_ord = pred.item()
    sign = ORD2SIGN[sign_ord]
    pred_conf = prediction['outputs'][pred]
    st.write(f'PREDICTED SIGN: {sign} [{sign_ord}], CONFIDENCE: {pred_conf:0.4}')
    
    # Convert text to speech using gTTS
    tts = gTTS(text=f'The predicted sign is {sign}', lang='en')
    tts.save("predicted_sign.mp3")
    os.system("mpg321 predicted_sign.mp3")
    
    return sign  # Return the recognized sign

def animate_sign_video(sign):
    def get_hand_points(hand):
        x = [[hand.iloc[0].x, hand.iloc[1].x, hand.iloc[2].x, hand.iloc[3].x, hand.iloc[4].x], # Thumb
            [hand.iloc[5].x, hand.iloc[6].x, hand.iloc[7].x, hand.iloc[8].x], # Index
            [hand.iloc[9].x, hand.iloc[10].x, hand.iloc[11].x, hand.iloc[12].x], 
            [hand.iloc[13].x, hand.iloc[14].x, hand.iloc[15].x, hand.iloc[16].x], 
            [hand.iloc[17].x, hand.iloc[18].x, hand.iloc[19].x, hand.iloc[20].x], 
            [hand.iloc[0].x, hand.iloc[5].x, hand.iloc[9].x, hand.iloc[13].x, hand.iloc[17].x, hand.iloc[0].x]]

        y = [[hand.iloc[0].y, hand.iloc[1].y, hand.iloc[2].y, hand.iloc[3].y, hand.iloc[4].y],  #Thumb
            [hand.iloc[5].y, hand.iloc[6].y, hand.iloc[7].y, hand.iloc[8].y], # Index
            [hand.iloc[9].y, hand.iloc[10].y, hand.iloc[11].y, hand.iloc[12].y], 
            [hand.iloc[13].y, hand.iloc[14].y, hand.iloc[15].y, hand.iloc[16].y], 
            [hand.iloc[17].y, hand.iloc[18].y, hand.iloc[19].y, hand.iloc[20].y], 
            [hand.iloc[0].y, hand.iloc[5].y, hand.iloc[9].y, hand.iloc[13].y, hand.iloc[17].y, hand.iloc[0].y]] 
        return x, y

    def get_pose_points(pose):
        x = [[pose.iloc[8].x, pose.iloc[6].x, pose.iloc[5].x, pose.iloc[4].x, pose.iloc[0].x, pose.iloc[1].x, pose.iloc[2].x, pose.iloc[3].x, pose.iloc[7].x], 
            [pose.iloc[10].x, pose.iloc[9].x], 
            [pose.iloc[22].x, pose.iloc[16].x, pose.iloc[20].x, pose.iloc[18].x, pose.iloc[16].x, pose.iloc[14].x, pose.iloc[12].x, 
            pose.iloc[11].x, pose.iloc[13].x, pose.iloc[15].x, pose.iloc[17].x, pose.iloc[19].x, pose.iloc[15].x, pose.iloc[21].x], 
            [pose.iloc[12].x, pose.iloc[24].x, pose.iloc[26].x, pose.iloc[28].x, pose.iloc[30].x, pose.iloc[32].x, pose.iloc[28].x], 
            [pose.iloc[11].x, pose.iloc[23].x, pose.iloc[25].x, pose.iloc[27].x, pose.iloc[29].x, pose.iloc[31].x, pose.iloc[27].x], 
            [pose.iloc[24].x, pose.iloc[23].x]
            ]

        y = [[pose.iloc[8].y, pose.iloc[6].y, pose.iloc[5].y, pose.iloc[4].y, pose.iloc[0].y, pose.iloc[1].y, pose.iloc[2].y, pose.iloc[3].y, pose.iloc[7].y], 
            [pose.iloc[10].y, pose.iloc[9].y], 
            [pose.iloc[22].y, pose.iloc[16].y, pose.iloc[20].y, pose.iloc[18].y, pose.iloc[16].y, pose.iloc[14].y, pose.iloc[12].y, 
            pose.iloc[11].y, pose.iloc[13].y, pose.iloc[15].y, pose.iloc[17].y, pose.iloc[19].y, pose.iloc[15].y, pose.iloc[21].y], 
            [pose.iloc[12].y, pose.iloc[24].y, pose.iloc[26].y, pose.iloc[28].y, pose.iloc[30].y, pose.iloc[32].y, pose.iloc[28].y], 
            [pose.iloc[11].y, pose.iloc[23].y, pose.iloc[25].y, pose.iloc[27].y, pose.iloc[29].y, pose.iloc[31].y, pose.iloc[27].y], 
            [pose.iloc[24].y, pose.iloc[23].y]
            ]
        return x, y

    def animation_frame(f):
        frame = sign[sign.frame==f]
        left = frame[frame.type=='left_hand']
        right = frame[frame.type=='right_hand']
        pose = frame[frame.type=='pose']
        face = frame[frame.type=='face'][['x', 'y']].values
        lx, ly = get_hand_points(left)
        rx, ry = get_hand_points(right)
        px, py = get_pose_points(pose)
        ax.clear()
        ax.plot(face[:,0], face[:,1], '.')
        for i in range(len(lx)):
            ax.plot(lx[i], ly[i])
        for i in range(len(rx)):
            ax.plot(rx[i], ry[i])
        for i in range(len(px)):
            ax.plot(px[i], py[i])
        plt.xlim(xmin, xmax)
        plt.ylim(ymin, ymax)

    
    # These values set the limits on the graph to stabilize the video
    xmin = sign.x.min() - 0.2
    xmax = sign.x.max() + 0.2
    ymin = sign.y.min() - 0.2
    ymax = sign.y.max() + 0.2
    fig, ax = plt.subplots()
    l, = ax.plot([], [])
    animation = FuncAnimation(fig, func=animation_frame, frames=sign.frame.unique())

    return animation.to_html5_video()

if __name__ == "__main__":
    dummy_parquet_skel_file = '/Users/pavan/GIT/ISLRv2/data/239181.parquet'
    tflite_model = '/Users/pavan/GIT/ISLRv2/models/asl_model.tflite'
    csv_file ='/Users/pavan/GIT/ISLRv2/data/train.csv'
    captured_parquet_file = '/Users/pavan/GIT/ISLRv2/shammers.parquet'

    xyz = pd.read_parquet(dummy_parquet_skel_file)

    # Combine main script and inference code
    interpreter = tflite.Interpreter(tflite_model)
    found_signatures = list(interpreter.get_signature_list().keys())
    prediction_fn = interpreter.get_signature_runner("serving_default")
    train = pd.read_csv(csv_file)
    # Add ordinally Encoded Sign (assign number to each sign name)
    train['sign_ord'] = train['sign'].astype('category').cat.codes

    # Dictionaries to translate sign <-> ordinal encoded sign
    SIGN2ORD = train[['sign', 'sign_ord']].set_index('sign').squeeze().to_dict()
    ORD2SIGN = train[['sign_ord', 'sign']].set_index('sign_ord').squeeze().to_dict()

    # Streamlit app layout
    st.title("Isolated Sign Language Recognition App")
    st.write("Press the 'Start Capturing' button to begin capturing your sign continuously. Press 'Stop Capturing' to end the process.")
    
    if st.button("Start Capturing"):
        recognized_signs = do_capture_loop(xyz)  # Modified
        st.write("Recognized Signs:")
        st.write(recognized_signs)  # Display the list of recognized signs
