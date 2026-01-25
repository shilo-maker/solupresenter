/**
 * Song Matching Script - SoluFlow <-> SoluPresenter
 *
 * This script analyzes songs from both databases and suggests matches
 * based on title and lyrics similarity.
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// SoluPresenter PRODUCTION database (PostgreSQL on Render)
const presenterDb = new Sequelize(
  'postgresql://solupresenter:smPu937tBbkjPO7UVFffuXsxyK7VSUKu@dpg-d48d283uibrs73968v2g-a.frankfurt-postgres.render.com/solupresenter',
  {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    }
  }
);

// SoluFlow PRODUCTION database (PostgreSQL on Render)
const flowDb = new Sequelize(
  'postgresql://soluflow_2lzn_user:33ENrqD3QhoPlR8lktBPu0HaGoR7pSu1@dpg-d46aah6mcj7s73b4g7n0-a.frankfurt-postgres.render.com/soluflow_2lzn',
  {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    }
  }
);

// Define models for reading
const PresenterSong = presenterDb.define('Song', {
  id: { type: DataTypes.UUID, primaryKey: true },
  title: DataTypes.STRING,
  slides: DataTypes.JSON,
  originalLanguage: DataTypes.STRING
}, { tableName: 'songs', timestamps: false });

const FlowSong = flowDb.define('Song', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  title: DataTypes.STRING,
  content: DataTypes.TEXT,
  workspace_id: DataTypes.INTEGER
}, { tableName: 'songs', timestamps: false });

/**
 * Strip ChordPro chords from content to get pure lyrics
 * [Am]Hello [G]world -> Hello world
 */
