// components/sections/constants.tsx
import { MdCamera, MdGesture, MdPsychology, MdOutlineLanguage, MdPrivacyTip, MdOutlineAccessibility } from 'react-icons/md';
import { BsTranslate, BsGlobe2, BsLightningChargeFill, BsPeople, BsPercent, BsHospital } from 'react-icons/bs';
import { HiOutlineSpeakerWave, HiLanguage, HiMiniUserGroup } from 'react-icons/hi2';
import { IoAccessibility, IoRocketSharp, IoEarOutline, IoMedicalOutline, IoEarthOutline, IoExpandOutline, IoContractOutline } from 'react-icons/io5';
import { RiGovernmentLine, RiUserVoiceLine, RiPercentLine } from 'react-icons/ri';
import { BiMicrochip, BiChevronDown } from "react-icons/bi";
import { TbWorldQuestion, TbArrowBigRightFilled, TbDeviceAnalytics, TbBulb } from "react-icons/tb";
import { FiUsers, FiServer } from "react-icons/fi"; // Added the missing import for FiServer and FiUsers

import { TechCardProps } from "@/types";
import React from 'react';

// Tech Stack Items
export const techStackItems: TechCardProps[] = [
  {
    id: "frame-capture",
    Icon: MdCamera,
    name: "Frame Capture",
    description: "Utilizing OpenCV for precise real-time frame capture and processing",
    longDescription: "Our frame capture system utilizes OpenCV to process video input in real-time. It optimizes frame rates while applying preprocessing techniques to enhance quality. The system detects and tracks hands with stable boundary detection, ensuring accurate sign language recognition across varying lighting conditions.",
    videoUrl: "/TechStackVideos/birdoriginal_original.webm",
    demoUrl: "/sign-detection"
  },
  {
    id: "mediapipe",
    Icon: MdGesture,
    name: "Mediapipe Processing",
    description: "Advanced landmark detection for hands, pose, and facial features",
    longDescription: "The MediaPipe Holistic model tracks 543 distinct points across the body: 33 pose landmarks, 468 facial landmarks, and 21 landmarks per hand. This comprehensive tracking enables precise detection of sign language gestures, capturing intricate expressions and movements essential for interpretation.",
    videoUrl: "/TechStackVideos/birdoriginal_landmarks_overlay.webm",
    demoUrl: "/sign-detection"
  },
  {
    id: "ai-model",
    Icon: MdPsychology,
    name: "AI Model",
    description: "87% accurate Transformer model for real-time sign language interpretation",
    longDescription: "Our transformer model achieves 87% accuracy in sign language recognition using multi-layered attention mechanisms. It processes landmark data to analyze spatial relationships between points. The model employs transfer learning and is optimized for low-latency inference, enabling real-time translation of sign gestures.",
    videoUrl: "/TechStackVideos/birdoriginal_landmarks_only.webm",
    demoUrl: "/sign-detection"
  }
];

// Stats Config
export const statsConfig = {
  deafCount: {
    label: "Hearing Impaired",
    color: "hsl(267, 84%, 81%)" // Light purple
  },
  deafDumbCount: {
    label: "Deaf-Mute",
    color: "hsl(330, 100%, 75%)" // Pink
  },
  signLanguageUsers: {
    label: "Sign Language Users",
    color: "hsl(190, 90%, 75%)" // Light blue
  }
};

// Sign Language Words
export const signLanguageWords = [
  "SignEase", // English
  "साइनईज़", // English
  "સાઇનઈઝ",
  "SignEase", // English
  "সাইনইজ", // English
  "साइनईज़",
  "SignEase", // Hindi
  "手話イーズ", // Japanese
  "手语通",
  "SignEase", // Chinese
  "手語易懂", // Traditional Chinese
];

