// Run this on production server: node fix-video-url.js
// Fixes broken video URL by pointing to existing working video file

const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, 'data', 'videos.json');
const videos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));

// Find all videos with broken URLs (file doesn't exist on disk)
const workingFile = '1777883143525-Introduction_to_Computer.mp4';
const workingUrl = '/uploads/videos/' + workingFile;

let fixed = 0;
videos.forEach(v => {
    if (!v.videoUrl) return;
    const filePath = path.join(__dirname, v.videoUrl.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) {
        console.log(`FIXING: Video ID ${v.id} - "${v.title}"`);
        console.log(`  Old URL: ${v.videoUrl} (file not found)`);
        console.log(`  New URL: ${workingUrl}`);
        v.videoUrl = workingUrl;
        fixed++;
    }
});

if (fixed > 0) {
    fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
    console.log(`\nDone! Fixed ${fixed} video(s).`);
} else {
    console.log('No broken video URLs found.');
}
