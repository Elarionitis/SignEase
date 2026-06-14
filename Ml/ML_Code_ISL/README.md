# Isolated Sign Language Recognition App

This Streamlit app captures ASL (American Sign Language) signs using a webcam and predicts the corresponding sign using a TensorFlow Lite model. It visualizes the captured sign and provides real-time predictions with an animated view of the captured landmarks for better visualization.

## Dataset Information:

The signs in the dataset represent 250 of the first concepts taught to infants in any language. The goal is to create an isolated sign recognizer to incorporate into educational games for helping hearing parents of Deaf children learn American Sign Language (ASL). Around 90% of deaf infants are born to hearing parents, many of whom may not know American Sign Language. (kdhe.ks.gov, deafchildren.org). Surrounding Deaf children with sign helps avoid Language Deprivation Syndrome. This syndrome is characterized by a lack of access to naturally occurring language acquisition during the critical language-learning years. It can cause serious impacts on different aspects of their lives, such as relationships, education, and employment.
Learning American Sign Language (ASL) is as difficult for English speakers as learning Japanese (jstor.org). It takes time and resources that many parents don't have. They want to learn sign language, but it's hard when they are working long hours just to make ends meet.

The Dataset on which our model is trained:
([Google Dataset](https://www.kaggle.com/competitions/asl-signs/data))
([Custom Dataset](https://www.kaggle.com/datasets/markwijkhuizen/gislr-dataset-public))

## Installation and Setup

To run this app locally, you'll need to install the necessary packages and set up the environment:

1. Clone this repository:
   ```bash
   git clone https://github.com/pavannn16/ISLRv2.git
   cd ISLRv2-main
   ```
Optional. Create a Virtual Environment:
   ```bash
   python -m venv /path/to/new/virtual/environment/venvname
   source <venv>/bin/activate
   ```
   
2.Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

Before Running the Script be sure to change the following paths to your local machine path:
   ```bash
   dummy_parquet_skel_file = '/Users/pavan/GIT/ISLRv2/data/239181.parquet'
   tflite_model = '/Users/pavan/GIT/ISLRv2/models/asl_model.tflite'
   csv_file ='/Users/pavan/GIT/ISLRv2/data/train.csv'
   captured_parquet_file = '/Users/pavan/GIT/ISLRv2/captured.parquet'
   ```
PS:edit here in the app.py code:

<img width="775" alt="image" src="https://github.com/pavannn29/ISLRv2/assets/104923000/a7834283-481e-436d-a7d8-1e7a4551ba58">


## Check out the 250 ASL(American Sign Language) Signs before deploying the app:

```bash
'blow' 'wait' 'cloud' 'bird' 'owie' 'duck' 'minemy' 'lips' 'flower'
 'time' 'vacuum' 'apple' 'puzzle' 'mitten' 'there' 'dry' 'shirt' 'owl'
 'yellow' 'not' 'zipper' 'clean' 'closet' 'quiet' 'have' 'brother' 'clown'
 'cheek' 'cute' 'store' 'shoe' 'wet' 'see' 'empty' 'fall' 'balloon'
 'frenchfries' 'finger' 'same' 'cry' 'hungry' 'orange' 'milk' 'go'
 'drawer' 'TV' 'another' 'giraffe' 'wake' 'bee' 'bad' 'can' 'say'
 'callonphone' 'finish' 'old' 'backyard' 'sick' 'look' 'that' 'black'
 'yourself' 'open' 'alligator' 'moon' 'find' 'pizza' 'shhh' 'fast'
 'jacket' 'scissors' 'now' 'man' 'sticky' 'jump' 'sleep' 'sun' 'first'
 'grass' 'uncle' 'fish' 'cowboy' 'snow' 'dryer' 'green' 'bug' 'nap' 'feet'
 'yucky' 'morning' 'sad' 'face' 'penny' 'gift' 'night' 'hair' 'who'
 'think' 'brown' 'mad' 'bed' 'drink' 'stay' 'flag' 'tooth' 'awake'
 'thankyou' 'hot' 'like' 'where' 'hesheit' 'potty' 'down' 'stuck' 'no'
 'head' 'food' 'pretty' 'nuts' 'animal' 'frog' 'beside' 'noisy' 'water'
 'weus' 'happy' 'white' 'bye' 'high' 'fine' 'boat' 'all' 'tiger' 'pencil'
 'sleepy' 'grandma' 'chocolate' 'haveto' 'radio' 'farm' 'any' 'zebra'
 'rain' 'toy' 'donkey' 'lion' 'drop' 'many' 'bath' 'aunt' 'will' 'hate'
 'on' 'pretend' 'kitty' 'fireman' 'before' 'doll' 'stairs' 'kiss' 'loud'
 'hen' 'listen' 'give' 'wolf' 'dad' 'gum' 'hear' 'refrigerator' 'outside'
 'cut' 'underwear' 'please' 'child' 'smile' 'pen' 'yesterday' 'horse'
 'pig' 'table' 'eye' 'snack' 'story' 'police' 'arm' 'talk' 'grandpa'
 'tongue' 'pool' 'girl' 'up' 'better' 'tree' 'dance' 'close' 'taste'
 'chin' 'ride' 'because' 'if' 'cat' 'why' 'carrot' 'dog' 'mouse' 'jeans'
 'shower' 'later' 'mom' 'nose' 'yes' 'airplane' 'book' 'blue' 'icecream'
 'garbage' 'tomorrow' 'red' 'cow' 'person' 'puppy' 'cereal' 'touch'
 'mouth' 'boy' 'thirsty' 'make' 'for' 'glasswindow' 'into' 'read' 'every'
 'bedroom' 'napkin' 'ear' 'toothbrush' 'home' 'pajamas' 'hello'
 'helicopter' 'lamp' 'room' 'dirty' 'chair' 'hat' 'elephant' 'after' 'car'
 'hide' 'goose'
```

 Try any one of these and let our model do the prediction!

 Learn from the given below links:
 ([Signs ASL](https://www.signasl.org))
 ([LifePrint](http://www.lifeprint.com/asl101/pages-layout/topics.htm))



Run the Streamlit app:
  ```bash
   streamlit run app.py
  ```
  
Set the duration (in seconds) for capturing the ASL sign.

Click the "Predict Sign" button to capture the sign and receive a prediction.

The captured sign and prediction will be displayed.

## Demo

# Streamlit Interface 
<img width="1434" alt="image" src="https://github.com/pavannn29/ISLRv2/assets/104923000/bbae4483-8fbd-4ce5-b040-f9d4b78fa00d">

# Setting the Duration
<img width="1434" alt="image" src="https://github.com/pavannn29/ISLRv2/assets/104923000/73d361d1-9a79-4912-8f3c-6b33aa78320c">

# Realtime Prediction
<img width="1434" alt="image" src="https://github.com/pavannn29/ISLRv2/assets/104923000/951e4224-3a73-43a8-8c83-483b19c35a84">
<img width="1434" alt="image" src="https://github.com/pavannn29/ISLRv2/assets/104923000/9fef09da-e5ec-46e5-b800-8d0293a6a163">