function stripChords(chordProContent) {
  if (!chordProContent) return '';
  // Remove chord annotations [X], [Xm], [X7], etc.
  return chordProContent
    .replace(/\[([A-Ga-g][#b]?)(m|maj|min|dim|aug|sus|add|7|9|11|13)*[^\]]*\]/g, '')
    .replace(/\{[^}]+\}/g, '') // Remove ChordPro directives like {title:...}
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract all lyrics from SoluPresenter slides
 */
function extractPresenterLyrics(slides) {
  if (!slides || !Array.isArray(slides)) return '';
  return slides
    .map(slide => slide.originalText || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize text for comparison (remove punctuation, lowercase, normalize spaces)
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\u0590-\u05FF\u0041-\u007Aa-zA-Z0-9\s]/g, '') // Keep Hebrew, English, numbers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Calculate similarity percentage between two strings (0-100)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 && !str2) return 100;
  if (!str1 || !str2) return 0;

  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  if (norm1 === norm2) return 100;
  if (!norm1 || !norm2) return 0;

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(norm1, norm2);
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Calculate overall match score between a SoluFlow song and SoluPresenter song
 */
function calculateMatchScore(flowSong, presenterSong) {
  const flowLyrics = stripChords(flowSong.content);
  const presenterLyrics = extractPresenterLyrics(presenterSong.slides);

  const titleSimilarity = calculateSimilarity(flowSong.title, presenterSong.title);
  const lyricsSimilarity = calculateSimilarity(flowLyrics, presenterLyrics);

  // Weight: 40% title, 60% lyrics
  const overallScore = Math.round(titleSimilarity * 0.4 + lyricsSimilarity * 0.6);

  return {
    titleSimilarity,
    lyricsSimilarity,
    overallScore
  };
}

async function main() {
  try {
    console.log('Connecting to databases...\n');

    await presenterDb.authenticate();
    console.log('✓ Connected to SoluPresenter database');

    await flowDb.authenticate();
    console.log('✓ Connected to SoluFlow database\n');

    // Fetch all songs
    const presenterSongs = await PresenterSong.findAll();
    const flowSongs = await FlowSong.findAll();

    console.log(`Found ${presenterSongs.length} songs in SoluPresenter`);
    console.log(`Found ${flowSongs.length} songs in SoluFlow\n`);

    // Find matches
    const matches = [];

    for (const flowSong of flowSongs) {
      const songMatches = [];

      for (const presenterSong of presenterSongs) {
        const score = calculateMatchScore(flowSong, presenterSong);

        if (score.overallScore >= 50) {
          songMatches.push({
            flowSong: {
              id: flowSong.id,
              title: flowSong.title,
              workspace_id: flowSong.workspace_id
            },
            presenterSong: {
              id: presenterSong.id,
              title: presenterSong.title
            },
            ...score
          });
        }
      }

      // Sort by score descending and take the best match
      songMatches.sort((a, b) => b.overallScore - a.overallScore);

      if (songMatches.length > 0) {
        matches.push(songMatches[0]);
      }
    }

    // Sort all matches by score
    matches.sort((a, b) => b.overallScore - a.overallScore);

    // Group by confidence level
    const highConfidence = matches.filter(m => m.overallScore >= 90);
    const mediumConfidence = matches.filter(m => m.overallScore >= 70 && m.overallScore < 90);
    const lowConfidence = matches.filter(m => m.overallScore >= 50 && m.overallScore < 70);

    console.log('='.repeat(80));
    console.log('SONG MATCHING RESULTS');
    console.log('='.repeat(80));

    console.log(`\n🟢 HIGH CONFIDENCE (90%+): ${highConfidence.length} matches`);
    console.log('-'.repeat(80));
    highConfidence.forEach((m, i) => {
      console.log(`${i + 1}. [${m.overallScore}%] "${m.flowSong.title}" <-> "${m.presenterSong.title}"`);
      console.log(`   Title: ${m.titleSimilarity}% | Lyrics: ${m.lyricsSimilarity}%`);
      console.log(`   Flow ID: ${m.flowSong.id} | Presenter ID: ${m.presenterSong.id}`);
    });

    console.log(`\n🟡 MEDIUM CONFIDENCE (70-89%): ${mediumConfidence.length} matches`);
    console.log('-'.repeat(80));
    mediumConfidence.forEach((m, i) => {
      console.log(`${i + 1}. [${m.overallScore}%] "${m.flowSong.title}" <-> "${m.presenterSong.title}"`);
      console.log(`   Title: ${m.titleSimilarity}% | Lyrics: ${m.lyricsSimilarity}%`);
      console.log(`   Flow ID: ${m.flowSong.id} | Presenter ID: ${m.presenterSong.id}`);
    });

    console.log(`\n🟠 LOW CONFIDENCE (50-69%): ${lowConfidence.length} matches`);
    console.log('-'.repeat(80));
    lowConfidence.forEach((m, i) => {
      console.log(`${i + 1}. [${m.overallScore}%] "${m.flowSong.title}" <-> "${m.presenterSong.title}"`);
      console.log(`   Title: ${m.titleSimilarity}% | Lyrics: ${m.lyricsSimilarity}%`);
      console.log(`   Flow ID: ${m.flowSong.id} | Presenter ID: ${m.presenterSong.id}`);
    });

    // Summary
    const unmatchedFlow = flowSongs.length - matches.length;
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total SoluFlow songs: ${flowSongs.length}`);
    console.log(`Total SoluPresenter songs: ${presenterSongs.length}`);
    console.log(`Potential matches found: ${matches.length}`);
    console.log(`Unmatched SoluFlow songs: ${unmatchedFlow}`);

    // Save results to JSON for further processing
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        flowSongsCount: flowSongs.length,
        presenterSongsCount: presenterSongs.length,
        highConfidenceCount: highConfidence.length,
        mediumConfidenceCount: mediumConfidence.length,
        lowConfidenceCount: lowConfidence.length,
        unmatchedCount: unmatchedFlow
      },
      highConfidence,
      mediumConfidence,
      lowConfidence
    };

    const fs = require('fs');
    const outputPath = path.join(__dirname, 'song-matches.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await presenterDb.close();
    await flowDb.close();
  }
}

main();
