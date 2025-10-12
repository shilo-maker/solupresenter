require('dotenv').config();
const mongoose = require('mongoose');
const Song = require('../models/Song');
const User = require('../models/User');

const sampleSongs = [
  {
    title: "Forever Faithful",
    originalLanguage: "en",
    tags: ["praise", "worship", "faithfulness"],
    slides: [
      {
        originalText: "You are forever faithful",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Your love will never fail",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Through every season, every trial",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Your promises remain",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "I will trust in You alone",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "My rock, my hope, my home",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      }
    ]
  },
  {
    title: "Light of the World",
    originalLanguage: "en",
    tags: ["jesus", "light", "hope"],
    slides: [
      {
        originalText: "You are the light of the world",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Shining in the darkness",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Breaking every chain",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Setting captives free",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Jesus, You're the light",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "That guides my way",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      }
    ]
  },
  {
    title: "Grace Unending",
    originalLanguage: "en",
    tags: ["grace", "mercy", "love"],
    slides: [
      {
        originalText: "Your grace is unending",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Your mercy flows like rain",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "You wash away my shame",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "And call me by Your name",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "I am Yours, forever Yours",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Covered by Your grace",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      }
    ]
  },
  {
    title: "Holy Spirit Come",
    originalLanguage: "en",
    tags: ["holy spirit", "presence", "worship"],
    slides: [
      {
        originalText: "Holy Spirit, come",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Fill this place with Your presence",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Move among us now",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Let Your power fall",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "We welcome You",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Spirit of the living God",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      }
    ]
  },
  {
    title: "King of Glory",
    originalLanguage: "en",
    tags: ["glory", "majesty", "praise"],
    slides: [
      {
        originalText: "King of glory, reign forever",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Lord of heaven and earth",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Every knee will bow before You",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Every tongue confess",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "You are worthy, so worthy",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      },
      {
        originalText: "Of all our praise",
        transliteration: "",
        translation: "",
        translationOverflow: ""
      }
    ]
  }
];

async function addSongs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('No admin user found. Please create an admin first.');
      process.exit(1);
    }

    console.log(`Adding songs as user: ${admin.email}\n`);

    // Add each song
    for (const songData of sampleSongs) {
      const existingSong = await Song.findOne({ title: songData.title });

      if (existingSong) {
        console.log(`⚠️  Song "${songData.title}" already exists, skipping...`);
        continue;
      }

      const song = await Song.create({
        ...songData,
        createdBy: admin._id,
        isPublic: true,
        isPendingApproval: false
      });

      console.log(`✅ Added: "${song.title}" (${song.slides.length} slides)`);
    }

    console.log('\n✨ All songs added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding songs:', error);
    process.exit(1);
  }
}

addSongs();