// Partnered Organizations
export const partneredOrganizations = [
  {
    id: 1,
    name: "AURED Mumbai",
    designation: "NGO for Hearing Impaired",
    image: "/assets/partners/aured.png", // https://aured.org/wp-content/uploads/2019/03/aured-logo.jpg
    description: "Supporting deaf children since 1986"
  },
  {
    id: 2,
    name: "National Association of the Deaf",
    designation: "National NGO",
    image: "/assets/partners/nad.png", // https://www.nad.org/wp-content/uploads/2017/02/NAD-logo-color.png
    description: "Leading advocacy organization"
  },
  {
    id: 3,
    name: "Ali Yavar Jung Institute",
    designation: "Educational Institute",
    image: "/assets/partners/ayjnihh.png", // https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Ali_Yavar_Jung_National_Institute_of_Speech_and_Hearing_Disabilities_logo.jpg
    description: "Premier institute for hearing disabilities"
  },
  {
    id: 4,
    name: "Indian Sign Language Research",
    designation: "Research Center",
    image: "/assets/partners/islrtc.png", // http://www.islrtc.nic.in/sites/default/files/islrtc-logo.png
    description: "Advanced sign language research"
  }
];

// Worldwide Stats
export const worldwideStats = [
  {
    region: "World",
    image: "/assets/stats/world-stats.png", // https://www.who.int/images/default-source/infographics/deafness-hearing-loss.png
    stats: [
      { label: "Total Affected", value: "466M", sub: "People worldwide" },
      { label: "Children", value: "34M", sub: "Under age 15" },
      { label: "Annual Cost", value: "$980B", sub: "Economic impact" }
    ]
  },
  {
    region: "Asia Pacific",
    image: "/assets/stats/asia-stats.png", // https://www.who.int/images/default-source/wpro/countries/philippines/infographics/hearing-loss/deaf_hearing-loss_infographic.png
    stats: [
      { label: "Population", value: "248M", sub: "Affected people" },
      { label: "Growth Rate", value: "+5.2%", sub: "Annual increase" },
      { label: "Support Centers", value: "2.8K", sub: "Facilities" }
    ]
  }
];

// Global Impact Stats (Modified to be just data, JSX moved to component)
export const globalImpactStatsData = [
  { value: "70+", label: "Sign Languages", sub: "Worldwide" },
  { value: "300+", label: "Deaf Schools", sub: "Globally" },
  { value: "72M", label: "Sign Language Users", sub: "Worldwide" },
  { value: "155", label: "Countries", sub: "With deaf associations" },
];


// Worldwide Impact Data
export const worldwideImpactData = [
  {
    title: "Sign Languages",
    value: "70+",
    description: "Different sign languages worldwide",
    icon: "/assets/icons/languages.svg",
    gradient: "from-indigo-500/20 to-purple-500/20"
  },
  {
    title: "Educational Institutions",
    value: "300+",
    description: "Schools and universities globally",
    icon: "/assets/icons/education.svg",
    gradient: "from-blue-500/20 to-cyan-500/20"
  },
  {
    title: "Active Users",
    value: "72M",
    description: "Sign language practitioners",
    icon: "/assets/icons/users.svg",
    gradient: "from-emerald-500/20 to-teal-500/20"
  },
  {
    title: "Global Reach",
    value: "155",
    description: "Countries with deaf associations",
    icon: "/assets/icons/globe.svg",
    gradient: "from-rose-500/20 to-pink-500/20"
  }
];

// Community Stories
export const communityStories = [
  {
    id: 1,
    title: "Daily Communication Challenges",
    description: "Experience the everyday struggles faced by deaf individuals in public spaces",
    videoUrl: "https://www.youtube.com/embed/YxzQ8_K8o_E",
    thumbnail: "/assets/videos/daily-struggles.jpg"
  },
  {
    id: 2,
    title: "Education Access Barriers",
    description: "Understanding the challenges in educational institutions",
    videoUrl: "https://www.youtube.com/embed/tYr8N6SPz0g",
    thumbnail: "/assets/videos/education-barriers.jpg"
  },
  {
    id: 3,
    title: "Healthcare Communication Gap",
    description: "Critical challenges faced in medical settings",
    videoUrl: "https://www.youtube.com/embed/vxzGGABAU5E",
    thumbnail: "/assets/videos/healthcare-gap.jpg"
  }
];

// FAQ Items
export const faqItems = [
  // ...other faq items remain the same
  {
    id: "accuracy",
    question: "How accurate is SignEase's recognition system?",
    answer: "SignEase achieves 87% accuracy in recognizing standard ASL (American Sign Language) gestures. The system uses advanced AI that continuously improves through machine learning. For best results, ensure good lighting and clear hand visibility. Our model is trained on diverse users and environments to maximize reliability across different scenarios.",
    icon: <TbDeviceAnalytics className="text-indigo-300" />,
    color: "from-indigo-500/20 to-purple-500/20"
  },
  {
    id: "languages",
    question: "Which sign languages does SignEase support?",
    answer: "Currently, SignEase primarily supports American Sign Language (ASL) with over 250 common signs and phrases. We're actively working to include Indian Sign Language (ISL) in our next release. Our development approach leverages community contributions to help us expand support for additional regional sign language variations in the future.",
    icon: <MdOutlineLanguage className="text-rose-300" />,
    color: "from-rose-500/20 to-pink-500/20"
  },
  {
    id: "technical",
    question: "What are the technical requirements for using SignEase?",
    answer: "SignEase requires a device with a camera (webcam for desktop or front camera for mobile), internet connection, and a modern web browser with JavaScript enabled. We recommend Chrome, Firefox, or Safari for optimal performance. For best recognition results, use a camera with at least 720p resolution in a well-lit environment without strong backlighting.",
    icon: <BiMicrochip className="text-blue-300" />,
    color: "from-blue-500/20 to-teal-500/20"
  },
  {
    id: "offline",
    question: "Does SignEase work offline or in low-connectivity areas?",
    answer: "SignEase requires an internet connection for initial loading, but our technology is designed to minimize data usage afterward. Once loaded, the core recognition runs locally in your browser using TensorFlow.js, requiring minimal bandwidth. We're developing a progressive web app (PWA) version for improved offline capabilities in rural and low-connectivity areas.",
    icon: <FiServer className="text-amber-300" />,
    color: "from-amber-500/20 to-yellow-500/20"
  },
  {
    id: "privacy",
    question: "How does SignEase handle privacy and data security?",
    answer: "Your privacy is our priority. Video processing happens entirely on your device without sending footage to external servers. We only store anonymized gesture data (with explicit consent) to improve our recognition model. No personally identifiable information is collected unless you opt into our feedback program. SignEase complies with GDPR and other international privacy standards.",
    icon: <MdPrivacyTip className="text-emerald-300" />,
    color: "from-emerald-500/20 to-green-500/20"
  },
  {
    id: "accessibility",
    question: "Is SignEase accessible for people with additional disabilities?",
    answer: "Yes, we've designed SignEase with universal accessibility in mind. The interface includes high-contrast options, screen reader compatibility, and customizable text sizes. For users with motor impairments, we offer voice commands to control the application. We continually work with accessibility experts to ensure our platform is usable by everyone, regardless of ability.",
    icon: <MdOutlineAccessibility className="text-sky-300" />,
    color: "from-sky-500/20 to-cyan-500/20"
  },
  {
    id: "community",
    question: "How can I contribute to the SignEase community?",
    answer: "Join our growing community! You can contribute by providing feedback, reporting issues, or suggesting improvements. If you're a developer, check out our GitHub repository to contribute code. For sign language experts, help us improve our dataset by submitting sign variations. Visit our Community page to connect with other users, share experiences, and participate in our improvement initiatives.",
    icon: <FiUsers className="text-violet-300" />,
    color: "from-violet-500/20 to-purple-500/20"
  },
  {
    id: "future",
    question: "What's on SignEase's feature roadmap?",
    answer: "We're excited about our upcoming features! Our primary focus is expanding language support through a phased approach. After completing our Indian Sign Language (ISL) integration, we plan to add British Sign Language (BSL) and other regional variations. We're also developing a machine learning pipeline that can more efficiently incorporate new sign languages based on community contributions, allowing us to scale to additional languages faster in the future.",
    icon: <TbBulb className="text-orange-300" />,
    color: "from-orange-500/20 to-red-500/20"
  },
];

// India Severity Data for Pie Chart
export const indiaSeverityData = [
  { name: 'Profound Loss', value: 32, color: 'hsl(330, 100%, 70%)' },
  { name: 'Severe Loss', value: 39, color: 'hsl(267, 84%, 75%)' },
  { name: 'Moderate/Mild', value: 29, color: 'hsl(214, 84%, 75%)' },
];

// Global Age Data for Pie Chart (Example Data - not used in original file, can be removed if not needed)
export const globalAgeData = [
  { name: 'Over 60', value: 25, color: '#8884d8' },
  { name: 'Under 60', value: 75, color: '#82ca9d' },
];