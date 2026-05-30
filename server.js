require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const qrcode = require('qrcode');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const unzipper = require('unzipper');
const speakeasy = require('speakeasy');
const xlsx = require('xlsx');
const imageSize = require('image-size');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// XSS sanitization helper
function sanitizeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}

const app = express();
const PORT = 3000;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const CALENDAR_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
const CALENDAR_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GMB_LOCATION_ID = process.env.GMB_LOCATION_ID || '';
const GMB_SERVICE_ACCOUNT_KEY_PATH = process.env.GMB_SERVICE_ACCOUNT_KEY_PATH || '';

// Global formatDate function for DD-MMM-YYYY format (with month name)
function formatDate(date) {
    if (!date) return '';
    try {
        let d = new Date(date);
        // If date is in DD/MM/YYYY format, parse it correctly
        if (typeof date === 'string' && date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
                // Check if it's DD/MM/YYYY format
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
                const year = parseInt(parts[2]);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    d = new Date(year, month, day);
                }
            }
        }
        if (isNaN(d)) return date;
        const day = String(d.getDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[d.getMonth()];
        const year = String(d.getFullYear());
        return `${day}-${month}-${year}`;
    } catch { return date; }
}

// Input validation middleware
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

// Middleware
// CORS configuration - restrict to specific origins
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.31.12:3000',
    'http://localhost',
    'http://127.0.0.1'
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy: This origin is not allowed'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Trust first proxy (nginx) — required for correct client IP behind reverse proxy
app.set('trust proxy', 1);

// Security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for now as it may break inline scripts
    crossOriginEmbedderPolicy: false
}));

// Rate limiting for API endpoints
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Limit each IP to 2000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/login', authLimiter);
app.use('/api/admin-login', authLimiter);

// Handle preflight requests
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Root route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Session configuration
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport session serialization
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Google Calendar OAuth Configuration
const calendarOAuth2Client = (CALENDAR_CLIENT_ID && CALENDAR_CLIENT_SECRET)
    ? new google.auth.OAuth2(
        CALENDAR_CLIENT_ID,
        CALENDAR_CLIENT_SECRET,
        'http://localhost:3000/admin/calendar-callback'
    )
    : null;

// Store access token in session (for simplicity)
let calendarAccessToken = null;

// Calendar API client
const calendar = calendarOAuth2Client
    ? google.calendar({ version: 'v3', auth: calendarOAuth2Client })
    : null;

// Google Calendar OAuth Routes
app.get('/admin/calendar-auth', (req, res) => {
    if (!calendarOAuth2Client) {
        return res.status(503).json({ success: false, message: 'Google Calendar not configured on server' });
    }
    const authUrl = calendarOAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    });
    res.redirect(authUrl);
});

app.get('/admin/calendar-callback', async (req, res) => {
    if (!calendarOAuth2Client) {
        return res.redirect('/admin.html?page=attendance&calendar=error');
    }
    const { code } = req.query;
    try {
        const { tokens } = await calendarOAuth2Client.getToken(code);
        calendarOAuth2Client.setCredentials(tokens);
        calendarAccessToken = tokens.access_token;
        res.redirect('/admin.html?page=attendance&calendar=connected');
    } catch (error) {
        console.error('Error getting calendar tokens:', error);
        res.redirect('/admin.html?page=attendance&calendar=error');
    }
});

// --- Google Calendar Integration ---
app.get('/api/calendar/events', async (req, res) => {
    try {
        if (!calendarOAuth2Client || !calendar) {
            return res.status(503).json({ success: false, message: 'Google Calendar not configured' });
        }
        if (!calendarAccessToken) {
            return res.status(401).json({ success: false, message: 'Calendar not authenticated' });
        }
        
        const { startDate, endDate } = req.query;
        const timeMin = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
        const timeMax = endDate ? new Date(endDate).toISOString() : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();
        
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        const events = response.data.items.map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start.date || event.start.dateTime,
            end: event.end.date || event.end.dateTime,
            allDay: !!event.start.date
        }));
        
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch calendar events', error: error.message });
    }
});

app.get('/api/calendar/holidays', async (req, res) => {
    try {
        if (!calendarOAuth2Client || !calendar) {
            return res.status(503).json({ success: false, message: 'Google Calendar not configured' });
        }
        if (!calendarAccessToken) {
            return res.status(401).json({ success: false, message: 'Calendar not authenticated' });
        }
        
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        
        // Fetch events for the entire year
        const timeMin = new Date(currentYear, 0, 1).toISOString();
        const timeMax = new Date(currentYear, 11, 31).toISOString();
        
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            q: 'holiday' // Search for events containing "holiday"
        });
        
        const holidays = response.data.items.map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            date: event.start.date || event.start.dateTime,
            allDay: !!event.start.date
        }));
        
        res.json({ success: true, holidays });
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch holidays', error: error.message });
    }
});

app.get('/api/calendar/auth-status', (req, res) => {
    res.json({ success: true, authenticated: !!calendarAccessToken });
});

// Google OAuth Strategy for Students/Faculty (only when configured)
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use('google-student', new GoogleStrategy({
        name: 'google-student',
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: (process.env.BASE_URL || 'http://localhost:3000') + '/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
        const students = readData('students.json') || [];
        let student = students.find(s => s.email === profile.emails[0].value);

        if (!student) {
            student = {
                id: Date.now(),
                name: profile.displayName,
                email: profile.emails[0].value,
                phone: '',
                googleId: profile.id,
                course: '',
                batch: '',
                status: 'Pending',
                fees: { totalFees: 0, paidAmount: 0, dueAmount: 0, payments: [] },
                loginPassword: Math.random().toString(36).substring(2, 10).toUpperCase()
            };
            students.push(student);
            writeData('students.json', students);
        } else if (!student.googleId) {
            student.googleId = profile.id;
            writeData('students.json', students);
        }

        return done(null, student);
    }));

    passport.use('google-faculty', new GoogleStrategy({
        name: 'google-faculty',
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: (process.env.BASE_URL || 'http://localhost:3000') + '/auth/google/faculty/callback'
    },
    (accessToken, refreshToken, profile, done) => {
        const faculty = readData('faculty.json') || [];
        const user = faculty.find(f => f.email === profile.emails[0].value);

        if (!user) {
            return done(new Error('Faculty not found'), null);
        }

        done(null, user);
    }));
}

// Create directories
['uploads','uploads/gallery','uploads/logo','uploads/carousel','uploads/students/photos','uploads/students/signatures','uploads/students/documents','uploads/notices','uploads/videos','uploads/thumbnails','uploads/assignments','uploads/bulk-uploads','uploads/study-materials','uploads/alumni','uploads/video-resources','data'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Data file helper
function readData(file) {
    const filePath = path.join(__dirname, 'data', file);
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`[readData] Failed to parse ${file}:`, e.message);
        return null;
    }
}

function writeData(file, data) {
    const filePath = path.join(__dirname, 'data', file);
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, filePath);
}

function createStudentSession(studentId, req) {
    const sessions = readData('student-sessions.json') || [];
    const token = require('crypto').randomBytes(24).toString('hex');
    const now = new Date().toISOString();
    // Keep existing sessions so multiple tabs/devices stay logged in.
    // Cap at 10 most-recent sessions per student to avoid unbounded growth.
    const mine = sessions
        .filter(s => String(s.studentId) === String(studentId))
        .sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0))
        .slice(0, 9);
    const others = sessions.filter(s => String(s.studentId) !== String(studentId));
    const next = [...others, ...mine];
    next.push({
        studentId: String(studentId),
        token,
        lastSeen: now,
        userAgent: req.headers['user-agent'] || '',
        ip: req.ip || ''
    });
    writeData('student-sessions.json', next);
    return token;
}

function getStudentSessionToken(req) {
    return req.headers['x-session-token'] || req.query.sessionToken || req.body.sessionToken || '';
}

function ensureStudentSession(req, res, studentId) {
    const token = getStudentSessionToken(req);
    if (!token) {
        res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
        return false;
    }

    const sessions = readData('student-sessions.json') || [];
    let record = sessions.find(s => String(s.studentId) === String(studentId) && s.token === token);
    
    if (!record) {
        // Auto-recover: token not in file (e.g. server restart) → re-create it.
        // Session only truly ends on explicit logout.
        record = {
            studentId: String(studentId),
            token,
            lastSeen: new Date().toISOString(),
            userAgent: req.headers['user-agent'] || '',
            ip: req.ip || ''
        };
        sessions.push(record);
    }

    record.lastSeen = new Date().toISOString();
    writeData('student-sessions.json', sessions);
    return true;
}

function isVideoSingleSessionBlocked(studentId, videoId) {
    const locks = readData('video-active-sessions.json') || [];
    const now = Date.now();
    const activeWindowMs = 2 * 60 * 1000;
    const current = locks.find(l => String(l.studentId) === String(studentId));
    if (!current) return false;

    const lastSeen = new Date(current.lastSeen || 0).getTime();
    const stillActive = !Number.isNaN(lastSeen) && (now - lastSeen) <= activeWindowMs;
    return stillActive && String(current.videoId) !== String(videoId);
}

function touchVideoSingleSession(studentId, videoId) {
    const locks = readData('video-active-sessions.json') || [];
    const filtered = locks.filter(l => String(l.studentId) !== String(studentId));
    filtered.push({ studentId: String(studentId), videoId: String(videoId), lastSeen: new Date().toISOString() });
    writeData('video-active-sessions.json', filtered);
}

// Initialize default data
function initData() {
    if (!readData('courses.json')) {
        writeData('courses.json', [
            { id: 1, name: 'Basic Computer Course', duration: '1 Month', fee: 2500, feeType: 'Per Program', description: 'Computer basics, MS Office, Internet' },
            { id: 2, name: 'Tally Prime with GST', duration: '2 Months', fee: 4500, feeType: 'Per Program', description: 'Accounting with GST using Tally Prime' },
            { id: 3, name: 'Web Development', duration: '3 Months', fee: 8000, feeType: 'Per Program', description: 'HTML, CSS, JavaScript, Bootstrap' },
            { id: 4, name: 'Python Programming', duration: '2 Months', fee: 6000, feeType: 'Per Program', description: 'Python basics to advanced' },
            { id: 5, name: 'Graphic Design', duration: '2 Months', fee: 5500, feeType: 'Per Program', description: 'Photoshop, Illustrator, Canva' },
            { id: 6, name: 'Digital Marketing', duration: '1 Month', fee: 4000, feeType: 'Per Program', description: 'SEO, Social Media, Email Marketing' }
        ]);
    }
    if (!readData('faculty.json')) {
        writeData('faculty.json', [
            { id: 1, name: 'Rahul Sharma', subject: 'Web Development', experience: '8 Years' },
            { id: 2, name: 'Priya Gupta', subject: 'Tally & Accounting', experience: '6 Years' },
            { id: 3, name: 'Amit Kumar', subject: 'Programming', experience: '10 Years' },
            { id: 4, name: 'Sneha Patel', subject: 'Graphic Design', experience: '5 Years' }
        ]);
    }
    if (!readData('gallery.json')) writeData('gallery.json', []);
    if (!readData('enquiries.json')) writeData('enquiries.json', []);
    if (!readData('settings.json')) {
        writeData('settings.json', {
            name: 'Genius Computer Education',
            phone: '+91 98765 43210',
            email: 'info@geniuseducation.com',
            address: 'Main Road, Near Bus Stand',
            logo: ''
        });
    }
    if (!readData('carousel.json')) writeData('carousel.json', []);
    if (!readData('students.json')) writeData('students.json', []);
    if (!readData('notices.json')) writeData('notices.json', []);
    if (!readData('batches.json')) writeData('batches.json', []);
    if (!readData('about.json')) {
        writeData('about.json', {
            description: 'Genius Computer Education 10+ saal se quality computer education de raha hai. Hamare yahan experienced faculty, modern lab, aur industry-relevant courses hain.',
            mapUrl: ''
        });
    }
    if (!readData('payments.json')) writeData('payments.json', []);
    // Don't overwrite notifications.json if it exists
    // if (!readData('notifications.json')) writeData('notifications.json', []);
    if (!readData('announcements.json')) writeData('announcements.json', []);
    if (!readData('tests.json')) writeData('tests.json', []);
    if (!readData('attendance.json')) writeData('attendance.json', []);
    if (!readData('study-materials.json')) writeData('study-materials.json', []);
    if (!readData('exam-results.json')) writeData('exam-results.json', []);
    if (!readData('certificates.json')) writeData('certificates.json', []);
    if (!readData('chapters.json')) writeData('chapters.json', []);
}
initData();

// ---- Student helpers ----
function generateRollNo() {
    const students = readData('students.json') || [];
    const year = new Date().getFullYear();
    const count = students.filter(s => s.rollNo && s.rollNo.includes(`-${year}-`)).length + 1;
    return `GCE-${year}-${String(count).padStart(3, '0')}`;
}

// Application ID: GCE-APP-YYYY-NNNN (sequential per year)
function generateApplicationId() {
    const students = readData('students.json') || [];
    const year = new Date().getFullYear();
    const prefix = `GCE-APP-${year}-`;
    const count = students.filter(s => s.applicationId && s.applicationId.startsWith(prefix)).length + 1;
    return `${prefix}${String(count).padStart(4, '0')}`;
}

// Receipt No: RCP-YYYY-NNNNNN (sequential across all payments per year)
function generateReceiptNo() {
    const students = readData('students.json') || [];
    const year = new Date().getFullYear();
    const prefix = `RCP-${year}-`;
    let count = 0;
    students.forEach(s => {
        const pays = s.fees && Array.isArray(s.fees.payments) ? s.fees.payments : [];
        pays.forEach(p => { if (p.receipt && p.receipt.startsWith(prefix)) count++; });
    });
    return `${prefix}${String(count + 1).padStart(6, '0')}`;
}

// ---- Activity Log Helper ----
function logActivity(action, actor, details, req) {
    try {
        const logs = readData('activity-logs.json') || [];
        logs.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            timestamp: new Date().toISOString(),
            action: action || '',
            actorType: (actor && actor.type) || 'public',
            actorId: (actor && actor.id) || '',
            actorName: (actor && actor.name) || '',
            details: details || {},
            ip: (req && (req.headers['x-forwarded-for'] || req.ip)) || '',
            userAgent: (req && req.headers && req.headers['user-agent']) || ''
        });
        // Cap at last 5000 logs
        if (logs.length > 5000) logs.splice(0, logs.length - 5000);
        writeData('activity-logs.json', logs);
    } catch (e) { console.error('logActivity error:', e); }
}

// ---- Email logo helper (returns CID embed + attachment for reliable rendering in mail clients) ----
function getEmailLogo(settings, style = 'max-height:60px;') {
    settings = settings || readData('settings.json') || {};
    if (!settings.logo) return { html: '', attachments: [] };
    
    // settings.logo is like '/uploads/logo/xxx.png' - resolve to absolute path
    const relPath = settings.logo.startsWith('/') ? settings.logo.slice(1) : settings.logo;
    const absPath = path.join(__dirname, 'public', relPath);
    const altPath = path.join(__dirname, relPath);
    let logoPath = null;
    if (fs.existsSync(absPath)) logoPath = absPath;
    else if (fs.existsSync(altPath)) logoPath = altPath;
    
    if (!logoPath) return { html: '', attachments: [] };
    
    const ext = path.extname(logoPath).slice(1).toLowerCase() || 'png';
    const cid = 'institute-logo';
    return {
        html: `<img src="cid:${cid}" style="${style}" alt="Logo">`,
        attachments: [{
            filename: `logo.${ext}`,
            path: logoPath,
            cid: cid
        }]
    };
}

// ---- Monkey-patch nodemailer.createTransport to auto-inject institute logo in every email ----
(function patchNodemailerForLogo() {
    const _origCreateTransport = nodemailer.createTransport.bind(nodemailer);
    nodemailer.createTransport = function(...args) {
        const transporter = _origCreateTransport(...args);
        const origSendMail = transporter.sendMail.bind(transporter);
        transporter.sendMail = function(options, callback) {
            try {
                const settings = readData('settings.json') || {};
                const instName = settings.name || 'Genius Computer Education';
                const logoInfo = getEmailLogo(settings, 'max-height:60px;display:block;margin:0 auto;');
                
                // Only inject if options.html exists, logo is configured, and logo not already present
                if (logoInfo.html && options && options.html && !/cid:institute-logo/.test(options.html)) {
                    const headerHtml = `<div style="text-align:center;padding:22px 20px;background:linear-gradient(135deg,#1e3a8a,#2563eb);border-bottom:3px solid #1e40af;margin-bottom:0;">
                        ${logoInfo.html}
                        <div style="margin-top:10px;color:#fff;font-weight:700;font-size:18px;letter-spacing:0.5px;">${instName}</div>
                        ${settings.tagline ? `<div style="margin-top:4px;color:#dbeafe;font-size:12px;">${settings.tagline}</div>` : ''}
                    </div>`;
                    options.html = headerHtml + options.html;
                    options.attachments = [...(options.attachments || []), ...logoInfo.attachments];
                }
            } catch (e) {
                console.warn('[EmailLogo] Auto-inject skipped:', e.message);
            }
            return origSendMail(options, callback);
        };
        return transporter;
    };
})();

function generateSlipHTML(student, settings, payment, logoOverrideHtml) {
    const inst = settings.name || 'Genius Computer Education';
    const addr = settings.address || '';
    const phone = settings.phone || '';
    const logo = logoOverrideHtml !== undefined
        ? logoOverrideHtml
        : (settings.logo ? `<img src="http://localhost:3000${settings.logo}" style="max-height:55px;">` : '');
    const p = payment || (student.fees.payments && student.fees.payments[student.fees.payments.length - 1]);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Admission Slip - ${student.rollNo}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;color:#333;background:#fff;}
.header{background:#2563eb;color:#fff;padding:18px 30px;display:flex;justify-content:space-between;align-items:center;}
.header-left{display:flex;align-items:center;gap:15px;}.header h2{font-size:1.35rem;}.header p{font-size:0.8rem;opacity:.9;margin-top:3px;}
.badge{background:#1d4ed8;padding:7px 18px;border-radius:6px;font-weight:bold;font-size:0.85rem;letter-spacing:1px;}
.body{padding:22px 30px;}.roll{display:inline-block;background:#eff6ff;border:2px solid #2563eb;color:#2563eb;padding:7px 20px;border-radius:8px;font-size:1.05rem;font-weight:bold;margin-bottom:18px;}
h3{color:#2563eb;font-size:.95rem;margin:18px 0 8px;border-bottom:2px solid #e5e7eb;padding-bottom:5px;}
table{width:100%;border-collapse:collapse;margin-bottom:12px;}td,th{padding:8px 12px;border:1px solid #e5e7eb;font-size:.88rem;}
th{background:#f8fafc;font-weight:600;width:30%;color:#555;}
.green{color:#16a34a;font-weight:bold;}.orange{color:#d97706;font-weight:bold;}.big{font-size:1.1rem;font-weight:bold;}
.b-green{background:#dcfce7;color:#16a34a;padding:2px 10px;border-radius:20px;font-size:.8rem;font-weight:bold;}
.b-orange{background:#fef3c7;color:#d97706;padding:2px 10px;border-radius:20px;font-size:.8rem;font-weight:bold;}
.sigs{display:flex;justify-content:space-between;margin-top:45px;padding:0 20px;}
.sig-box{text-align:center;width:180px;}.sig-line{border-top:1.5px solid #333;padding-top:7px;font-size:.83rem;color:#555;}
.footer{background:#f8fafc;border-top:1px solid #e5e7eb;padding:10px 30px;text-align:center;font-size:.78rem;color:#888;margin-top:15px;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body>
<div class="header"><div class="header-left"><div><h2>${inst}</h2><p>${addr}${phone ? ' | ' + phone : ''}</p></div></div><div class="badge">ADMISSION SLIP</div></div>
<div class="body">
<div class="roll">&#127891; Roll No: ${student.rollNo}</div>
<h3>Student Information</h3>
<table><tr><th>Full Name</th><td><strong>${student.name}</strong></td><th>Date of Birth</th><td>${student.dob || '-'}</td></tr>
<tr><th>Phone</th><td>${student.phone}</td><th>Email</th><td>${student.email || '-'}</td></tr>
<tr><th>Father / Guardian</th><td>${student.fatherName || student.parentName || '-'}</td><th>Guardian Phone</th><td>${student.fatherPhone || student.parentPhone || '-'}</td></tr>
<tr><th>Address</th><td colspan="3">${student.address || '-'}</td></tr></table>
<h3>Course Details</h3>
<table><tr><th>Course</th><td><strong>${student.course}</strong></td><th>Batch</th><td>${student.batch || '-'}</td></tr>
<tr><th>Admission Date</th><td>${student.admissionDate}</td><th>Status</th><td><span class="b-green">${student.status}</span></td></tr></table>
<h3>Fee Summary</h3>
<table><tr><th>Total Fees</th><td class="big">&#8377;${student.fees.totalFees}</td><th>Paid Amount</th><td class="big green">&#8377;${student.fees.paidAmount}</td></tr>
<tr><th>Pending Amount</th><td class="big ${student.fees.dueAmount > 0 ? 'orange' : 'green'}">&#8377;${student.fees.dueAmount}</td><th>Fee Status</th><td>${student.fees.dueAmount > 0 ? '<span class="b-orange">Pending</span>' : '<span class="b-green">Fully Paid</span>'}</td></tr></table>
${p ? `<h3>Payment Details</h3><table><tr><th>Receipt No.</th><td>${p.receipt}</td><th>Date</th><td>${p.date}</td></tr>
<tr><th>Amount Paid</th><td class="big green">&#8377;${p.amount}</td><th>Payment Mode</th><td>${p.mode}</td></tr>
<tr><th>Payment Type</th><td>${p.type}</td><th>Transaction ID</th><td>${p.transactionId || '-'}</td></tr></table>` : ''}
<div class="sigs">
<div class="sig-box">${student.signature ? `<img src="http://localhost:3000${student.signature}" style="max-height:48px;display:block;margin:0 auto 8px;">` : '<div style="height:48px;"></div>'}<div class="sig-line">Student Signature</div></div>
<div class="sig-box"><div style="height:48px;"></div><div class="sig-line">Authorized Signature &amp; Stamp</div></div>
</div></div>
<div class="footer">This is a computer generated slip &mdash; ${inst}</div>
</body></html>`;
}

async function sendSlipEmail(student, payment, type = 'admission') {
    const settings = readData('settings.json') || {};
    const smtpUser = process.env.SMTP_USER || settings.smtpUser;
    const smtpPass = process.env.SMTP_PASS || settings.smtpPass;
    const smtpHost = process.env.SMTP_HOST || settings.smtpHost || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT) || parseInt(settings.smtpPort) || 465;
    const smtpSecure = process.env.SMTP_SECURE === 'true' || settings.smtpSecure !== false;
    
    if (!smtpUser || !smtpPass) throw new Error('Email (SMTP) settings configure karo pehle - Settings > Email Configuration.');
    
    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
    });
    const logoInfo = getEmailLogo(settings, 'max-height:55px;');
    const html = generateSlipHTML(student, settings, payment, logoInfo.html);
    const inst = settings.name || 'Genius Computer Education';
    await transporter.sendMail({
        from: `"${inst}" <${smtpUser}>`,
        to: student.email,
        subject: type === 'admission' ? `Admission Confirmed - ${student.rollNo} | ${inst}` : `Payment Receipt - ${student.rollNo} | ${inst}`,
        html,
        attachments: logoInfo.attachments
    });
}

// Multer config for gallery images
const galleryStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/gallery'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const carouselStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/carousel'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/logo'),
    filename: (req, file, cb) => cb(null, 'logo' + path.extname(file.originalname))
});

const uploadGallery = multer({
    storage: galleryStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const types = /jpeg|jpg|png|gif|webp/;
        const ext = types.test(path.extname(file.originalname).toLowerCase());
        const mime = types.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only image files allowed!'));
    }
});

const uploadCarousel = multer({
    storage: carouselStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const types = /jpeg|jpg|png|gif|webp/;
        const ext = types.test(path.extname(file.originalname).toLowerCase());
        const mime = types.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only image files allowed!'));
    }
});

const uploadLogo = multer({
    storage: logoStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const types = /jpeg|jpg|png|gif|webp|svg/;
        const ext = types.test(path.extname(file.originalname).toLowerCase());
        const mime = types.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only image files allowed!'));
    }
});

// Favicon storage
const faviconStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/logo'),
    filename: (req, file, cb) => cb(null, 'favicon' + path.extname(file.originalname))
});

const uploadFavicon = multer({
    storage: faviconStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const types = /jpeg|jpg|png|gif|webp|ico|svg/;
        const ext = types.test(path.extname(file.originalname).toLowerCase());
        const mime = types.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only image files allowed!'));
    }
});

const popupImageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/logo'),
    filename: (req, file, cb) => cb(null, 'popup-' + Date.now() + path.extname(file.originalname))
});

const uploadPopupImage = multer({
    storage: popupImageStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
    // Removed file filter to allow all image types
});

// Signature storage for authorized signatory
const signatureStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/logo'),
    filename: (req, file, cb) => cb(null, 'signature' + path.extname(file.originalname))
});

const uploadSignature = multer({
    storage: signatureStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const types = /jpeg|jpg|png/;
        const ext = types.test(path.extname(file.originalname).toLowerCase());
        const mime = types.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only image files allowed!'));
    }
});

// ============ API ROUTES ============

// --- Auth ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
        return res.status(503).json({ success: false, message: 'Admin credentials are not configured on server' });
    }
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// --- Courses ---
app.get('/api/courses', (req, res) => {
    let courses = readData('courses.json') || [];
    // Ensure all courses have a position; assign sequentially for legacy data
    let needsUpdate = false;
    courses.forEach((c, idx) => {
        if (typeof c.position !== 'number') {
            c.position = idx;
            needsUpdate = true;
        }
    });
    if (needsUpdate) writeData('courses.json', courses);
    // Sort by position
    courses.sort((a, b) => (a.position || 0) - (b.position || 0));
    res.json(courses);
});

app.post('/api/courses', (req, res) => {
    const courses = readData('courses.json') || [];
    // Assign position = max existing position + 1 (append at end)
    const maxPos = courses.reduce((max, c) => Math.max(max, c.position || 0), -1);
    const course = { id: Date.now(), position: maxPos + 1, ...req.body };
    courses.push(course);
    writeData('courses.json', courses);
    res.json({ success: true, course });
});

// Reorder courses - must be before :id route to avoid conflict
app.put('/api/courses/reorder', (req, res) => {
    const { order } = req.body;
    if (!Array.isArray(order)) {
        return res.status(400).json({ success: false, message: 'order array required' });
    }
    let courses = readData('courses.json') || [];
    order.forEach((id, idx) => {
        const course = courses.find(c => c.id == id);
        if (course) course.position = idx;
    });
    writeData('courses.json', courses);
    res.json({ success: true });
});

app.put('/api/courses/:id', (req, res) => {
    let courses = readData('courses.json');
    const index = courses.findIndex(c => c.id == req.params.id);
    if (index !== -1) {
        courses[index] = { id: parseInt(req.params.id), ...req.body };
        writeData('courses.json', courses);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Course not found' });
    }
});

app.delete('/api/courses/:id', (req, res) => {
    let courses = readData('courses.json') || [];
    courses = courses.filter(c => c.id != req.params.id);
    // Reassign positions sequentially after deletion to keep them clean
    courses.forEach((c, idx) => c.position = idx);
    writeData('courses.json', courses);
    res.json({ success: true });
});

// --- Faculty ---
app.get('/api/faculty', (req, res) => {
    res.json(readData('faculty.json') || []);
});

app.get('/api/faculty/:id', (req, res) => {
    const faculty = readData('faculty.json') || [];
    const facultyMember = faculty.find(f => f.id == req.params.id);
    if (!facultyMember) return res.status(404).json({ success: false, message: 'Faculty not found' });
    res.json(facultyMember);
});

app.post('/api/faculty', async (req, res) => {
    const faculty = readData('faculty.json') || [];
    const crypto = require('crypto');

    // Generate random password
    const password = crypto.randomBytes(8).toString('hex');

    const member = {
        id: Date.now(),
        ...req.body,
        email: req.body.email,
        password: password,
        role: req.body.role || 'Faculty',
        canWriteBlogs: false,
        permissions: req.body.permissions || []
    };
    faculty.push(member);
    writeData('faculty.json', faculty);

    // Send email with credentials
    try {
        const nodemailer = require('nodemailer');
        const settings = readData('settings.json') || {};
        const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });

        const mailOptions = {
            from: smtpUser,
            to: member.email,
            subject: 'Faculty Portal Login Credentials',
            html: `
                <h2>Welcome to Genius Computer Education</h2>
                <p>Dear ${member.name},</p>
                <p>Your faculty portal account has been created. Below are your login credentials:</p>
                <p><strong>Email:</strong> ${member.email}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p><strong>Role:</strong> ${member.role}</p>
                <p>You can login at: <a href="http://localhost:3000/faculty-portal.html">Faculty Portal</a></p>
                <p>Please change your password after first login.</p>
                <p>Best regards,<br>Genius Computer Education</p>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, member, message: 'Faculty added and credentials sent via email' });
    } catch (e) {
        console.error('Email error:', e);
        res.json({ success: true, member, message: 'Faculty added but email not sent' });
    }
});

app.delete('/api/faculty/:id', (req, res) => {
    let faculty = readData('faculty.json');
    faculty = faculty.filter(f => f.id != req.params.id);
    writeData('faculty.json', faculty);
    res.json({ success: true });
});

app.put('/api/faculty/:id', (req, res) => {
    const faculty = readData('faculty.json') || [];
    const idx = faculty.findIndex(f => f.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Faculty not found' });

    // Update allowed fields
    const { name, email, subject, experience, role, admissionAccess, canWriteBlogs, permissions } = req.body;
    if (name !== undefined) faculty[idx].name = name;
    if (email !== undefined) faculty[idx].email = email;
    if (subject !== undefined) faculty[idx].subject = subject;
    if (experience !== undefined) faculty[idx].experience = experience;
    if (role !== undefined) faculty[idx].role = role;
    if (admissionAccess !== undefined) faculty[idx].admissionAccess = admissionAccess;
    if (canWriteBlogs !== undefined) faculty[idx].canWriteBlogs = canWriteBlogs;
    if (permissions !== undefined) faculty[idx].permissions = permissions;

    writeData('faculty.json', faculty);
    res.json({ success: true, faculty: faculty[idx] });
});

app.post('/api/faculty/login', async (req, res) => {
    const { email, password } = req.body;
    const faculty = readData('faculty.json') || [];
    const user = faculty.find(f => f.email === email);
    if (!user) return res.json({ success: false, message: 'Invalid credentials' });

    // Verify password (compare with hash if hashed, or plain text for existing users)
    let passwordMatch;
    if (user.password.startsWith('$2b$')) {
        passwordMatch = await bcrypt.compare(password, user.password);
    } else {
        passwordMatch = password === user.password;
    }

    if (!passwordMatch) return res.json({ success: false, message: 'Invalid credentials' });

    // Use user-specific permissions, fallback to role permissions if empty
    const userPermissions = user.permissions && user.permissions.length > 0 ? user.permissions : getRolePermissions(user.role);

    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, subject: user.subject, passwordChanged: user.passwordChanged || false, canWriteBlogs: user.canWriteBlogs || false, canSubmitAdmission: user.canSubmitAdmission || false, canManageEntranceExam: user.canManageEntranceExam || false, permissions: userPermissions } });
});

// Helper function: Get permissions array for a role
function getRolePermissions(roleName) {
    const roles = readData('roles.json') || [];
    const role = roles.find(r => r.name === roleName);
    if (!role) return [];
    return role.permissions || [];
}

// Faculty OTP Login
app.post('/api/faculty/send-otp', async (req, res) => {
    const { email } = req.body;
    const faculty = readData('faculty.json') || [];
    const user = faculty.find(f => f.email === email);
    
    if (!user) {
        return res.json({ success: false, message: 'Faculty not found with this email' });
    }
    
    // Generate cryptographically secure 6-digit numeric OTP
    const crypto = require('crypto');
    const otp = crypto.randomInt(100000, 1000000).toString();
    
    // Store OTP with expiration (5 minutes)
    const otpData = {
        email: email,
        otp: otp,
        expiresAt: Date.now() + 5 * 60 * 1000,
        facultyId: user.id
    };
    
    // Store in faculty.json temporarily (or use a separate file)
    const otps = readData('faculty-otps.json') || [];
    // Remove old OTPs for this email
    const filteredOtps = otps.filter(o => o.email !== email);
    filteredOtps.push(otpData);
    writeData('faculty-otps.json', filteredOtps);
    
    // Send OTP via email
    try {
        const nodemailer = require('nodemailer');
        const settings = readData('settings.json') || {};
        const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
        
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        
        const mailOptions = {
            from: smtpUser,
            to: email,
            subject: 'Faculty Portal - OTP Verification',
            html: `
                <h2>Faculty Portal OTP</h2>
                <p>Dear ${user.name},</p>
                <p>Your One-Time Password (OTP) for Faculty Portal login is:</p>
                <h1 style="color:#667eea;font-size:36px;letter-spacing:5px;text-align:center;">${otp}</h1>
                <p>This OTP is valid for 5 minutes.</p>
                <p>If you didn't request this OTP, please ignore this email.</p>
                <p>Best regards,<br>Genius Computer Education</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (e) {
        console.error('Email error:', e);
        res.json({ success: true, message: 'OTP generated but email not sent', otp: otp });
    }
});

app.post('/api/faculty/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const otps = readData('faculty-otps.json') || [];

    const otpRecord = otps.find(o => o.email === email && o.otp === otp && o.expiresAt > Date.now());

    if (!otpRecord) {
        return res.json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Get faculty data
    const faculty = readData('faculty.json') || [];
    const user = faculty.find(f => f.id === otpRecord.facultyId);

    if (!user) {
        return res.json({ success: false, message: 'Faculty not found' });
    }

    // Remove used OTP
    const filteredOtps = otps.filter(o => o.email !== email);
    writeData('faculty-otps.json', filteredOtps);

    // Use user-specific permissions, fallback to role permissions if empty
    const userPermissions = user.permissions && user.permissions.length > 0 ? user.permissions : getRolePermissions(user.role);

    res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, subject: user.subject, passwordChanged: user.passwordChanged || false, canWriteBlogs: user.canWriteBlogs || false, canSubmitAdmission: user.canSubmitAdmission || false, canManageEntranceExam: user.canManageEntranceExam || false, permissions: userPermissions }
    });
});

// Faculty Password Change
app.post('/api/faculty/change-password', async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;
        const faculty = readData('faculty.json') || [];
        const user = faculty.find(f => f.email === email);
        if (!user) return res.json({ success: false, message: 'User not found' });

        // Verify current password (compare with hash if hashed, or plain text for existing users)
        let passwordMatch;
        if (user.password.startsWith('$2b$')) {
            passwordMatch = await bcrypt.compare(currentPassword, user.password);
        } else {
            passwordMatch = currentPassword === user.password;
        }

        if (!passwordMatch) {
            return res.json({ success: false, message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and mark as changed
        user.password = hashedPassword;
        user.passwordChanged = true;

        writeData('faculty.json', faculty);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error('Password change error:', err);
        res.json({ success: false, message: 'Error changing password' });
    }
});

// Faculty Forgot Password - Send OTP
app.post('/api/faculty/forgot-password', async (req, res) => {
    const { email } = req.body;
    const faculty = readData('faculty.json') || [];
    const user = faculty.find(f => f.email === email);
    
    if (!user) {
        return res.json({ success: false, message: 'Faculty not found with this email' });
    }
    
    // Generate cryptographically secure 6-digit numeric OTP
    const crypto = require('crypto');
    const otp = crypto.randomInt(100000, 1000000).toString();
    
    // Store OTP with expiration (5 minutes)
    const otpData = {
        email: email,
        otp: otp,
        expiresAt: Date.now() + 5 * 60 * 1000,
        facultyId: user.id,
        purpose: 'password-reset'
    };
    
    // Store in faculty-otps.json
    const otps = readData('faculty-otps.json') || [];
    // Remove old OTPs for this email
    const filteredOtps = otps.filter(o => o.email !== email);
    filteredOtps.push(otpData);
    writeData('faculty-otps.json', filteredOtps);
    
    // Send OTP via email
    try {
        const nodemailer = require('nodemailer');
        const settings = readData('settings.json') || {};
        const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
        
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        
        const mailOptions = {
            from: smtpUser,
            to: email,
            subject: 'Faculty Portal - Password Reset OTP',
            html: `
                <h2>Password Reset Request</h2>
                <p>Dear ${user.name},</p>
                <p>Your One-Time Password (OTP) for password reset is:</p>
                <h1 style="color:#667eea;font-size:36px;letter-spacing:5px;text-align:center;">${otp}</h1>
                <p>This OTP is valid for 5 minutes.</p>
                <p>If you didn't request this password reset, please ignore this email.</p>
                <p>Best regards,<br>Genius Computer Education</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (e) {
        console.error('Email error:', e);
        res.json({ success: true, message: 'OTP generated but email not sent', otp: otp });
    }
});

// Faculty Reset Password with OTP
app.post('/api/faculty/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const faculty = readData('faculty.json') || [];
        const userIndex = faculty.findIndex(f => f.email === email);
        if (userIndex === -1) return res.status(400).json({ success: false, message: 'Faculty not found' });

        // Find valid OTP for password reset
        const otps = readData('faculty-otps.json') || [];
        const otpRecord = otps.find(o => o.email === email && o.otp === otp && o.expiresAt > Date.now() && o.purpose === 'password-reset');

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        faculty[userIndex].password = hashedPassword;
        faculty[userIndex].passwordChanged = true;
        writeData('faculty.json', faculty);

        // Remove used OTP
        const filteredOtps = otps.filter(o => o.email !== email || o.otp !== otp);
        writeData('faculty-otps.json', filteredOtps);

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        console.error('Password reset error:', err);
        res.json({ success: false, message: 'Error resetting password' });
    }
});

// Student Password Change
app.post('/api/student/change-password', async (req, res) => {
    try {
        const { rollNo, currentPassword, newPassword } = req.body;
        const students = readData('students.json') || [];
        const userIndex = students.findIndex(s => s.rollNo === rollNo);

        if (userIndex === -1) {
            return res.json({ success: false, message: 'Student not found' });
        }

        // Verify current password (compare with hash if hashed, or plain text for existing users)
        let passwordMatch;
        if (students[userIndex].loginPassword.startsWith('$2b$')) {
            passwordMatch = await bcrypt.compare(currentPassword, students[userIndex].loginPassword);
        } else {
            passwordMatch = currentPassword === students[userIndex].loginPassword;
        }

        if (!passwordMatch) {
            return res.json({ success: false, message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and mark as changed
        students[userIndex].loginPassword = hashedPassword;
        students[userIndex].passwordChanged = true;

        writeData('students.json', students);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error('Student password change error:', err);
        res.json({ success: false, message: 'Error changing password' });
    }
});

// Student OTP Authentication
app.post('/api/student-auth/request-otp', (req, res) => {
    const { email } = req.body;
    const students = readData('students.json') || [];
    const student = students.find(s => s.email === email);
    
    if (!student) {
        return res.json({ success: false, error: 'Student not found with this email' });
    }
    
    // Generate cryptographically secure 6-digit numeric OTP
    const crypto = require('crypto');
    const otp = crypto.randomInt(100000, 1000000).toString();
    
    // Store OTP with expiration (5 minutes)
    const otpData = {
        email: email,
        otp: otp,
        expiresAt: Date.now() + 5 * 60 * 1000,
        studentRollNo: student.rollNo
    };
    
    // Store in student-otps.json
    const otps = readData('student-otps.json') || [];
    // Remove old OTPs for this email
    const filteredOtps = otps.filter(o => o.email !== email);
    filteredOtps.push(otpData);
    writeData('student-otps.json', filteredOtps);
    
    // Send OTP via email
    try {
        const settings = readData('settings.json') || {};
        const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        
        const mailOptions = {
            from: smtpUser,
            to: email,
            subject: 'Student Portal - OTP Verification',
            html: `
                <h2>Student Portal OTP</h2>
                <p>Dear ${student.name},</p>
                <p>Your One-Time Password (OTP) for Student Portal login is:</p>
                <h1 style="color:#667eea;font-size:36px;letter-spacing:5px;text-align:center;">${otp}</h1>
                <p>This OTP is valid for 5 minutes.</p>
                <p>If you didn't request this OTP, please ignore this email.</p>
                <p>Best regards,<br>Genius Computer Education</p>
            `
        };
        
        transporter.sendMail(mailOptions, (err) => {
            if (err) {
                console.error('Email error:', err);
                res.json({ success: true, message: 'OTP generated but email not sent', otp: otp });
            } else {
                res.json({ success: true, message: 'OTP sent successfully' });
            }
        });
    } catch (e) {
        console.error('Email error:', e);
        res.json({ success: true, message: 'OTP generated but email not sent', otp: otp });
    }
});

app.post('/api/student-auth/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const otps = readData('student-otps.json') || [];
    const otpRecord = otps.find(o => o.email === email && o.otp === otp && o.expiresAt > Date.now());

    if (!otpRecord) {
        return res.json({ success: false, message: 'Invalid or expired OTP' });
    }

    const students = readData('students.json') || [];
    const student = students.find(s => s.rollNo === otpRecord.studentRollNo);

    if (!student) {
        return res.json({ success: false, message: 'Student not found' });
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionData = {
        studentId: student.rollNo,
        token: sessionToken,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };

    const sessions = readData('student-sessions.json') || [];
    sessions.push(sessionData);
    writeData('student-sessions.json', sessions);

    res.json({
        success: true,
        student: {
            id: student.id,
            name: student.name,
            rollNo: student.rollNo,
            email: student.email,
            phone: student.phone,
            course: student.course,
            batch: student.batch,
            passwordChanged: student.passwordChanged || false
        },
        sessionToken: sessionToken
    });
});

// Validate student session (for page reload persistence)
app.post('/api/student-auth/validate-session', (req, res) => {
    const { studentId, sessionToken } = req.body;
    if (!studentId || !sessionToken) {
        return res.status(400).json({ success: false, message: 'Missing credentials' });
    }

    const sessions = readData('student-sessions.json') || [];
    let record = sessions.find(s => String(s.studentId) === String(studentId) && s.token === sessionToken);

    if (!record) {
        // Auto-recover: token not in file → re-create it. Session only ends on explicit logout.
        record = {
            studentId: String(studentId),
            token: sessionToken,
            lastSeen: new Date().toISOString(),
            userAgent: req.headers['user-agent'] || '',
            ip: req.ip || ''
        };
        sessions.push(record);
    }

    // Update last seen
    record.lastSeen = new Date().toISOString();
    writeData('student-sessions.json', sessions);

    // Return fresh student data
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == studentId);

    if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({
        success: true,
        student: {
            id: student.id,
            name: student.name,
            email: student.email,
            rollNo: student.rollNo,
            course: student.course,
            batch: student.batch,
            passwordChanged: student.passwordChanged || false,
            sessionToken
        }
    });
});

// ===== Public Admission - Email OTP Verification =====
// Used to verify the applicant's email before allowing admission form submission.

app.post('/api/apply/send-otp', async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Valid email zaroori hai' });
        }
        // Block if email already used by an existing student
        const existing = (readData('students.json') || []).find(s => (s.email || '').toLowerCase() === email.toLowerCase());
        if (existing) {
            return res.status(400).json({ success: false, message: 'Yeh email pehle se registered hai' });
        }

        // Rate-limit: max 5 OTP requests per email per hour
        const otps = readData('apply-otps.json') || [];
        const recent = otps.filter(o => o.email === email && (Date.now() - (o.createdAt || 0)) < 60 * 60 * 1000);
        if (recent.length >= 5) {
            return res.status(429).json({ success: false, message: 'Bahut zyada OTP requests. 1 ghante baad try karein.' });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        const record = {
            email: email.toLowerCase(),
            otp,
            verified: false,
            verifyToken: '',
            createdAt: Date.now(),
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        };

        // Replace previous unverified OTPs for this email
        const filtered = otps.filter(o => o.email !== email.toLowerCase() || o.verified);
        filtered.push(record);
        writeData('apply-otps.json', filtered);

        const settings = readData('settings.json') || {};
        const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
        if (!smtpUser || !smtpPass) {
            return res.status(500).json({ success: false, message: 'Email service abhi unavailable hai. Admin se contact karein.' });
        }
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: smtpPass }
        });
        const inst = settings.name || 'Genius Computer Education';
        const logo = getEmailLogo(settings);
        await transporter.sendMail({
            from: `${inst} <${smtpUser}>`,
            to: email,
            subject: `${inst} - Admission Email Verification OTP`,
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
<div style="background:#2563eb;color:#fff;padding:20px;text-align:center;">${logo.html}<h2 style="margin:8px 0 0;">Email Verification</h2></div>
<div style="padding:24px;color:#1f2937;">
<p>Dear ${name ? String(name).slice(0, 60) : 'Applicant'},</p>
<p>Aapne ${inst} ke admission form par apply kiya hai. Apna email verify karne ke liye yeh OTP use karein:</p>
<div style="text-align:center;margin:24px 0;">
<span style="display:inline-block;font-size:32px;letter-spacing:8px;font-weight:700;background:#eff6ff;color:#1d4ed8;padding:14px 28px;border-radius:10px;border:2px dashed #2563eb;">${otp}</span>
</div>
<p style="color:#6b7280;font-size:13px;">Yeh OTP <strong>10 minute</strong> tak valid hai. Agar aapne yeh request nahi kiya, to ise ignore karein.</p>
</div>
<div style="background:#f9fafb;padding:16px;text-align:center;color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} ${inst}</div>
</div>`,
            attachments: logo.attachments
        });
        logActivity('apply.send-otp', { type: 'public' }, { email }, req);
        res.json({ success: true, message: 'OTP email par bhej diya gaya hai' });
    } catch (e) {
        console.error('apply send-otp error:', e);
        res.status(500).json({ success: false, message: 'OTP nahi bhej paaye. Thodi der baad try karein.' });
    }
});

app.post('/api/apply/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email aur OTP zaroori hai' });
    const otps = readData('apply-otps.json') || [];
    const idx = otps.findIndex(o => o.email === email.toLowerCase() && o.otp === otp && !o.verified);
    if (idx === -1) return res.status(400).json({ success: false, message: 'Galat OTP' });
    if (Date.now() > otps[idx].expiresAt) return res.status(400).json({ success: false, message: 'OTP expire ho gaya. Naya OTP mangaiye.' });

    const verifyToken = crypto.randomBytes(24).toString('hex');
    otps[idx].verified = true;
    otps[idx].verifyToken = verifyToken;
    otps[idx].verifiedAt = Date.now();
    otps[idx].tokenExpiresAt = Date.now() + 30 * 60 * 1000; // token valid 30 min
    writeData('apply-otps.json', otps);
    logActivity('apply.verify-otp', { type: 'public' }, { email }, req);
    res.json({ success: true, verifyToken, message: 'Email verified successfully' });
});

// Duplicate check endpoints for public admission form
app.get('/api/check-mobile', (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.json({ exists: false });
    const students = readData('students.json') || [];
    const exists = students.some(s => s.phone === phone);
    res.json({ exists });
});

app.get('/api/check-email', (req, res) => {
    const { email } = req.query;
    if (!email) return res.json({ exists: false });
    const students = readData('students.json') || [];
    const exists = students.some(s => s.email && s.email.toLowerCase() === email.toLowerCase());
    res.json({ exists });
});

app.get('/api/check-aadhar', (req, res) => {
    const { aadhar } = req.query;
    if (!aadhar) return res.json({ exists: false });
    const students = readData('students.json') || [];
    const exists = students.some(s => s.aadhar === aadhar);
    res.json({ exists });
});

// ===== Staff OTP for Admission Submission (Cash/UPI mismanagement prevention) =====
// Authorized staff = faculty.json entries with 'admissions' permission or canSubmitAdmission === true.

function isAuthorizedStaff(email) {
    if (!email) return null;
    const faculty = readData('faculty.json') || [];
    const f = faculty.find(x => (x.email || '').toLowerCase() === email.toLowerCase());
    if (!f) return null;

    // Check new permissions system first
    if (f.permissions && f.permissions.includes('admissions')) return f;

    // Fallback to old canSubmitAdmission flag for backward compatibility
    if (f.canSubmitAdmission === true) return f;

    return null;
}

app.post('/api/staff/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Valid staff email zaroori hai' });
        }
        const staff = isAuthorizedStaff(email);
        if (!staff) {
            return res.status(403).json({ success: false, message: 'Yeh email admission submit ke liye authorized nahi hai. Admin se contact karein.' });
        }

        // Rate-limit: max 5 OTP per 1 hour per staff
        const otps = readData('staff-otps.json') || [];
        const recent = otps.filter(o => o.email === email.toLowerCase() && (Date.now() - (o.createdAt || 0)) < 60 * 60 * 1000);
        if (recent.length >= 5) {
            return res.status(429).json({ success: false, message: 'Bahut zyada OTP requests. Kuch der baad try karein.' });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        const record = {
            email: email.toLowerCase(),
            otp,
            staffId: staff.id,
            staffName: staff.name,
            verified: false,
            staffToken: '',
            createdAt: Date.now(),
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 min
        };
        const filtered = otps.filter(o => o.email !== email.toLowerCase() || o.verified);
        filtered.push(record);
        writeData('staff-otps.json', filtered);

        const settings = readData('settings.json') || {};
        const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
        if (!smtpUser || !smtpPass) {
            return res.status(500).json({ success: false, message: 'Email service unavailable' });
        }
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: smtpPass }
        });
        const inst = settings.name || 'Genius Computer Education';
        const logo = getEmailLogo(settings);
        await transporter.sendMail({
            from: `${inst} <${smtpUser}>`,
            to: email,
            subject: `${inst} - Staff Admission OTP`,
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
<div style="background:#7c3aed;color:#fff;padding:20px;text-align:center;">${logo.html}<h2 style="margin:8px 0 0;">Staff Admission Verification</h2></div>
<div style="padding:24px;color:#1f2937;">
<p>Dear ${staff.name},</p>
<p>Aap admission form submit kar rahe hain (Cash/UPI payment). Confirm karne ke liye yeh OTP use karein:</p>
<div style="text-align:center;margin:24px 0;">
<span style="display:inline-block;font-size:32px;letter-spacing:8px;font-weight:700;background:#f5f3ff;color:#6d28d9;padding:14px 28px;border-radius:10px;border:2px dashed #7c3aed;">${otp}</span>
</div>
<p style="color:#6b7280;font-size:13px;">Yeh OTP <strong>10 minute</strong> tak valid hai. Single-use hai - submit hone ke baad expire ho jayega.</p>
<p style="color:#dc2626;font-size:13px;"><strong>⚠️ Security:</strong> Agar aapne yeh OTP request nahi kiya, to immediately admin ko inform karein.</p>
</div>
<div style="background:#f9fafb;padding:16px;text-align:center;color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} ${inst}</div>
</div>`,
            attachments: logo.attachments
        });
        logActivity('staff.send-otp', { type: 'staff', id: staff.id, name: staff.name }, { email }, req);
        res.json({ success: true, staffName: staff.name, message: 'OTP staff email par bhej diya gaya hai' });
    } catch (e) {
        console.error('staff send-otp error:', e);
        res.status(500).json({ success: false, message: 'OTP nahi bhej paaye. Try again.' });
    }
});

app.post('/api/staff/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email aur OTP zaroori hai' });
    const otps = readData('staff-otps.json') || [];
    const idx = otps.findIndex(o => o.email === email.toLowerCase() && o.otp === otp && !o.verified);
    if (idx === -1) return res.status(400).json({ success: false, message: 'Galat OTP' });
    if (Date.now() > otps[idx].expiresAt) return res.status(400).json({ success: false, message: 'OTP expire ho gaya' });

    const staffToken = crypto.randomBytes(24).toString('hex');
    otps[idx].verified = true;
    otps[idx].staffToken = staffToken;
    otps[idx].verifiedAt = Date.now();
    otps[idx].tokenExpiresAt = Date.now() + 15 * 60 * 1000; // 15 min to submit
    writeData('staff-otps.json', otps);
    logActivity('staff.verify-otp', { type: 'staff', id: otps[idx].staffId, name: otps[idx].staffName }, { email }, req);
    res.json({ success: true, staffToken, staffName: otps[idx].staffName, message: 'Staff verified' });
});

// Helper: consume staff token (single-use, returns staff info or null)
function consumeStaffToken(token) {
    if (!token) return null;
    const otps = readData('staff-otps.json') || [];
    const idx = otps.findIndex(o => o.staffToken === token && o.verified);
    if (idx === -1) return null;
    if (Date.now() > (otps[idx].tokenExpiresAt || 0)) return null;
    const info = { id: otps[idx].staffId, name: otps[idx].staffName, email: otps[idx].email };
    otps.splice(idx, 1);
    writeData('staff-otps.json', otps);
    return info;
}

// Toggle admission-access for a faculty member
app.patch('/api/faculty/:id/admission-access', (req, res) => {
    const faculty = readData('faculty.json') || [];
    const idx = faculty.findIndex(f => f.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Faculty not found' });
    const newVal = req.body.canSubmitAdmission === true;
    faculty[idx].canSubmitAdmission = newVal;
    writeData('faculty.json', faculty);
    logActivity('faculty.admission-access-toggle', { type: 'admin' }, { facultyId: faculty[idx].id, name: faculty[idx].name, canSubmitAdmission: newVal }, req);
    res.json({ success: true, faculty: faculty[idx] });
});

app.patch('/api/faculty/:id/blog-access', (req, res) => {
    const faculty = readData('faculty.json') || [];
    const idx = faculty.findIndex(f => f.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Faculty not found' });
    const newVal = req.body.canWriteBlogs === true;
    faculty[idx].canWriteBlogs = newVal;
    writeData('faculty.json', faculty);
    logActivity('faculty.blog-access-toggle', { type: 'admin' }, { facultyId: faculty[idx].id, name: faculty[idx].name, canWriteBlogs: newVal }, req);
    res.json({ success: true, faculty: faculty[idx] });
});

// Get current faculty data with latest permissions (for refreshing faculty session)
app.get('/api/faculty/:id/me', (req, res) => {
    const faculty = readData('faculty.json') || [];
    const user = faculty.find(f => f.id == req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Faculty not found' });

    // Use user-specific permissions, fallback to role permissions if empty
    const userPermissions = user.permissions && user.permissions.length > 0 ? user.permissions : getRolePermissions(user.role);

    res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            subject: user.subject,
            passwordChanged: user.passwordChanged || false,
            canWriteBlogs: user.canWriteBlogs || false,
            canSubmitAdmission: user.canSubmitAdmission || false,
            canManageEntranceExam: user.canManageEntranceExam || false,
            permissions: userPermissions
        }
    });
});

// PATCH: Toggle entrance exam management access for a faculty
app.patch('/api/faculty/:id/entrance-management-access', (req, res) => {
    const faculty = readData('faculty.json') || [];
    const idx = faculty.findIndex(f => f.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Faculty not found' });
    const newVal = req.body.canManageEntranceExam === true;
    faculty[idx].canManageEntranceExam = newVal;
    // Clean up old fields if present
    delete faculty[idx].canAddExamQuestions;
    delete faculty[idx].canRegisterEntranceExam;
    writeData('faculty.json', faculty);
    logActivity('faculty.entrance-management-access-toggle', { type: 'admin' }, { facultyId: faculty[idx].id, name: faculty[idx].name, canManageEntranceExam: newVal }, req);
    res.json({ success: true, faculty: faculty[idx] });
});

// Helper: validate apply verify token
function consumeApplyVerifyToken(email, token) {
    if (!email || !token) return false;
    const otps = readData('apply-otps.json') || [];
    const idx = otps.findIndex(o => o.email === email.toLowerCase() && o.verifyToken === token && o.verified);
    if (idx === -1) return false;
    if (Date.now() > (otps[idx].tokenExpiresAt || 0)) return false;
    // Consume: invalidate token after use
    otps.splice(idx, 1);
    writeData('apply-otps.json', otps);
    return true;
}

// Student logout — the ONLY way to truly end a session
app.post('/api/student-auth/logout', (req, res) => {
    const { studentId, sessionToken } = req.body;
    if (studentId && sessionToken) {
        const sessions = readData('student-sessions.json') || [];
        const filtered = sessions.filter(s => !(String(s.studentId) === String(studentId) && s.token === sessionToken));
        writeData('student-sessions.json', filtered);
    }
    res.json({ success: true });
});

// Admin Credentials Management
let adminCredentials = null;
const adminLoginAttempts = new Map(); // Track failed login attempts by IP
const adminSessions = new Map(); // Track active admin sessions

function generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
    return Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Rate limiting helper
function checkRateLimit(ip) {
    const attempts = adminLoginAttempts.get(ip) || { count: 0, resetTime: Date.now() + 15 * 60 * 1000 };
    
    // Reset if time expired
    if (Date.now() > attempts.resetTime) {
        adminLoginAttempts.set(ip, { count: 0, resetTime: Date.now() + 15 * 60 * 1000 });
        return { allowed: true, remaining: 5 };
    }
    
    // Check if limit exceeded (5 attempts per 15 minutes)
    if (attempts.count >= 5) {
        return { allowed: false, remaining: 0, resetIn: Math.ceil((attempts.resetTime - Date.now()) / 1000) };
    }
    
    return { allowed: true, remaining: 5 - attempts.count };
}

// Record failed login attempt
function recordFailedAttempt(ip) {
    const attempts = adminLoginAttempts.get(ip) || { count: 0, resetTime: Date.now() + 15 * 60 * 1000 };
    attempts.count++;
    adminLoginAttempts.set(ip, attempts);
}

// Clear failed attempts on successful login
function clearFailedAttempts(ip) {
    adminLoginAttempts.delete(ip);
}

// Generate session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Create admin session
function createAdminSession(ip) {
    const token = generateSessionToken();
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
    adminSessions.set(token, { ip, expiresAt });
    return { token, expiresAt };
}

// Verify admin session
function verifyAdminSession(token, ip) {
    const session = adminSessions.get(token);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
        adminSessions.delete(token);
        return false;
    }
    if (session.ip !== ip) return false;
    return true;
}

// Cleanup expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of adminSessions.entries()) {
        if (now > session.expiresAt) {
            adminSessions.delete(token);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// Admin session verification middleware
function verifyAdminSessionMiddleware(req, res, next) {
    const token = req.headers['x-admin-session'];
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No session token provided' });
    }
    
    if (!verifyAdminSession(token, ip)) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session' });
    }
    
    next();
}

// Session verification endpoint
app.get('/api/admin/verify-session', (req, res) => {
    const token = req.headers['x-admin-session'];
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (!token) {
        return res.json({ valid: false, message: 'No session token' });
    }
    
    const isValid = verifyAdminSession(token, ip);
    res.json({ valid: isValid });
});

// Logout endpoint
app.post('/api/admin/logout', (req, res) => {
    const token = req.headers['x-admin-session'];
    if (token) {
        adminSessions.delete(token);
    }
    res.json({ success: true, message: 'Logged out successfully' });
});

// Admin Gate Passcode Verification
app.post('/api/admin/verify-gate-passcode', async (req, res) => {
    const { passcode, recaptchaToken } = req.body;
    const gatePasscode = process.env.ADMIN_GATE_PASSCODE || '1234';
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!passcode) {
        return res.json({ success: false, message: 'Passcode required' });
    }
    
    // Verify reCAPTCHA token
    if (recaptchaToken && recaptchaSecret) {
        try {
            const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `secret=${recaptchaSecret}&response=${recaptchaToken}`
            });
            const recaptchaData = await recaptchaResponse.json();
            
            if (!recaptchaData.success || recaptchaData.score < 0.5) {
                return res.json({ success: false, message: 'reCAPTCHA verification failed. Please try again.' });
            }
        } catch (error) {
            console.error('reCAPTCHA verification error:', error);
            return res.json({ success: false, message: 'reCAPTCHA verification error' });
        }
    }
    
    if (passcode === gatePasscode) {
        res.json({ success: true, message: 'Passcode verified' });
    } else {
        res.json({ success: false, message: 'Invalid passcode' });
    }
});

// TOTP Secret Management
let adminTOTPSecret = null;

// Generate TOTP secret for admin
app.post('/api/admin/generate-totp-secret', async (req, res) => {
    try {
        const settings = readData('settings.json') || {};
        const instituteName = settings.name || 'Genius Computer Education';
        const adminEmail = settings.adminEmail || settings.email;
        
        if (!adminEmail) {
            return res.json({ success: false, message: 'Admin email not configured' });
        }
        
        // Generate TOTP secret
        const secret = speakeasy.generateSecret({
            name: `${instituteName} Admin`,
            issuer: instituteName,
            length: 32
        });
        
        // Store secret in memory
        adminTOTPSecret = secret.base32;
        
        // Generate QR code
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
        
        res.json({
            success: true,
            secret: secret.base32,
            qrCode: qrCodeUrl,
            message: 'TOTP secret generated. Scan QR code with your authenticator app.'
        });
    } catch (error) {
        console.error('Error generating TOTP secret:', error);
        res.json({ success: false, message: 'Failed to generate TOTP secret' });
    }
});

// Verify TOTP code
app.post('/api/admin/verify-totp', (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.json({ success: false, message: 'TOTP token required' });
    }
    
    if (!adminTOTPSecret) {
        return res.json({ success: false, message: 'TOTP not configured. Please set up 2FA first.' });
    }
    
    // Verify TOTP token
    const verified = speakeasy.totp.verify({
        secret: adminTOTPSecret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 2 time steps (approximately 1 minute) before/after
    });
    
    if (verified) {
        res.json({ success: true, message: 'TOTP verified' });
    } else {
        res.json({ success: false, message: 'Invalid TOTP code' });
    }
});

// Check if TOTP is configured
app.get('/api/admin/totp-status', (req, res) => {
    res.json({
        configured: adminTOTPSecret !== null
    });
});

app.post('/api/admin/generate-credentials', async (req, res) => {
    try {
        const settings = readData('settings.json') || {};
        const adminEmail = settings.adminEmail || settings.email;
        
        if (!adminEmail) {
            return res.json({ success: false, message: 'Admin email not configured' });
        }
        
        // Generate random credentials
        const username = 'admin_' + Date.now().toString(36);
        const password = generateRandomPassword(12);
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
        
        // Store credentials in memory
        adminCredentials = {
            username,
            password,
            expiresAt
        };
        
        // Send email with credentials
        const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        
        const mailOptions = {
            from: smtpUser,
            to: adminEmail,
            subject: 'Admin Panel Login Credentials - Genius Computer Education',
            html: `
                <h2>Admin Panel Login Credentials</h2>
                <p>Dear Admin,</p>
                <p>Your temporary login credentials for the Admin Panel are:</p>
                <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:16px 0;">
                    <p style="margin:0 0 8px;"><strong>Username:</strong> ${username}</p>
                    <p style="margin:0;"><strong>Password:</strong> ${password}</p>
                </div>
                <p><strong>Important:</strong></p>
                <ul>
                    <li>These credentials are valid for 15 minutes only</li>
                    <li>After login, you can change your password if needed</li>
                    <li>Do not share these credentials with anyone</li>
                </ul>
                <p>If you didn't request these credentials, please ignore this email.</p>
                <p>Best regards,<br>Genius Computer Education</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
        res.json({ 
            success: true, 
            message: 'Credentials sent to your email. Valid for 15 minutes.' 
        });
    } catch (error) {
        console.error('Error sending admin credentials:', error);
        res.json({ success: false, message: 'Failed to send credentials. Please try again.' });
    }
});

app.post('/api/admin/verify-credentials', async (req, res) => {
    const { username, password, totpToken, recaptchaToken } = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    
    // Verify reCAPTCHA token
    if (recaptchaToken && recaptchaSecret) {
        try {
            const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `secret=${recaptchaSecret}&response=${recaptchaToken}`
            });
            const recaptchaData = await recaptchaResponse.json();
            
            if (!recaptchaData.success || recaptchaData.score < 0.5) {
                return res.json({ success: false, message: 'reCAPTCHA verification failed. Please try again.' });
            }
        } catch (error) {
            console.error('reCAPTCHA verification error:', error);
            return res.json({ success: false, message: 'reCAPTCHA verification error' });
        }
    }
    
    // Check rate limiting
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
        return res.status(429).json({ 
            success: false, 
            message: `Too many failed login attempts. Please try again in ${rateLimit.resetIn} seconds.` 
        });
    }
    
    if (!adminCredentials) {
        return res.json({ success: false, message: 'No credentials generated. Please request new credentials.' });
    }
    
    // Check if credentials expired
    if (Date.now() > adminCredentials.expiresAt) {
        adminCredentials = null;
        return res.json({ success: false, message: 'Credentials expired. Please request new credentials.' });
    }
    
    // Verify credentials
    if (username === adminCredentials.username && password === adminCredentials.password) {
        // Check if TOTP is configured and required
        if (adminTOTPSecret) {
            if (!totpToken) {
                return res.json({ 
                    success: false, 
                    requireTOTP: true,
                    message: 'TOTP code required for 2FA' 
                });
            }
            
            // Verify TOTP token
            const verified = speakeasy.totp.verify({
                secret: adminTOTPSecret,
                encoding: 'base32',
                token: totpToken,
                window: 2
            });
            
            if (!verified) {
                return res.json({ 
                    success: false, 
                    message: 'Invalid TOTP code',
                    requireTOTP: true
                });
            }
        }
        
        // Clear credentials after successful login
        adminCredentials = null;
        // Clear failed attempts
        clearFailedAttempts(ip);
        // Create session
        const session = createAdminSession(ip);
        res.json({ 
            success: true, 
            message: 'Login successful',
            sessionToken: session.token,
            expiresAt: session.expiresAt
        });
    } else {
        // Record failed attempt
        recordFailedAttempt(ip);
        const remainingAttempts = 5 - (adminLoginAttempts.get(ip)?.count || 0);
        res.json({ 
            success: false, 
            message: 'Invalid credentials',
            remainingAttempts 
        });
    }
});

// --- Gallery ---
app.get('/api/gallery', (req, res) => {
    res.json(readData('gallery.json') || []);
});

app.post('/api/gallery', uploadGallery.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const gallery = readData('gallery.json') || [];
    const item = {
        id: Date.now(),
        title: req.body.title,
        category: req.body.category || 'general',
        image: '/uploads/gallery/' + req.file.filename
    };
    gallery.push(item);
    writeData('gallery.json', gallery);
    res.json({ success: true, item });
});

app.put('/api/gallery/:id', uploadGallery.single('image'), (req, res) => {
    let gallery = readData('gallery.json');
    const index = gallery.findIndex(g => g.id == req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Gallery item not found' });

    const item = gallery[index];
    item.title = req.body.title;
    item.category = req.body.category || 'general';
    if (req.file) {
        item.image = '/uploads/gallery/' + req.file.filename;
    }

    gallery[index] = item;
    writeData('gallery.json', gallery);
    res.json({ success: true, item });
});

app.delete('/api/gallery/:id', (req, res) => {
    let gallery = readData('gallery.json');
    const item = gallery.find(g => g.id == req.params.id);
    if (item && item.image) {
        const imgPath = path.join(__dirname, item.image);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    gallery = gallery.filter(g => g.id != req.params.id);
    writeData('gallery.json', gallery);
    res.json({ success: true });
});

// --- Enquiries ---
app.get('/api/enquiries', (req, res) => {
    res.json(readData('enquiries.json') || []);
});

app.post('/api/enquiries', (req, res) => {
    const enquiries = readData('enquiries.json') || [];
    const enquiry = { id: Date.now(), date: formatDate(new Date()), replied: false, ...req.body };
    enquiries.unshift(enquiry);
    writeData('enquiries.json', enquiries);
    res.json({ success: true });
});

app.delete('/api/enquiries/:id', (req, res) => {
    let enquiries = readData('enquiries.json') || [];
    enquiries = enquiries.filter(e => e.id != req.params.id);
    writeData('enquiries.json', enquiries);
    res.json({ success: true });
});

app.post('/api/enquiries/:id/reply', async (req, res) => {
    try {
        const enquiries = readData('enquiries.json') || [];
        const settings = readData('settings.json') || {};
        const idx = enquiries.findIndex(e => e.id == req.params.id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Enquiry not found' });
        
        const enquiry = enquiries[idx];
        const replyText = req.body.reply;
        
        const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
        if (!enquiry.email) return res.status(400).json({ success: false, error: 'No email address found for this enquiry' });
        if (!smtpUser || !smtpPass) return res.status(400).json({ success: false, error: 'SMTP email settings not configured. Go to Settings > Email Configuration.' });
        
        const inst = settings.name || 'Genius Computer Education';
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: smtpPass }
        });
        
        const logoInfo = getEmailLogo(settings, 'max-height:50px;');
        
        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,sans-serif;background:#f4f6f9;">
<div style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
<div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 30px;text-align:center;">
${logoInfo.html}
<h1 style="color:#fff;margin:12px 0 4px;font-size:22px;">${inst}</h1>
<p style="color:rgba(255,255,255,0.85);margin:0;font-size:13px;">${settings.address || ''}</p>
</div>
<div style="padding:30px;">
<h2 style="color:#1e293b;margin:0 0 8px;font-size:18px;">Hello ${enquiry.name || 'there'},</h2>
<p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 20px;">Thank you for your enquiry. Here is our response:</p>
<div style="background:#f0f4ff;border-left:4px solid #667eea;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;">
<p style="color:#94a3b8;font-size:12px;margin:0 0 6px;font-weight:600;text-transform:uppercase;">Your Question</p>
<p style="color:#334155;font-size:14px;margin:0;line-height:1.5;">${enquiry.message || '-'}</p>
</div>
<div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;">
<p style="color:#059669;font-size:12px;margin:0 0 6px;font-weight:600;text-transform:uppercase;">Our Reply</p>
<p style="color:#065f46;font-size:14px;margin:0;line-height:1.6;white-space:pre-wrap;">${replyText}</p>
</div>
<p style="color:#64748b;font-size:13px;line-height:1.5;">If you have any more questions, feel free to contact us:</p>
<p style="color:#334155;font-size:13px;margin:4px 0;">📞 ${settings.phone || ''}</p>
<p style="color:#334155;font-size:13px;margin:4px 0;">✉️ ${settings.email || settings.smtpUser || ''}</p>
</div>
<div style="background:#f8fafc;padding:16px 30px;text-align:center;border-top:1px solid #e2e8f0;">
<p style="color:#94a3b8;font-size:12px;margin:0;">This email was sent from ${inst}. Please do not reply directly to this email.</p>
</div>
</div></body></html>`;
        
        await transporter.sendMail({
            from: `"${inst}" <${settings.smtpUser}>`,
            to: enquiry.email,
            subject: `Re: Your Enquiry - ${inst}`,
            html: emailHtml,
            attachments: logoInfo.attachments
        });
        
        // Update enquiry status
        enquiries[idx].replied = true;
        enquiries[idx].replyMessage = replyText;
        enquiries[idx].repliedAt = formatDate(new Date());
        writeData('enquiries.json', enquiries);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Enquiry reply error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Notices ---
const noticeStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/notices'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const uploadNotice = multer({ storage: noticeStorage, limits: { fileSize: 15 * 1024 * 1024 } });

app.get('/api/notices', (req, res) => {
    res.json(readData('notices.json') || []);
});

app.post('/api/notices', uploadNotice.single('file'), (req, res) => {
    const notices = readData('notices.json') || [];
    const notice = {
        id: Date.now(),
        title: req.body.title,
        category: req.body.category || 'General',
        isImportant: req.body.isImportant === 'true',
        isPinned: req.body.isPinned === 'true',
        expiry: req.body.expiry || '',
        date: formatDate(new Date()),
        file: req.file ? '/uploads/notices/' + req.file.filename : '',
        fileType: req.file ? req.file.mimetype : ''
    };
    notices.unshift(notice);
    writeData('notices.json', notices);
    res.json({ success: true, notice });
});

app.put('/api/notices/:id', uploadNotice.single('file'), (req, res) => {
    const notices = readData('notices.json') || [];
    const idx = notices.findIndex(n => n.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    notices[idx].title      = req.body.title || notices[idx].title;
    notices[idx].category   = req.body.category || notices[idx].category;
    notices[idx].isImportant = req.body.isImportant === 'true';
    notices[idx].isPinned   = req.body.isPinned === 'true';
    notices[idx].expiry     = req.body.expiry !== undefined ? req.body.expiry : notices[idx].expiry;
    if (req.file) {
        notices[idx].file     = '/uploads/notices/' + req.file.filename;
        notices[idx].fileType = req.file.mimetype;
    }
    writeData('notices.json', notices);
    res.json({ success: true, notice: notices[idx] });
});

app.delete('/api/notices/:id', (req, res) => {
    let notices = readData('notices.json') || [];
    notices = notices.filter(n => n.id != req.params.id);
    writeData('notices.json', notices);
    res.json({ success: true });
});

// --- AI Course Description Generator ---
app.post('/api/ai/course-description', (req, res) => {
    const { courseName, duration, price } = req.body;
    if (!courseName) return res.status(400).json({ error: 'Course name required' });
    const name = courseName.trim();
    const nameLower = name.toLowerCase();
    const dur = duration || '';
    const priceStr = price ? `₹${parseInt(price).toLocaleString('en-IN')}` : '';

    // Load comprehensive course knowledge base
    const courseDB = readData('courseAI.json') || {};

    // Match best course from DB
    let matched = null; let matchKey = '';
    for (const key of Object.keys(courseDB)) {
        if (nameLower.includes(key) || key.includes(nameLower.replace('course','').trim())) {
            matched = courseDB[key]; matchKey = key; break;
        }
    }

    const durLine = dur ? (priceStr ? `📅 Duration: ${dur} | 💰 Fees: ${priceStr}` : `📅 Duration: ${dur}`) : '';

    // 5 distinct writing styles using detailed topics[] and jobs[] arrays
    const styles = [
        // Style 1: Motivational + numbered syllabus + detailed job cards
        (m) => [
            `🚀 ${name}`,
            ``,
            `Kya aap apna career ek naye level par le jaana chahte hain? ${name} course specially ${m.suit} ke liye design kiya gaya hai.`,
            durLine, ``,
            `📚 Kya Sikhaya Jayega (Complete Syllabus):`,
            ...m.topics.map((t, i) => `  ${i+1}. ${t}`),
            ``,
            `💼 Course Ke Baad Job Opportunities:`,
            ...m.jobs.map(j => `\n  🔹 ${j.role} (${j.salary})\n     ${j.desc}`),
            ``,
            `🏆 Hamare Course Ki Khaasiyat:`,
            `  ✅ Industry-recognized certificate`, `  ✅ 100% practical + project-based training`,
            `  ✅ Experienced faculty`, `  ✅ Job placement assistance`,
        ].filter(Boolean).join('\n'),

        // Style 2: Clean bullet syllabus + salary table
        (m) => [
            `📌 ${name} — Professional Training Program`,
            durLine, ``,
            `Yeh course ${m.suit} ke liye hai.`, ``,
            `� Detailed Syllabus:`,
            ...m.topics.map(t => `  • ${t}`),
            ``,
            `💰 Job Opportunities & Expected Salary:`,
            ...m.jobs.map(j => `  → ${j.role} — ${j.salary}\n    ${j.desc}`),
            ``,
            `⭐ Why Join?`,
            `  • 100% Practical Training with Real Projects`,
            `  • Modern Computer Lab & Latest Software`,
            `  • Certified & Industry-Experienced Faculty`,
            `  • Course Completion Certificate`, `  • Interview Preparation & Placement Support`,
        ].filter(Boolean).join('\n'),

        // Style 3: Q&A style with full details
        (m) => [
            `💡 ${name}`, durLine, ``,
            `❓ Yeh course kiske liye hai?`,
            `→ ${m.suit.charAt(0).toUpperCase() + m.suit.slice(1)}`, ``,
            `❓ Course mein kya kya padhaya jayega?`,
            ...m.topics.map(t => `  ✦ ${t}`),
            ``,
            `❓ Course ke baad kaunsi jobs mil sakti hain?`,
            ...m.jobs.map(j => `  ✦ ${j.role} (${j.salary}) — ${j.desc}`),
            ``,
            `❓ Certificate milega?`,
            `→ Haan! Course complete hone par industry-recognized certificate diya jayega.`, ``,
            `🔥 Abhi enroll karein aur apna future secure karein!`,
        ].filter(Boolean).join('\n'),

        // Style 4: Story/narrative with detailed job descriptions
        (m) => [
            `🎓 ${name} — Complete Training Program`, ``,
            `Aaj ke digital zamane mein ${name} ki demand bahut tezi se badh rahi hai. Yeh course ${m.suit} ke liye specially taiyaar kiya gaya hai.`,
            durLine, ``,
            `📖 Course mein yeh sab sikhaya jayega:`,
            ...m.topics.map((t, i) => `\n  📌 Module ${i+1}: ${t}`),
            ``,
            `👨‍💼 Career Scope — Course ke baad yeh jobs mil sakti hain:`,
            ...m.jobs.map(j => `\n  💼 ${j.role}\n     💰 Salary: ${j.salary}\n     📝 ${j.desc}`),
            ``,
            `🌟 Course Features:`,
            `  • Zero se advanced level tak training`,
            `  • Live projects aur real-world assignments`,
            `  • Regular tests, assessments aur doubt sessions`,
            `  • Certificate + Placement guidance`,
        ].filter(Boolean).join('\n'),

        // Style 5: Compact but comprehensive
        (m) => [
            `✨ ${name}`, durLine, ``,
            `${m.suit.charAt(0).toUpperCase() + m.suit.slice(1)} — yeh course aapke liye hai!`, ``,
            `� Complete Syllabus:`,
            ...m.topics.map(t => `• ${t}`),
            ``,
            `💼 Job & Salary Details:`,
            ...m.jobs.map(j => `• ${j.role} — ${j.salary}\n  ${j.desc}`),
            ``,
            `✅ Certificate  ✅ Practical Training  ✅ Expert Faculty`,
            `✅ Job-ready skills  ✅ Placement support  ✅ Flexible timings`,
        ].filter(Boolean).join('\n'),
    ];

    const hash = nameLower.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

    let desc;
    if (matched) {
        desc = styles[hash % styles.length](matched);
    } else {
        const generic = {
            topics: [`${name} se related Core Concepts aur Fundamentals`, `Practical Skills aur Industry Tools`, `Hands-on Projects aur Assignments`, `Advanced Topics aur Real-world Applications`],
            jobs: [
                {role: `${name} Specialist`, salary: '₹12,000–₹30,000/month', desc: `${name} field mein entry-level professional role`},
                {role: 'Freelancer', salary: '₹15,000–₹1,00,000+/month', desc: 'Independent projects le kar ghar baithe kaam karna'},
                {role: 'Self-employed', salary: 'Unlimited potential', desc: 'Apna business ya consultancy shuru kar sakte hain'}
            ],
            suit: `students jo ${name} field mein career banana chahte hain`
        };
        desc = styles[hash % styles.length](generic);
    }

    res.json({ success: true, description: desc });
});

// --- Batches ---
app.get('/api/batches', (req, res) => res.json(readData('batches.json') || []));

app.get('/api/batches/seats', (req, res) => {
    const batches  = readData('batches.json') || [];
    const students = readData('students.json') || [];
    const result = batches.map(b => {
        const enrolled = students.filter(s => s.batchId == b.id).length;
        return { ...b, enrolled, available: Math.max(0, b.totalSeats - enrolled) };
    });
    res.json(result);
});

app.post('/api/batches', (req, res) => {
    const batches = readData('batches.json') || [];
    const batch = { id: Date.now(), ...req.body, totalSeats: parseInt(req.body.totalSeats) || 30 };
    batches.push(batch);
    writeData('batches.json', batches);
    res.json({ success: true, batch });
});

app.put('/api/batches/:id', (req, res) => {
    const batches = readData('batches.json') || [];
    const idx = batches.findIndex(b => b.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    batches[idx] = { ...batches[idx], ...req.body, id: batches[idx].id, totalSeats: parseInt(req.body.totalSeats) || batches[idx].totalSeats };
    writeData('batches.json', batches);
    res.json({ success: true, batch: batches[idx] });
});

app.delete('/api/batches/:id', (req, res) => {
    let batches = readData('batches.json') || [];
    batches = batches.filter(b => b.id != req.params.id);
    writeData('batches.json', batches);
    res.json({ success: true });
});

// --- Student OTP Auth ---
const otpStore = new Map();

function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

function generatePassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
    return Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getSMTPConfig() {
    const settings = readData('settings.json') || {};
    const smtpUser = process.env.SMTP_USER || settings.smtpUser;
    const smtpPass = process.env.SMTP_PASS || settings.smtpPass;
    const smtpHost = process.env.SMTP_HOST || settings.smtpHost || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT) || parseInt(settings.smtpPort) || 465;
    const smtpSecure = process.env.SMTP_SECURE === 'true' || settings.smtpSecure !== false;
    
    return { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure };
}

async function sendLoginCredentials(student, password) {
    const settings = readData('settings.json') || {};
    const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
    if (!smtpUser || !smtpPass || !student.email) return;
    const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user: smtpUser, pass: smtpPass } });
    const inst = settings.name || 'Genius Computer Education';
    const logo = getEmailLogo(settings);
    const websiteUrl = settings.websiteUrl || 'http://localhost:3000';

    await transporter.sendMail({
        from: `"${inst}" <${smtpUser}>`,
        to: student.email,
        subject: `Welcome to ${inst} - Your Admission is Confirmed!`,
        html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admission Confirmation</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f4;">
    <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);padding:40px 30px;text-align:center;">
            ${logo.html}
            <h1 style="margin:20px 0 10px;color:#ffffff;font-size:28px;font-weight:700;">Welcome to ${inst}</h1>
            <p style="margin:0;color:#ffffff;font-size:16px;opacity:0.9;">Your Admission is Confirmed!</p>
        </div>

        <!-- Content -->
        <div style="padding:40px 30px;">
            <p style="margin:0 0 20px;color:#333333;font-size:16px;line-height:1.6;">
                Dear <strong>${student.name}</strong>,
            </p>
            <p style="margin:0 0 20px;color:#555555;font-size:15px;line-height:1.6;">
                Congratulations! We are delighted to inform you that your admission has been successfully processed. You are now officially part of the ${inst} family.
            </p>

            <!-- Course Info -->
            <div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:20px;margin:25px 0;border-radius:0 8px 8px 0;">
                <p style="margin:0 0 10px;color:#1e3a8a;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Enrolled Course</p>
                <p style="margin:0;color:#333333;font-size:18px;font-weight:600;">${student.course}</p>
                <p style="margin:5px 0 0;color:#666666;font-size:14px;">Batch: ${student.batch || 'To be assigned'}</p>
            </div>

            <!-- Login Credentials -->
            <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:8px;padding:25px;margin:25px 0;">
                <p style="margin:0 0 15px;color:#1e3a8a;font-size:16px;font-weight:600;">Your Student Portal Login Credentials</p>
                <div style="background:#ffffff;padding:15px;border-radius:6px;margin-bottom:12px;">
                    <p style="margin:0 0 5px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Roll Number</p>
                    <p style="margin:0;color:#1e3a8a;font-size:18px;font-weight:700;">${student.rollNo}</p>
                </div>
                <div style="background:#ffffff;padding:15px;border-radius:6px;margin-bottom:12px;">
                    <p style="margin:0 0 5px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Login Email</p>
                    <p style="margin:0;color:#333333;font-size:15px;">${student.email}</p>
                </div>
                <div style="background:#ffffff;padding:15px;border-radius:6px;">
                    <p style="margin:0 0 5px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Password</p>
                    <p style="margin:0;color:#dc2626;font-size:18px;font-weight:700;letter-spacing:2px;">${password}</p>
                </div>
            </div>

            <!-- CTA Button -->
            <div style="text-align:center;margin:30px 0;">
                <a href="${websiteUrl}/student-portal.html" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:15px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;box-shadow:0 4px 6px rgba(59,130,246,0.3);">Access Student Portal</a>
            </div>

            <!-- Important Notice -->
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:15px;margin:25px 0;">
                <p style="margin:0 0 8px;color:#c2410c;font-size:14px;font-weight:600;"><i style="margin-right:5px;">⚠️</i> Important Security Notice</p>
                <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.5;">Please change your password immediately after your first login for security purposes. Do not share these credentials with anyone.</p>
            </div>

            <p style="margin:20px 0 0;color:#555555;font-size:14px;line-height:1.6;">
                If you have any questions or need assistance, please don't hesitate to contact our administration team.
            </p>
            <p style="margin:10px 0 0;color:#555555;font-size:14px;line-height:1.6;">
                We look forward to seeing you in class!
            </p>
            <p style="margin:20px 0 0;color:#333333;font-size:15px;font-weight:600;">
                Best regards,<br>
                <span style="color:#3b82f6;">${inst} Team</span>
            </p>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:30px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 10px;color:#64748b;font-size:13px;">&copy; ${new Date().getFullYear()} ${inst}. All rights reserved.</p>
            <p style="margin:0;color:#94a3b8;font-size:12px;">
                <a href="${websiteUrl}" style="color:#3b82f6;text-decoration:none;margin:0 10px;">Website</a> | 
                <a href="mailto:${settings.email || smtpUser}" style="color:#3b82f6;text-decoration:none;margin:0 10px;">Contact Us</a>
            </p>
        </div>
    </div>
</body>
</html>`,
        attachments: logo.attachments
    });
}

app.post('/api/student-auth/request-otp', async (req, res) => {
    const { email } = req.body;
    const students = readData('students.json') || [];
    const student = students.find(s => s.email === email);
    if (!student) return res.status(404).json({ error: 'Is email se koi student registered nahi hai.' });
    const otp = generateOTP();
    otpStore.set(email, { otp, expiry: Date.now() + 5 * 60 * 1000 });
    const settings = readData('settings.json') || {};
    const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
    try {
        const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user: smtpUser, pass: smtpPass } });
        const inst = settings.name || 'Genius Computer Education';
        await transporter.sendMail({
            from: `"${inst}" <${smtpUser}>`,
            to: email,
            subject: `Login OTP - Student Portal | ${inst}`,
            html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;padding:30px 32px;">
<h1 style="margin:0;font-size:24px;font-weight:700;">${inst}</h1>
<p style="margin:6px 0 0;opacity:0.9;font-size:14px;">Student Portal - Login Verification</p>
</div>
<div style="padding:32px;background:#fff;">
<p style="margin:0 0 16px;color:#1f2937;font-size:16px;">Dear <strong>${student.name || 'Student'}</strong>,</p>
<p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">Aapne Student Portal mein login karne ke liye OTP request kiya hai. Aapka verification code neeche diya gaya hai:</p>
<div style="background:#f0f9ff;border:2px solid #3b82f6;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
<p style="margin:0 0 8px;color:#6b7280;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:600;">Your Verification Code</p>
<p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:#1e40af;font-family:'Courier New',monospace;">${otp}</p>
</div>
<p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">Yeh OTP <strong>5 minutes</strong> ke liye valid hai. Isse kisi ke saath share na karein.</p>

<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:24px 0;">
<h3 style="margin:0 0 12px;color:#1e40af;font-size:15px;font-weight:600;">📋 Aapka Account Details:</h3>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
<div><span style="color:#6b7280;font-size:13px;">Roll No:</span> <span style="font-weight:600;color:#1f2937;font-size:14px;">${student.rollNo || '—'}</span></div>
<div><span style="color:#6b7280;font-size:13px;">Course:</span> <span style="font-weight:600;color:#1f2937;font-size:14px;">${student.course || '—'}</span></div>
<div><span style="color:#6b7280;font-size:13px;">Batch:</span> <span style="font-weight:600;color:#1f2937;font-size:14px;">${student.batch || '—'}</span></div>
<div><span style="color:#6b7280;font-size:13px;">Status:</span> <span style="font-weight:600;color:#16a34a;font-size:14px;">${student.status || 'Active'}</span></div>
</div>
</div>

<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:20px 0;border-radius:6px;">
<p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;"><strong>⚠️ Security Notice:</strong> Agar aapne yeh OTP request nahi kiya, to isse ignore karein aur apna password change karein. Koi bhi suspicious activity ho to immediately administration ko inform karein.</p>
</div>

<p style="margin:24px 0 8px;color:#4b5563;font-size:14px;">Student Portal mein login karne ke liye yahan click karein:</p>
<a href="http://localhost:3000/student-portal.html" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Student Portal Login</a>

<div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;">
<h4 style="margin:0 0 8px;color:#1f2937;font-size:14px;font-weight:600;">🔐 Account Security Tips:</h4>
<ul style="margin:0;padding-left:20px;color:#4b5563;font-size:13px;line-height:1.8;">
<li>Apna OTP kabhi kisi ke saath share na karein</li>
<li>Login ke baad logout karna na bhulein</li>
<li>Apna password regularly change karein</li>
<li>Public devices par login karna avoid karein</li>
</ul>
</div>
</div>
<div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
<p style="margin:0 0 8px;color:#6b7280;font-size:12px;">Need help? Contact us:</p>
<p style="margin:0;color:#374151;font-size:13px;">${settings.phone || 'Contact Administration'}</p>
<p style="margin:4px 0 0;color:#6b7280;font-size:12px;">${settings.email || settings.smtpUser || ''}</p>
<p style="margin:8px 0 0;color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} ${inst}. All rights reserved.</p>
</div>
</div>`
        });
        res.json({ success: true, message: 'OTP sent to your email.' });
    } catch (e) { res.status(500).json({ error: 'OTP send nahi ho saka. Admin se contact karein.' }); }
});

app.post('/api/student-auth/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const record = otpStore.get(email);
    if (!record) return res.status(400).json({ error: 'OTP request nahi mili. Phir se try karein.' });
    if (Date.now() > record.expiry) { otpStore.delete(email); return res.status(400).json({ error: 'OTP expire ho gaya. Naya OTP mangaiye.' }); }
    if (record.otp !== otp) return res.status(400).json({ error: 'Galat OTP. Dobara check karein.' });
    otpStore.delete(email);
    const student = (readData('students.json') || []).find(s => s.email === email);
    const sessionToken = createStudentSession(student.id, req);
    res.json({ success: true, student: { ...student, sessionToken } });
});

// Google Sign-In
app.post('/api/student-auth/google-signin', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, error: 'Token required' });
        
        // Decode Google ID token (without verification for now - in production, verify with google-auth-library)
        const parts = token.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        const email = payload.email;
        const name = payload.name;
        
        // Find student by email
        const students = readData('students.json') || [];
        const student = students.find(s => s.email === email);
        
        if (!student) {
            return res.status(404).json({ success: false, error: 'Is email se koi student registered nahi hai.' });
        }
        
        const sessionToken = createStudentSession(student.id, req);
        res.json({ success: true, student: { ...student, sessionToken } });
    } catch (err) {
        console.error('Google sign-in error:', err);
        res.status(500).json({ success: false, error: 'Google sign-in failed. Try email login.' });
    }
});

// --- Students ---
const studentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'photo') cb(null, 'uploads/students/photos');
        else if (file.fieldname === 'signature') cb(null, 'uploads/students/signatures');
        else cb(null, 'uploads/students/documents');
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.fieldname + path.extname(file.originalname))
});
const uploadStudent = multer({ storage: studentStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- Videos ---
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'thumbnail') cb(null, 'uploads/thumbnails');
        else cb(null, 'uploads/videos');
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const uploadVideo = multer({
    storage: videoStorage,
    limits: { fileSize: 1024 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'video' && !file.mimetype.startsWith('video/')) {
            return cb(new Error('Please upload a valid video file.'));
        }
        if (file.fieldname === 'thumbnail' && !file.mimetype.startsWith('image/')) {
            return cb(new Error('Please upload a valid thumbnail image file.'));
        }
        cb(null, true);
    }
});

// --- Assignments ---
const assignmentStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/assignments'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const uploadAssignment = multer({ storage: assignmentStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// --- Bulk Question Upload ---
const bulkUploadStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/bulk-uploads'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const uploadBulk = multer({ storage: bulkUploadStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- Alumni ---
const alumniStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/alumni'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const uploadAlumni = multer({ storage: alumniStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// --- Study Materials ---
const studyMaterialStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/study-materials'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const uploadStudyMaterial = multer({ storage: studyMaterialStorage, limits: { fileSize: 50 * 1024 * 1024 } });

app.get('/api/students', (req, res) => {
    const students = readData('students.json') || [];
    const { course, batch } = req.query;
    
    if (course || batch) {
        const filtered = students.filter(s => {
            const matchCourse = !course || s.course === course;
            const matchBatch = !batch || s.batch === batch;
            return matchCourse && matchBatch;
        });
        res.json(filtered);
    } else {
        res.json(students);
    }
});

app.get('/api/students/:id', (req, res) => {
    const s = (readData('students.json') || []).find(s => s.id == req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
});

app.post('/api/students', uploadStudent.fields([{name:'photo',maxCount:1},{name:'signature',maxCount:1},{name:'documents',maxCount:5}]), (req, res) => {
    const students = readData('students.json') || [];
    const d = req.body;

    // ===== Public/Staff flow detection =====
    // - staffToken: submitted via apply.html when payment is Cash/UPI (mismanagement guard)
    // - verifyToken: applicant email OTP (used for non-Cash/UPI/online-gateway flows)
    // Admin panel calls this endpoint without either token.
    const isPublicFlow = !!(d.verifyToken || d.staffToken);
    let staffInfo = null;
    if (d.staffToken) {
        staffInfo = consumeStaffToken(d.staffToken);
        if (!staffInfo) {
            return res.status(400).json({ success: false, message: 'Staff verification expired ya invalid hai. Dobara OTP verify karein.' });
        }
    } else if (d.verifyToken) {
        const ok = consumeApplyVerifyToken(d.email, d.verifyToken);
        if (!ok) {
            return res.status(400).json({ success: false, message: 'Email verification expired ya invalid hai. Kripya email OTP dobara verify karein.' });
        }
    }

    // ===== Server-side amount verification =====
    // Trust course price from courses.json, NOT client-supplied totalFees
    const courses = readData('courses.json') || [];
    const courseRec = courses.find(c => c.name === d.course);
    if (!courseRec) {
        return res.status(400).json({ success: false, message: 'Selected course valid nahi hai' });
    }
    const total = parseInt(courseRec.fee || courseRec.price) || 0;
    let paid = parseInt(d.amountPaid) || 0;
    const paymentType = (d.paymentType || 'custom').toLowerCase();
    const paymentMode = d.paymentMode || 'Cash';

    // Allow any payment amount (no 40% restriction)
    if (paid < 0) {
        return res.status(400).json({ success: false, message: 'Payment amount valid nahi hai' });
    }
    // Allow payment more than total (advance payment)
    // Public flow restrictions
    if (isPublicFlow) {
        if (!['UPI', 'Online', 'Card'].includes(paymentMode) && paymentMode !== 'Cash') {
            return res.status(400).json({ success: false, message: 'Invalid payment mode' });
        }
        // Cash / UPI = manual entry → MUST have staffToken (mismanagement guard)
        const modeNorm = String(paymentMode).toLowerCase();
        if ((modeNorm === 'cash' || modeNorm === 'upi') && !staffInfo) {
            return res.status(403).json({ success: false, message: 'Cash / UPI payment ke liye Staff verification zaroori hai.' });
        }
        // For UPI, require transaction proof
        if (modeNorm === 'upi' && !d.utrNumber && !d.transactionId) {
            return res.status(400).json({ success: false, message: 'UTR / Transaction ID zaroori hai' });
        }
    }
    const due = Math.max(0, total - paid);

    const receiptNo = generateReceiptNo();
    const applicationId = generateApplicationId();
    const student = {
        id: Date.now(),
        applicationId,
        rollNo: generateRollNo(),
        name: d.name, dob: d.dob, gender: d.gender, category: d.category,
        bloodGroup: d.bloodGroup, phone: d.phone, whatsapp: d.whatsapp,
        email: d.email, aadhar: d.aadhar, address: d.address, reference: d.reference,
        fatherName: d.fatherName, fatherOccupation: d.fatherOccupation,
        fatherPhone: d.fatherPhone, motherName: d.motherName, familyIncome: d.familyIncome,
        qualification: d.qualification ? JSON.parse(d.qualification) : {},
        course: d.course, batch: d.batch, batchId: d.batchId || '',
        admissionDate: d.admissionDate || formatDate(new Date()),
        status: 'Active',
        emailVerified: !!d.verifyToken,
        source: staffInfo ? 'staff' : (isPublicFlow ? 'public' : 'admin'),
        submittedBy: staffInfo ? {
            staffId: staffInfo.id,
            staffName: staffInfo.name,
            staffEmail: staffInfo.email,
            ip: (req.headers['x-forwarded-for'] || req.ip) || '',
            timestamp: new Date().toISOString()
        } : null,
        loginPassword: generatePassword(),
        photo: req.files?.photo ? '/uploads/students/photos/' + req.files.photo[0].filename : '',
        signature: req.files?.signature ? '/uploads/students/signatures/' + req.files.signature[0].filename : '',
        documents: req.files?.documents ? req.files.documents.map(f => '/uploads/students/documents/' + f.filename) : [],
        fees: {
            totalFees: total, paidAmount: paid, dueAmount: due,
            payments: [{ id: Date.now(), date: formatDate(new Date()), amount: paid,
                type: paymentType === 'partial' ? 'Partial Payment (40%)' : 'Full Payment (100%)',
                mode: paymentMode, transactionId: d.transactionId || '',
                upiId: d.upiId || '', utrNumber: d.utrNumber || '', receipt: receiptNo }]
        }
    };
    students.push(student);
    writeData('students.json', students);

    // Add admission payment to payments.json for dashboard revenue tracking
    const payments = readData('payments.json') || [];
    payments.push({
        id: Date.now(),
        studentId: student.id,
        studentName: student.name,
        studentRollNo: student.rollNo,
        course: student.course,
        amount: paid,
        mode: paymentMode,
        type: paymentType === 'partial' ? 'Partial Payment (40%)' : 'Full Payment (100%)',
        transactionId: d.transactionId || '',
        upiId: d.upiId || '',
        utrNo: d.utrNumber || '',
        studentReceipt: receiptNo,
        receipt: receiptNo,
        date: formatDate(new Date()),
        status: 'approved'
    });
    writeData('payments.json', payments);

    const actorType = staffInfo ? 'staff' : (isPublicFlow ? 'public' : 'admin');
    logActivity('student.create', {
        type: actorType,
        id: staffInfo ? staffInfo.id : student.id,
        name: staffInfo ? staffInfo.name : student.name
    }, {
        applicationId, rollNo: student.rollNo, course: student.course, total, paid, paymentMode, receiptNo,
        submittedBy: student.submittedBy || null
    }, req);
    if (d.sendEmail === 'true' && student.email) {
        sendSlipEmail(student, student.fees.payments[0], 'admission').catch(console.error);
        sendLoginCredentials(student, student.loginPassword).catch(console.error);
    }
    res.json({ success: true, student });
});

app.delete('/api/students/:id', (req, res) => {
    const sid = req.params.id;

    // Helper to filter out student from any JSON file
    const cleanFile = (filename, key = 'studentId') => {
        const data = readData(filename) || [];
        const filtered = data.filter(item => item[key] != sid);
        writeData(filename, filtered);
    };

    // 1. Remove student
    let students = readData('students.json') || [];
    const removed = students.find(s => s.id == sid);
    students = students.filter(s => s.id != sid);
    writeData('students.json', students);
    if (removed) {
        logActivity('student.delete', { type: 'admin', id: sid, name: removed.name }, {
            applicationId: removed.applicationId, rollNo: removed.rollNo, course: removed.course
        }, req);
    }

    // 2. Clean all related data files
    cleanFile('payments.json');
    cleanFile('attendance.json');
    cleanFile('certificates.json');
    cleanFile('exam-results.json');
    cleanFile('exam-grades.json');
    cleanFile('exam-attempts.json');
    cleanFile('video-ratings.json');
    cleanFile('video-bookmarks.json');
    cleanFile('video-watch-later.json');
    cleanFile('video-comments.json');
    cleanFile('notifications.json');

    // 3. Remove student's video progress from all videos
    let videos = readData('videos.json') || [];
    videos.forEach(v => {
        if (v.progress && v.progress[sid]) {
            delete v.progress[sid];
        }
    });
    writeData('videos.json', videos);

    res.json({ success: true });
});

app.post('/api/students/:id/payment', (req, res) => {
    const students = readData('students.json') || [];
    const idx = students.findIndex(s => s.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const amt = parseInt(req.body.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Valid payment amount zaroori hai' });
    }
    const status = req.body.status || 'approved'; // Default to approved for backward compatibility
    // Server-side: cannot pay more than dueAmount (only check for approved payments)
    if (status === 'approved') {
        const dueLeft = (students[idx].fees && students[idx].fees.dueAmount) || 0;
        if (amt > dueLeft) {
            return res.status(400).json({ success: false, message: `Pending due ₹${dueLeft} se zyada payment allowed nahi` });
        }
    }
    const payment = {
        id: Date.now(),
        studentId: parseInt(req.params.id),
        studentName: students[idx].name,
        date: formatDate(new Date()),
        amount: amt,
        type: req.body.type || 'Fee Payment',
        mode: req.body.mode || 'Cash',
        transactionId: req.body.transactionId || '',
        utrNo: req.body.utrNo || '',
        studentReceipt: req.body.studentReceipt || req.body.receiptNo || '',
        receipt: generateReceiptNo(),
        status: status
    };
    
    // Add payment to payments.json for tracking
    const payments = readData('payments.json') || [];
    payments.push(payment);
    writeData('payments.json', payments);
    
    // Only add to paidAmount if approved
    if (status === 'approved') {
        students[idx].fees.payments.push(payment);
        students[idx].fees.paidAmount += amt;
        students[idx].fees.dueAmount = Math.max(0, students[idx].fees.dueAmount - amt);
        writeData('students.json', students);
        if (req.body.sendEmail === 'true' && students[idx].email) {
            sendSlipEmail(students[idx], payment, 'payment').catch(console.error);
        }
    }

    logActivity('payment.create', { type: 'student', id: req.params.id, name: students[idx].name }, {
        amount: amt, mode: payment.mode, type: payment.type, receipt: payment.receipt, status
    }, req);

    res.json({ success: true, student: students[idx] });
});

// ===== Activity Logs (Admin View) =====
app.get('/api/activity-logs', (req, res) => {
    const logs = readData('activity-logs.json') || [];
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const action = (req.query.action || '').trim();
    let filtered = logs.slice().reverse(); // newest first
    if (action) filtered = filtered.filter(l => (l.action || '').includes(action));
    res.json({ success: true, total: filtered.length, logs: filtered.slice(0, limit) });
});

// Update student profile (including photo)
app.post('/api/students/:id/update-profile', uploadStudent.single('photo'), (req, res) => {
    const students = readData('students.json') || [];
    const idx = students.findIndex(s => s.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    
    const d = req.body;
    
    // Update basic fields
    if (d.name) students[idx].name = d.name;
    if (d.dob) students[idx].dob = d.dob;
    if (d.gender) students[idx].gender = d.gender;
    if (d.category) students[idx].category = d.category;
    if (d.phone) students[idx].phone = d.phone;
    if (d.email) students[idx].email = d.email;
    if (d.aadhar) students[idx].aadhar = d.aadhar;
    if (d.address) students[idx].address = d.address;
    if (d.fatherName) students[idx].fatherName = d.fatherName;
    if (d.fatherPhone) students[idx].fatherPhone = d.fatherPhone;
    if (d.motherName) students[idx].motherName = d.motherName;
    
    // Update qualification
    if (d.qualification) {
        try {
            students[idx].qualification = typeof d.qualification === 'string' ? JSON.parse(d.qualification) : d.qualification;
        } catch (e) {
            console.error('Error parsing qualification:', e);
        }
    }
    
    // Update photo if uploaded via multer
    if (req.file) {
        students[idx].photo = '/uploads/students/photos/' + req.file.filename;
    }
    
    // Handle base64 photo data (from image cropping)
    if (d.photoBase64) {
        const base64Data = d.photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `profile-${Date.now()}.jpg`;
        const filePath = path.join(__dirname, 'uploads/students/photos', filename);
        fs.writeFileSync(filePath, buffer);
        students[idx].photo = '/uploads/students/photos/' + filename;
    }
    
    writeData('students.json', students);
    res.json({ success: true, student: students[idx] });
});

// Compatibility route: admin panel sends JSON with PUT /api/students/:id
app.put('/api/students/:id', (req, res) => {
    const students = readData('students.json') || [];
    const idx = students.findIndex(s => s.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const d = req.body || {};
    if (d.name !== undefined) students[idx].name = d.name;
    if (d.dob !== undefined) students[idx].dob = d.dob;
    if (d.gender !== undefined) students[idx].gender = d.gender;
    if (d.category !== undefined) students[idx].category = d.category;
    if (d.bloodGroup !== undefined) students[idx].bloodGroup = d.bloodGroup;
    if (d.phone !== undefined) students[idx].phone = d.phone;
    if (d.email !== undefined) students[idx].email = d.email;
    if (d.aadhar !== undefined) students[idx].aadhar = d.aadhar;
    if (d.address !== undefined) students[idx].address = d.address;
    if (d.fatherName !== undefined) students[idx].fatherName = d.fatherName;
    if (d.fatherPhone !== undefined) students[idx].fatherPhone = d.fatherPhone;
    if (d.motherName !== undefined) students[idx].motherName = d.motherName;
    if (d.familyIncome !== undefined) students[idx].familyIncome = d.familyIncome;
    if (d.course !== undefined) students[idx].course = d.course;
    if (d.batch !== undefined) students[idx].batch = d.batch;
    if (d.status !== undefined) students[idx].status = d.status;

    if (d.qualification !== undefined) {
        try {
            students[idx].qualification = typeof d.qualification === 'string'
                ? JSON.parse(d.qualification)
                : d.qualification;
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Invalid qualification data' });
        }
    }

    writeData('students.json', students);
    res.json({ success: true, student: students[idx] });
});

app.post('/api/students/:id/icard-status', (req, res) => {
    const students = readData('students.json') || [];
    const idx = students.findIndex(s => s.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Student not found' });

    students[idx].icardGenerated = !!req.body.icardGenerated;
    writeData('students.json', students);
    res.json({ success: true, student: students[idx] });
});

app.post('/api/students/:id/send-slip', async (req, res) => {
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.id);
    if (!student) return res.status(404).json({ error: 'Not found' });
    try {
        await sendSlipEmail(student, null, 'admission');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// --- Payments Approval Workflow ---
app.get('/api/payments', (req, res) => {
    const payments = readData('payments.json') || [];
    res.json({ success: true, payments });
});

app.get('/api/payments/pending', (req, res) => {
    const payments = readData('payments.json') || [];
    const pendingPayments = payments.filter(p => p.status === 'pending');
    res.json({ success: true, payments: pendingPayments });
});

app.post('/api/payments/:id/approve', (req, res) => {
    const payments = readData('payments.json') || [];
    const paymentIdx = payments.findIndex(p => p._id == req.params.id || p.id == req.params.id);
    if (paymentIdx === -1) return res.status(404).json({ success: false, message: 'Payment not found' });

    const payment = payments[paymentIdx];
    const wasApproved = payment.status === 'approved';

    // Update payment status
    payments[paymentIdx].status = 'approved';
    writeData('payments.json', payments);

    // Update student fees only if not already approved (idempotent)
    if (!wasApproved) {
        const students = readData('students.json') || [];
        const studentIdx = students.findIndex(s => s.id == payment.studentId);
        if (studentIdx !== -1) {
            const student = students[studentIdx];
            student.fees = student.fees || { totalFees: 0, paidAmount: 0, dueAmount: 0, payments: [] };
            student.fees.payments = student.fees.payments || [];

            // Avoid duplicate insertion if same payment id already present
            const dupIdx = student.fees.payments.findIndex(p => p.id == payment.id);
            if (dupIdx === -1) {
                student.fees.payments.push({ ...payment });
            } else {
                student.fees.payments[dupIdx] = { ...payment };
            }

            student.fees.paidAmount = (parseInt(student.fees.paidAmount) || 0) + (parseInt(payment.amount) || 0);
            student.fees.dueAmount = Math.max(0, (parseInt(student.fees.dueAmount) || 0) - (parseInt(payment.amount) || 0));
            writeData('students.json', students);

            logActivity('payment.approve', { type: 'admin', id: payment.id, name: payment.studentName }, {
                paymentId: payment.id, studentId: payment.studentId, amount: payment.amount,
                paidAmount: student.fees.paidAmount, dueAmount: student.fees.dueAmount
            }, req);
        }
    }

    res.json({ success: true, payment: payments[paymentIdx] });
});

app.post('/api/payments/:id/deny', (req, res) => {
    const payments = readData('payments.json') || [];
    const paymentIdx = payments.findIndex(p => p._id == req.params.id || p.id == req.params.id);
    if (paymentIdx === -1) return res.status(404).json({ success: false, message: 'Payment not found' });

    const payment = payments[paymentIdx];
    const wasApproved = payment.status === 'approved';

    // Update payment status to denied
    payments[paymentIdx].status = 'denied';
    writeData('payments.json', payments);

    // If previously approved, reverse the fee deduction
    if (wasApproved) {
        const students = readData('students.json') || [];
        const studentIdx = students.findIndex(s => s.id == payment.studentId);
        if (studentIdx !== -1) {
            const student = students[studentIdx];
            student.fees = student.fees || { totalFees: 0, paidAmount: 0, dueAmount: 0, payments: [] };
            student.fees.payments = (student.fees.payments || []).filter(p => p.id != payment.id);
            student.fees.paidAmount = Math.max(0, (parseInt(student.fees.paidAmount) || 0) - (parseInt(payment.amount) || 0));
            student.fees.dueAmount = (parseInt(student.fees.dueAmount) || 0) + (parseInt(payment.amount) || 0);
            writeData('students.json', students);
        }
    }

    logActivity('payment.deny', { type: 'admin', id: payment.id, name: payment.studentName }, {
        paymentId: payment.id, studentId: payment.studentId, amount: payment.amount, reversed: wasApproved
    }, req);

    res.json({ success: true });
});

// --- Personalized Notifications ---
app.post('/api/notifications/send', (req, res) => {
    try {
        const { studentId, message, type } = req.body;
        if (!studentId || !message) return res.status(400).json({ success: false, message: 'Student ID and message required' });
        
        const notifications = readData('notifications.json') || [];
        const notification = {
            id: Date.now(),
            studentId: parseInt(studentId),
            message: message,
            type: type || 'info',
            date: formatDate(new Date()),
            read: false,
            timestamp: new Date().toISOString()
        };
        
        notifications.unshift(notification);
        writeData('notifications.json', notifications);
        res.json({ success: true, notification });
    } catch (err) {
        console.error('Error sending notification:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

app.post('/api/notifications/send-batch', (req, res) => {
    try {
        const { course, batch, message, type } = req.body;
        if (!course || !batch || !message) return res.status(400).json({ success: false, message: 'Course, batch and message required' });
        
        const students = readData('students.json') || [];
        const targetStudents = students.filter(s => s.course === course && s.batch === batch);
        
        if (targetStudents.length === 0) {
            return res.json({ success: true, count: 0, message: 'No students found in this course and batch' });
        }
        
        const notifications = readData('notifications.json') || [];
        const newNotifications = targetStudents.map(s => ({
            id: Date.now() + Math.random(),
            studentId: s.id,
            message: message,
            type: type || 'info',
            date: formatDate(new Date()),
            read: false,
            timestamp: new Date().toISOString()
        }));
        
        notifications.unshift(...newNotifications);
        writeData('notifications.json', notifications);
        res.json({ success: true, count: targetStudents.length });
    } catch (err) {
        console.error('Error sending batch notification:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
});

app.get('/api/notifications/all', (req, res) => {
    const filePath = path.join(__dirname, 'data', 'notifications.json');
    if (!fs.existsSync(filePath)) {
        return res.json({ success: true, notifications: [] });
    }
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const notifications = JSON.parse(fileContent);
    res.json({ success: true, notifications });
});

app.get('/api/notifications/:studentId', (req, res) => {
    const notifications = readData('notifications.json') || [];
    const studentNotifications = notifications.filter(n => n.studentId == req.params.studentId);
    res.json({ success: true, notifications: studentNotifications });
});

app.post('/api/notifications/:id/read', (req, res) => {
    const notifications = readData('notifications.json') || [];
    const idx = notifications.findIndex(n => n.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Notification not found' });
    
    const { read } = req.body;
    notifications[idx].read = read !== undefined ? read : true;
    writeData('notifications.json', notifications);
    res.json({ success: true });
});

app.put('/api/notifications/:id', (req, res) => {
    const notifications = readData('notifications.json') || [];
    const idx = notifications.findIndex(n => n.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Notification not found' });
    
    const { message, type } = req.body;
    if (message) notifications[idx].message = message;
    if (type) notifications[idx].type = type;
    
    writeData('notifications.json', notifications);
    res.json({ success: true });
});

app.delete('/api/notifications/:id', (req, res) => {
    const notifications = readData('notifications.json') || [];
    const idx = notifications.findIndex(n => n.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Notification not found' });
    
    notifications.splice(idx, 1);
    writeData('notifications.json', notifications);
    res.json({ success: true });
});

// --- Announcements ---
app.get('/api/announcements', (req, res) => {
    const announcements = readData('announcements.json') || [];
    const now = new Date();
    
    // Filter active announcements
    const activeAnnouncements = announcements.filter(a => {
        const expiryDate = a.expiryDate ? new Date(a.expiryDate) : null;
        return !expiryDate || expiryDate >= now;
    });
    
    // Sort by priority and date (urgent first, then by date desc)
    const priorityOrder = { 'urgent': 0, 'important': 1, 'normal': 2 };
    activeAnnouncements.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.date) - new Date(a.date);
    });
    
    res.json({ success: true, announcements: activeAnnouncements });
});

app.get('/api/announcements/student/:studentId', (req, res) => {
    const announcements = readData('announcements.json') || [];
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.studentId);
    
    if (!student) return res.json({ success: true, announcements: [] });
    
    const now = new Date();
    const filteredAnnouncements = announcements.filter(a => {
        const expiryDate = a.expiryDate ? new Date(a.expiryDate) : null;
        if (expiryDate && expiryDate < now) return false;
        
        // Check if announcement is for this student
        if (a.target === 'all') return true;
        if (a.target === 'course' && a.course === student.course) return true;
        if (a.target === 'batch' && a.batch === student.batch) return true;
        if (a.target === 'student' && a.studentId == student.id) return true;
        
        return false;
    });
    
    // Sort by priority and date
    const priorityOrder = { 'urgent': 0, 'important': 1, 'normal': 2 };
    filteredAnnouncements.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.date) - new Date(a.date);
    });
    
    res.json({ success: true, announcements: filteredAnnouncements });
});

app.post('/api/announcements', (req, res) => {
    const { title, content, category, priority, target, course, batch, studentId, expiryDate, attachment } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content required' });
    
    const announcements = readData('announcements.json') || [];
    const announcement = {
        id: Date.now(),
        title: title,
        content: content,
        category: category || 'general',
        priority: priority || 'normal',
        target: target || 'all',
        course: course || '',
        batch: batch || '',
        studentId: studentId || null,
        expiryDate: expiryDate || null,
        attachment: attachment || null,
        date: formatDate(new Date()),
        timestamp: new Date().toISOString(),
        readBy: [],
        readCount: 0
    };
    
    announcements.unshift(announcement);
    writeData('announcements.json', announcements);
    res.json({ success: true, announcement });
});

app.put('/api/announcements/:id', (req, res) => {
    const announcements = readData('announcements.json') || [];
    const idx = announcements.findIndex(a => a.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Announcement not found' });
    
    const { title, content, category, priority, target, course, batch, studentId, expiryDate, attachment } = req.body;
    if (title) announcements[idx].title = title;
    if (content !== undefined) announcements[idx].content = content;
    if (category !== undefined) announcements[idx].category = category;
    if (priority !== undefined) announcements[idx].priority = priority;
    if (target !== undefined) announcements[idx].target = target;
    if (course !== undefined) announcements[idx].course = course;
    if (batch !== undefined) announcements[idx].batch = batch;
    if (studentId !== undefined) announcements[idx].studentId = studentId;
    if (expiryDate !== undefined) announcements[idx].expiryDate = expiryDate;
    if (attachment !== undefined) announcements[idx].attachment = attachment;
    
    writeData('announcements.json', announcements);
    res.json({ success: true, announcement: announcements[idx] });
});

app.delete('/api/announcements/:id', (req, res) => {
    const announcements = readData('announcements.json') || [];
    const idx = announcements.findIndex(a => a.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Announcement not found' });
    
    announcements.splice(idx, 1);
    writeData('announcements.json', announcements);
    res.json({ success: true });
});

app.post('/api/announcements/:id/read', (req, res) => {
    const announcements = readData('announcements.json') || [];
    const idx = announcements.findIndex(a => a.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Announcement not found' });
    
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ success: false, message: 'Student ID required' });
    
    if (!announcements[idx].readBy.includes(parseInt(studentId))) {
        announcements[idx].readBy.push(parseInt(studentId));
        announcements[idx].readCount = announcements[idx].readBy.length;
    }
    
    writeData('announcements.json', announcements);
    res.json({ success: true, readCount: announcements[idx].readCount });
});

// --- Tests/Quiz System ---
app.get('/api/tests', (req, res) => {
    const tests = readData('tests.json') || [];
    res.json({ success: true, tests });
});

app.get('/api/tests/:id', (req, res) => {
    const tests = readData('tests.json') || [];
    const test = tests.find(t => t.id == req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    res.json({ success: true, test });
});

app.get('/api/tests/student/:studentId', (req, res) => {
    const tests = readData('tests.json') || [];
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.studentId);
    
    if (!student) return res.json({ success: true, tests: [] });
    
    const now = new Date();
    const availableTests = tests.filter(t => {
        // Check if test is active
        const startDate = t.startDate ? new Date(t.startDate) : null;
        const endDate = t.endDate ? new Date(t.endDate) : null;
        
        if (startDate && now < startDate) return false;
        if (endDate && now > endDate) return false;
        
        // Check if test is for this student
        if (t.target === 'all') return true;
        if (t.target === 'course' && t.course === student.course) return true;
        if (t.target === 'batch' && t.batch === student.batch) return true;
        
        return false;
    });
    
    // Remove correct answers from questions before sending to student
    const sanitizedTests = availableTests.map(t => ({
        ...t,
        questions: t.questions ? t.questions.map(q => ({
            ...q,
            correctAnswer: undefined,
            options: q.options ? q.options.map(o => ({ text: o.text })) : undefined
        })) : []
    }));
    
    res.json({ success: true, tests: sanitizedTests });
});

app.post('/api/tests', (req, res) => {
    const { title, description, course, batch, target, timeLimit, passingMarks, totalMarks, startDate, endDate, randomizeQuestions, showAnswers, allowRetake, maxAttempts, questions } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    
    const tests = readData('tests.json') || [];
    const test = {
        id: Date.now(),
        title: title,
        description: description || '',
        course: course || '',
        batch: batch || '',
        target: target || 'all',
        timeLimit: timeLimit || 0,
        passingMarks: passingMarks || 0,
        totalMarks: totalMarks || 0,
        startDate: startDate || null,
        endDate: endDate || null,
        randomizeQuestions: randomizeQuestions || false,
        showAnswers: showAnswers || false,
        allowRetake: allowRetake || false,
        maxAttempts: maxAttempts || 1,
        questions: questions || [],
        createdAt: formatDate(new Date()),
        attempts: []
    };
    
    tests.unshift(test);
    writeData('tests.json', tests);
    res.json({ success: true, test });
});

app.put('/api/tests/:id', (req, res) => {
    const tests = readData('tests.json') || [];
    const idx = tests.findIndex(t => t.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Test not found' });
    
    const { title, description, course, batch, target, timeLimit, passingMarks, totalMarks, startDate, endDate, randomizeQuestions, showAnswers, allowRetake, maxAttempts, questions } = req.body;
    if (title !== undefined) tests[idx].title = title;
    if (description !== undefined) tests[idx].description = description;
    if (course !== undefined) tests[idx].course = course;
    if (batch !== undefined) tests[idx].batch = batch;
    if (target !== undefined) tests[idx].target = target;
    if (timeLimit !== undefined) tests[idx].timeLimit = timeLimit;
    if (passingMarks !== undefined) tests[idx].passingMarks = passingMarks;
    if (totalMarks !== undefined) tests[idx].totalMarks = totalMarks;
    if (startDate !== undefined) tests[idx].startDate = startDate;
    if (endDate !== undefined) tests[idx].endDate = endDate;
    if (randomizeQuestions !== undefined) tests[idx].randomizeQuestions = randomizeQuestions;
    if (showAnswers !== undefined) tests[idx].showAnswers = showAnswers;
    if (allowRetake !== undefined) tests[idx].allowRetake = allowRetake;
    if (maxAttempts !== undefined) tests[idx].maxAttempts = maxAttempts;
    if (questions !== undefined) tests[idx].questions = questions;
    
    writeData('tests.json', tests);
    res.json({ success: true, test: tests[idx] });
});

app.delete('/api/tests/:id', (req, res) => {
    const tests = readData('tests.json') || [];
    const idx = tests.findIndex(t => t.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Test not found' });
    
    tests.splice(idx, 1);
    writeData('tests.json', tests);
    res.json({ success: true });
});

app.post('/api/tests/:id/submit', (req, res) => {
    const tests = readData('tests.json') || [];
    const idx = tests.findIndex(t => t.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Test not found' });
    
    const { studentId, answers, timeTaken } = req.body;
    if (!studentId || !answers) return res.status(400).json({ success: false, message: 'Student ID and answers required' });
    
    // Calculate score
    let score = 0;
    const test = tests[idx];
    
    test.questions.forEach((q, i) => {
        const studentAnswer = answers[i];
        if (studentAnswer === q.correctAnswer) {
            score += q.marks || 1;
        }
    });
    
    const attempt = {
        studentId: parseInt(studentId),
        answers: answers,
        score: score,
        timeTaken: timeTaken || 0,
        submittedAt: new Date().toISOString(),
        passed: score >= test.passingMarks
    };
    
    if (!test.attempts) test.attempts = [];
    test.attempts.push(attempt);
    
    writeData('tests.json', tests);
    
    // Save to exam-grades.json for exam history (immediate, not published yet)
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == studentId);
    
    const examGrades = readData('exam-grades.json') || [];
    const percentage = Math.round((score / test.totalMarks) * 100);
    let grade = '';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B+';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 50) grade = 'C';
    else if (percentage >= 40) grade = 'D';
    else grade = 'F';
    
    examGrades.push({
        id: Date.now(),
        studentId: parseInt(studentId),
        studentName: student ? student.name : '',
        course: student ? student.course : '',
        examName: test.title,
        examId: test.id,
        total: test.totalMarks,
        obtained: score,
        percentage: percentage,
        grade: grade,
        status: attempt.passed ? 'Passed' : 'Failed',
        published: false,
        date: formatDate(new Date()),
        timestamp: new Date().toISOString()
    });
    writeData('exam-grades.json', examGrades);
    
    res.json({ 
        success: true, 
        score: score, 
        totalMarks: test.totalMarks, 
        passed: attempt.passed,
        correctAnswers: test.showAnswers ? test.questions.map(q => q.correctAnswer) : undefined
    });
});

app.get('/api/tests/:id/results', (req, res) => {
    const tests = readData('tests.json') || [];
    const test = tests.find(t => t.id == req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    
    res.json({ success: true, attempts: test.attempts || [] });
});

// --- Google Calendar Integration ---
app.post('/api/calendar/set-credentials', (req, res) => {
    const { accessToken, refreshToken } = req.body;
    if (accessToken) {
        calendarOAuth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, message: 'Access token required' });
    }
});

app.get('/api/calendar/events', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const timeMin = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
        const timeMax = endDate ? new Date(endDate).toISOString() : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();
        
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        const events = response.data.items.map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start.date || event.start.dateTime,
            end: event.end.date || event.end.dateTime,
            allDay: !!event.start.date
        }));
        
        res.json({ success: true, events });
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch calendar events', error: error.message });
    }
});

app.get('/api/calendar/holidays', async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        
        // Fetch events for the entire year
        const timeMin = new Date(currentYear, 0, 1).toISOString();
        const timeMax = new Date(currentYear, 11, 31).toISOString();
        
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            q: 'holiday' // Search for events containing "holiday"
        });
        
        const holidays = response.data.items.map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            date: event.start.date || event.start.dateTime,
            allDay: !!event.start.date
        }));
        
        res.json({ success: true, holidays });
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch holidays', error: error.message });
    }
});

// --- Exam Calendar Management ---
app.get('/api/exam-calendar', (req, res) => {
    const examCalendar = readData('examCalendar.json') || [];
    res.json({ success: true, examCalendar });
});

app.post('/api/exam-calendar', (req, res) => {
    const { title, date, time, course, batch, description } = req.body;
    if (!title || !date) return res.status(400).json({ success: false, message: 'Title and date required' });
    
    const examCalendar = readData('examCalendar.json') || [];
    const exam = {
        id: Date.now(),
        title,
        date,
        time: time || '',
        course: course || '',
        batch: batch || '',
        description: description || '',
        createdAt: new Date().toISOString()
    };
    
    examCalendar.push(exam);
    writeData('examCalendar.json', examCalendar);
    res.json({ success: true, exam });
});

app.put('/api/exam-calendar/:id', (req, res) => {
    const examCalendar = readData('examCalendar.json') || [];
    const idx = examCalendar.findIndex(e => e.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Exam not found' });
    
    const { title, date, time, course, batch, description } = req.body;
    if (title) examCalendar[idx].title = title;
    if (date) examCalendar[idx].date = date;
    if (time !== undefined) examCalendar[idx].time = time;
    if (course !== undefined) examCalendar[idx].course = course;
    if (batch !== undefined) examCalendar[idx].batch = batch;
    if (description !== undefined) examCalendar[idx].description = description;
    
    writeData('examCalendar.json', examCalendar);
    res.json({ success: true, exam: examCalendar[idx] });
});

app.delete('/api/exam-calendar/:id', (req, res) => {
    const examCalendar = readData('examCalendar.json') || [];
    const idx = examCalendar.findIndex(e => e.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Exam not found' });
    
    examCalendar.splice(idx, 1);
    writeData('examCalendar.json', examCalendar);
    res.json({ success: true });
});

app.get('/api/exam-calendar/student/:studentId', (req, res) => {
    const examCalendar = readData('examCalendar.json') || [];
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.studentId);
    
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    
    // Filter exams for student's course and batch
    const studentExams = examCalendar.filter(exam => 
        (!exam.course || exam.course === student.course) && 
        (!exam.batch || exam.batch === student.batch)
    );
    
    res.json({ success: true, examCalendar: studentExams });
});

// --- Blog Management ---
// Blog image upload storage
const blogImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/blogs';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'image').replace(/\s+/g, '_'))
});
const uploadBlogImage = multer({
    storage: blogImageStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\//.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files allowed'));
    }
});

// Single image upload (used by Quill editor + cover image)
app.post('/api/upload/blog-image', uploadBlogImage.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = '/uploads/blogs/' + req.file.filename;
    res.json({ success: true, url });
});

// Helper: calculate reading time (avg 200 words/min)
function calcReadingTime(text) {
    if (!text) return 1;
    const words = String(text).replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
}

// Helper: convert title to URL-safe slug
function makeSlug(title) {
    return String(title || '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80) || 'post';
}

// Ensure slug uniqueness across blogs (excluding given id)
function uniqueSlug(blogs, baseSlug, excludeId) {
    let slug = baseSlug;
    let n = 2;
    while (blogs.some(b => b.slug === slug && b.id != excludeId)) {
        slug = baseSlug + '-' + n;
        n++;
    }
    return slug;
}

// Default engagement state for blog
function defaultReactions() { return { helpful: 0, fire: 0, idea: 0, love: 0 }; }
function defaultShares() { return { whatsapp: 0, facebook: 0, twitter: 0, linkedin: 0, copy: 0, total: 0 }; }

// Migrate existing blogs to have slugs + engagement fields + new metadata
function ensureBlogSlugs(blogs) {
    let changed = false;
    blogs.forEach(b => {
        if (!b.slug) {
            b.slug = uniqueSlug(blogs, makeSlug(b.title), b.id);
            changed = true;
        }
        if (typeof b.likes !== 'number') { b.likes = 0; changed = true; }
        if (!b.reactions || typeof b.reactions !== 'object') { b.reactions = defaultReactions(); changed = true; }
        if (!b.shares || typeof b.shares !== 'object') { b.shares = defaultShares(); changed = true; }
        if (!Array.isArray(b.tags)) { b.tags = []; changed = true; }
        if (typeof b.excerpt !== 'string') { b.excerpt = ''; changed = true; }
        if (typeof b.metaTitle !== 'string') { b.metaTitle = ''; changed = true; }
        if (typeof b.metaDescription !== 'string') { b.metaDescription = ''; changed = true; }
        if (typeof b.ogImage !== 'string') { b.ogImage = ''; changed = true; }
        if (!b.status) {
            // Derive: published true -> 'published', else 'draft'
            b.status = b.published === false ? 'draft' : 'published';
            changed = true;
        }
        if (b.scheduledFor === undefined) { b.scheduledFor = null; changed = true; }
        if (!b.updatedAt) { b.updatedAt = b.createdAt; changed = true; }
    });
    if (changed) writeData('blogs.json', blogs);
    return blogs;
}

// Auto-publish scheduled posts whose time has arrived
function autoPublishScheduled(blogs) {
    const now = Date.now();
    let changed = false;
    blogs.forEach(b => {
        if (b.status === 'scheduled' && b.scheduledFor) {
            const t = new Date(b.scheduledFor).getTime();
            if (!isNaN(t) && t <= now) {
                b.status = 'published';
                b.published = true;
                changed = true;
            }
        }
    });
    if (changed) writeData('blogs.json', blogs);
    return blogs;
}

// Normalize tags array (lowercase, trimmed, deduped, max 10)
function normalizeTags(tags) {
    if (!Array.isArray(tags)) {
        if (typeof tags === 'string') tags = tags.split(',');
        else return [];
    }
    const seen = new Set();
    const out = [];
    tags.forEach(t => {
        const v = String(t || '').trim().toLowerCase().replace(/\s+/g, '-').substring(0, 30);
        if (v && !seen.has(v)) { seen.add(v); out.push(v); }
    });
    return out.slice(0, 10);
}

app.get('/api/blogs', (req, res) => {
    let blogs = readData('blogs.json') || [];
    blogs = ensureBlogSlugs(blogs);
    blogs = autoPublishScheduled(blogs);
    // Attach approved comment counts
    const comments = readData('blog_comments.json') || [];
    const commentCounts = {};
    comments.forEach(c => {
        if (c.approved) commentCounts[c.blogId] = (commentCounts[c.blogId] || 0) + 1;
    });
    // Public listing excludes drafts, pending, rejected, and not-yet-due scheduled posts; admin can pass ?all=1
    const isAdminView = req.query.all === '1';
    const authorId = req.query.authorId;
    let filtered = isAdminView ? blogs : blogs.filter(b => b.status === 'published' && b.published !== false);
    // If authorId is provided, filter by that author (for faculty portal)
    if (authorId) {
        filtered = filtered.filter(b => b.authorId == authorId);
    }
    const enriched = filtered.map(b => ({ ...b, commentCount: commentCounts[b.id] || 0 }));
    res.json({ success: true, blogs: enriched });
});

// Get a single blog by slug (clean URL support)
app.get('/api/blogs/by-slug/:slug', (req, res) => {
    let blogs = readData('blogs.json') || [];
    blogs = ensureBlogSlugs(blogs);
    const blog = blogs.find(b => b.slug === req.params.slug && b.published !== false);
    if (!blog) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, blog });
});

// Clean URL route: /blog/:slug → serves blog-post.html
app.get('/blog/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'blog-post.html'));
});

app.post('/api/blogs', (req, res) => {
    const { title, content, category, author, image, pinned, tags, excerpt, metaTitle, metaDescription, ogImage, status, scheduledFor, authorId, authorRole } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content required' });

    const blogs = readData('blogs.json') || [];
    const slug = uniqueSlug(blogs, makeSlug(title));
    
    // Faculty submissions are ALWAYS restricted to draft or pending (admin approval required)
    let finalStatus = (status || 'published').toLowerCase();
    if (authorRole === 'faculty') {
        // Faculty can only choose 'draft' — anything else (published/scheduled/pending) becomes 'pending' awaiting approval
        finalStatus = (finalStatus === 'draft') ? 'draft' : 'pending';
    } else if (!['draft', 'scheduled', 'published', 'pending', 'rejected'].includes(finalStatus)) {
        finalStatus = 'published';
    }
    
    let finalScheduledFor = null;
    if (finalStatus === 'scheduled') {
        const t = scheduledFor ? new Date(scheduledFor) : null;
        if (!t || isNaN(t.getTime())) return res.status(400).json({ success: false, message: 'Valid scheduledFor required for scheduled posts' });
        if (t.getTime() <= Date.now()) {
            // Past time → just publish now
            finalStatus = 'published';
        } else {
            finalScheduledFor = t.toISOString();
        }
    }
    const now = new Date().toISOString();
    const blog = {
        id: Date.now(),
        title,
        slug,
        content,
        category: category || 'General',
        author: author || 'Admin',
        authorId: authorId || null,
        authorRole: authorRole || 'admin',
        image: image || '',
        pinned: pinned === true || pinned === 'true',
        tags: normalizeTags(tags),
        excerpt: String(excerpt || '').trim().substring(0, 300),
        metaTitle: String(metaTitle || '').trim().substring(0, 70),
        metaDescription: String(metaDescription || '').trim().substring(0, 200),
        ogImage: String(ogImage || '').trim(),
        status: finalStatus,
        scheduledFor: finalScheduledFor,
        views: 0,
        likes: 0,
        reactions: defaultReactions(),
        shares: defaultShares(),
        readingTime: calcReadingTime(content),
        createdAt: now,
        updatedAt: now,
        published: finalStatus === 'published'
    };

    blogs.unshift(blog);
    writeData('blogs.json', blogs);
    
    // Send notification if published
    if (finalStatus === 'published') {
        sendBlogPublishNotification(blog);
    }
    
    res.json({ success: true, blog });
});

app.put('/api/blogs/:id', (req, res) => {
    const blogs = readData('blogs.json') || [];
    const idx = blogs.findIndex(b => b.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Blog not found' });

    const { title, content, category, author, image, published, pinned, tags, excerpt, metaTitle, metaDescription, ogImage, status, scheduledFor, authorId, authorRole } = req.body;
    
    // Track previous status for notification
    const previousStatus = blogs[idx].status || 'draft';
    const wasPublished = blogs[idx].published === true;
    if (title && title !== blogs[idx].title) {
        blogs[idx].title = title;
        blogs[idx].slug = uniqueSlug(blogs, makeSlug(title), blogs[idx].id);
    }
    if (content) {
        blogs[idx].content = content;
        blogs[idx].readingTime = calcReadingTime(content);
    }
    if (category !== undefined) blogs[idx].category = category;
    if (author !== undefined) blogs[idx].author = author;
    if (authorId !== undefined) blogs[idx].authorId = authorId;
    if (authorRole !== undefined) blogs[idx].authorRole = authorRole;
    if (image !== undefined) blogs[idx].image = image;
    if (pinned !== undefined) blogs[idx].pinned = pinned === true || pinned === 'true';
    if (tags !== undefined) blogs[idx].tags = normalizeTags(tags);
    if (excerpt !== undefined) blogs[idx].excerpt = String(excerpt).trim().substring(0, 300);
    if (metaTitle !== undefined) blogs[idx].metaTitle = String(metaTitle).trim().substring(0, 70);
    if (metaDescription !== undefined) blogs[idx].metaDescription = String(metaDescription).trim().substring(0, 200);
    if (ogImage !== undefined) blogs[idx].ogImage = String(ogImage).trim();

    if (status !== undefined) {
        let s = String(status).toLowerCase();
        if (!['draft', 'scheduled', 'published', 'pending', 'rejected'].includes(s)) s = 'published';
        // Faculty edits cannot publish/schedule directly — force to draft or pending
        if (authorRole === 'faculty' || blogs[idx].authorRole === 'faculty') {
            s = (s === 'draft') ? 'draft' : 'pending';
        }
        if (s === 'scheduled') {
            const sched = scheduledFor || blogs[idx].scheduledFor;
            const t = sched ? new Date(sched) : null;
            if (!t || isNaN(t.getTime())) return res.status(400).json({ success: false, message: 'Valid scheduledFor required for scheduled posts' });
            if (t.getTime() <= Date.now()) {
                blogs[idx].status = 'published';
                blogs[idx].published = true;
                blogs[idx].scheduledFor = null;
            } else {
                blogs[idx].status = 'scheduled';
                blogs[idx].published = false;
                blogs[idx].scheduledFor = t.toISOString();
            }
        } else {
            blogs[idx].status = s;
            blogs[idx].published = (s === 'published');
            if (s !== 'scheduled') blogs[idx].scheduledFor = null;
        }
    } else if (scheduledFor !== undefined && blogs[idx].status === 'scheduled') {
        const t = new Date(scheduledFor);
        if (!isNaN(t.getTime())) blogs[idx].scheduledFor = t.toISOString();
    }

    // Legacy 'published' boolean still respected if status not given
    if (status === undefined && published !== undefined) {
        blogs[idx].published = !!published;
        blogs[idx].status = published ? 'published' : 'draft';
    }

    if (!blogs[idx].slug) blogs[idx].slug = uniqueSlug(blogs, makeSlug(blogs[idx].title), blogs[idx].id);
    blogs[idx].updatedAt = new Date().toISOString();

    writeData('blogs.json', blogs);
    
    // Send notification if status changed to published
    const newStatus = blogs[idx].status;
    if (newStatus === 'published' && previousStatus !== 'published' && !wasPublished) {
        sendBlogPublishNotification(blogs[idx]);
    }
    
    res.json({ success: true, blog: blogs[idx] });
});

// Admin blog approval endpoints
app.put('/api/admin/blogs/:id/approve', (req, res) => {
    const blogs = readData('blogs.json') || [];
    const idx = blogs.findIndex(b => b.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Blog not found' });
    
    blogs[idx].status = 'published';
    blogs[idx].published = true;
    blogs[idx].updatedAt = new Date().toISOString();
    writeData('blogs.json', blogs);
    
    // Send notification
    sendBlogPublishNotification(blogs[idx]);
    
    res.json({ success: true, blog: blogs[idx] });
});

app.put('/api/admin/blogs/:id/reject', (req, res) => {
    const { rejectionReason } = req.body;
    const blogs = readData('blogs.json') || [];
    const idx = blogs.findIndex(b => b.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Blog not found' });
    
    blogs[idx].status = 'rejected';
    blogs[idx].published = false;
    blogs[idx].rejectionReason = rejectionReason || '';
    blogs[idx].updatedAt = new Date().toISOString();
    writeData('blogs.json', blogs);
    
    res.json({ success: true, blog: blogs[idx] });
});

app.get('/api/admin/blogs/pending', (req, res) => {
    const blogs = readData('blogs.json') || [];
    const pending = blogs.filter(b => b.status === 'pending');
    res.json({ success: true, blogs: pending });
});

// Public: list of all distinct tags with counts (only from published blogs)
app.get('/api/blogs/tags', (req, res) => {
    let blogs = readData('blogs.json') || [];
    blogs = ensureBlogSlugs(blogs);
    blogs = autoPublishScheduled(blogs);
    const counts = {};
    blogs.filter(b => b.status === 'published').forEach(b => {
        (b.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    const tags = Object.entries(counts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
    res.json({ success: true, tags });
});

// Per-post analytics summary (admin)
app.get('/api/admin/blogs/:id/analytics', (req, res) => {
    const blogs = readData('blogs.json') || [];
    const blog = blogs.find(b => b.id == req.params.id);
    if (!blog) return res.status(404).json({ success: false });
    const comments = readData('blog_comments.json') || [];
    const blogComments = comments.filter(c => c.blogId == blog.id);
    res.json({
        success: true,
        analytics: {
            id: blog.id,
            title: blog.title,
            views: blog.views || 0,
            likes: blog.likes || 0,
            reactions: blog.reactions || defaultReactions(),
            shares: blog.shares || defaultShares(),
            commentsTotal: blogComments.length,
            commentsApproved: blogComments.filter(c => c.approved).length,
            commentsPending: blogComments.filter(c => !c.approved).length,
            createdAt: blog.createdAt,
            updatedAt: blog.updatedAt,
            status: blog.status,
            scheduledFor: blog.scheduledFor
        }
    });
});

// ===== SEO: Sitemap.xml =====
app.get('/sitemap.xml', (req, res) => {
    let blogs = readData('blogs.json') || [];
    blogs = ensureBlogSlugs(blogs);
    blogs = autoPublishScheduled(blogs);
    const base = (req.protocol + '://' + req.get('host')).replace(/\/$/, '');
    const staticUrls = ['/', '/blog.html', '/index.html#courses', '/index.html#about', '/index.html#contact'];
    const urls = [];
    staticUrls.forEach(u => {
        urls.push(`<url><loc>${base}${u}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    });
    blogs.filter(b => b.status === 'published').forEach(b => {
        const lastmod = (b.updatedAt || b.createdAt || new Date().toISOString()).substring(0, 10);
        urls.push(`<url><loc>${base}/blog/${encodeURIComponent(b.slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
    });
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
    res.set('Content-Type', 'application/xml').send(xml);
});

// ===== SEO: RSS feed =====
app.get('/blog/rss.xml', (req, res) => {
    let blogs = readData('blogs.json') || [];
    blogs = ensureBlogSlugs(blogs);
    blogs = autoPublishScheduled(blogs);
    const base = (req.protocol + '://' + req.get('host')).replace(/\/$/, '');
    const settings = readData('settings.json') || {};
    const siteName = settings.name || 'Genius Computer Education';
    const items = blogs
        .filter(b => b.status === 'published')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 30)
        .map(b => {
            const desc = b.excerpt || String(b.content || '').replace(/<[^>]+>/g, '').substring(0, 200);
            return `<item>
                <title><![CDATA[${b.title}]]></title>
                <link>${base}/blog/${encodeURIComponent(b.slug)}</link>
                <guid isPermaLink="true">${base}/blog/${encodeURIComponent(b.slug)}</guid>
                <pubDate>${new Date(b.createdAt).toUTCString()}</pubDate>
                <category><![CDATA[${b.category || 'General'}]]></category>
                <description><![CDATA[${desc}]]></description>
            </item>`;
        }).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title><![CDATA[${siteName} - Blog]]></title>
<link>${base}/blog.html</link>
<description><![CDATA[Latest articles from ${siteName}]]></description>
<language>en-IN</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel></rss>`;
    res.set('Content-Type', 'application/rss+xml').send(xml);
});

// Increment view count
app.post('/api/blogs/:id/view', (req, res) => {
    const blogs = readData('blogs.json') || [];
    const idx = blogs.findIndex(b => b.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false });
    blogs[idx].views = (blogs[idx].views || 0) + 1;
    writeData('blogs.json', blogs);
    res.json({ success: true, views: blogs[idx].views });
});

// Like / unlike blog (toggle via action param)
app.post('/api/blogs/:id/like', (req, res) => {
    const { action } = req.body || {};
    const blogs = readData('blogs.json') || [];
    const idx = blogs.findIndex(b => b.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false });
    blogs[idx].likes = blogs[idx].likes || 0;
    if (action === 'unlike') {
        blogs[idx].likes = Math.max(0, blogs[idx].likes - 1);
    } else {
        blogs[idx].likes += 1;
    }
    writeData('blogs.json', blogs);
    res.json({ success: true, likes: blogs[idx].likes });
});

// React to blog with emoji type (helpful/fire/idea/love)
app.post('/api/blogs/:id/react', (req, res) => {
    const { type, action } = req.body || {};
    const allowed = ['helpful', 'fire', 'idea', 'love'];
    if (!allowed.includes(type)) return res.status(400).json({ success: false, message: 'Invalid reaction type' });
    const blogs = readData('blogs.json') || [];
    const idx = blogs.findIndex(b => b.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false });
    if (!blogs[idx].reactions) blogs[idx].reactions = defaultReactions();
    if (action === 'remove') {
        blogs[idx].reactions[type] = Math.max(0, (blogs[idx].reactions[type] || 0) - 1);
    } else {
        blogs[idx].reactions[type] = (blogs[idx].reactions[type] || 0) + 1;
    }
    writeData('blogs.json', blogs);
    res.json({ success: true, reactions: blogs[idx].reactions });
});

// Track share by platform
app.post('/api/blogs/:id/share', (req, res) => {
    const { platform } = req.body || {};
    const allowed = ['whatsapp', 'facebook', 'twitter', 'linkedin', 'copy'];
    if (!allowed.includes(platform)) return res.status(400).json({ success: false });
    const blogs = readData('blogs.json') || [];
    const idx = blogs.findIndex(b => b.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false });
    if (!blogs[idx].shares) blogs[idx].shares = defaultShares();
    blogs[idx].shares[platform] = (blogs[idx].shares[platform] || 0) + 1;
    blogs[idx].shares.total = (blogs[idx].shares.total || 0) + 1;
    writeData('blogs.json', blogs);
    res.json({ success: true, shares: blogs[idx].shares });
});

// ===== Newsletter Subscribers =====

// Send blog publish notification to all subscribers
async function sendBlogPublishNotification(blog) {
    try {
        const subs = readData('newsletter_subscribers.json') || [];
        const activeSubs = subs.filter(s => s.active !== false);
        if (activeSubs.length === 0) return;

        const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
        if (!smtpUser || !smtpPass) {
            console.log('SMTP not configured, skipping blog notification');
            return;
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: smtpPass }
        });

        const inst = settings.instituteName || 'Genius Computer Education';
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const blogUrl = `${baseUrl}/blog/${encodeURIComponent(blog.slug)}`;
        const excerpt = blog.excerpt || blog.content.replace(/<[^>]+>/g, ' ').substring(0, 200) + '...';
        const tagsHtml = (blog.tags || []).length > 0 
            ? `<p style="color:#6b7280;font-size:13px;"><strong>Tags:</strong> ${blog.tags.join(', ')}</p>` 
            : '';

        const mailOptions = {
            from: `"${inst}" <${smtpUser}>`,
            subject: `New Blog Post: ${blog.title}`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb;">
                    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:30px;border-radius:10px;text-align:center;color:#fff;margin-bottom:20px;">
                        <h1 style="margin:0;font-size:28px;">${inst}</h1>
                        <p style="margin:10px 0 0;opacity:0.9;">New Blog Post Published</p>
                    </div>
                    <div style="background:#fff;padding:25px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                        ${blog.image ? `<img src="${blog.image}" alt="${blog.title}" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin-bottom:20px;">` : ''}
                        <h2 style="color:#1f2937;margin:0 0 15px;font-size:24px;">${blog.title}</h2>
                        <p style="color:#4b5563;line-height:1.6;margin-bottom:15px;">${excerpt}</p>
                        ${tagsHtml}
                        <p style="color:#6b7280;font-size:13px;margin-bottom:20px;">
                            <strong>Category:</strong> ${blog.category} | 
                            <strong>Author:</strong> ${blog.author} |
                            <strong>Reading Time:</strong> ${blog.readingTime || 1} min
                        </p>
                        <a href="${blogUrl}" style="display:inline-block;background:#667eea;color:#fff;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:600;">Read Full Article</a>
                    </div>
                    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">
                        You received this email because you subscribed to ${inst} newsletter.<br>
                        <a href="${baseUrl}/unsubscribe" style="color:#6b7280;">Unsubscribe</a>
                    </p>
                </div>
            `
        };

        // Send to all subscribers
        const promises = activeSubs.map(sub => {
            const personalizedOptions = {
                ...mailOptions,
                to: sub.email,
                html: mailOptions.html.replace('Dear Subscriber', sub.name ? `Dear ${sub.name}` : 'Dear Subscriber')
            };
            return transporter.sendMail(personalizedOptions).catch(err => {
                console.error(`Failed to send to ${sub.email}:`, err.message);
            });
        });

        await Promise.all(promises);
        console.log(`Blog notification sent to ${activeSubs.length} subscribers`);
    } catch (err) {
        console.error('Blog notification error:', err);
    }
}

app.post('/api/newsletter/subscribe', (req, res) => {
    const { email, name } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    const subs = readData('newsletter_subscribers.json') || [];
    if (subs.some(s => s.email === cleanEmail)) {
        return res.status(409).json({ success: false, message: 'You are already subscribed!' });
    }
    subs.push({
        id: Date.now(),
        email: cleanEmail,
        name: (name || '').trim(),
        subscribedAt: new Date().toISOString(),
        active: true
    });
    writeData('newsletter_subscribers.json', subs);
    res.json({ success: true, message: 'Subscribed successfully! Thank you for joining our newsletter.' });
});

// Admin: list all newsletter subscribers
app.get('/api/admin/newsletter/subscribers', (req, res) => {
    const subs = readData('newsletter_subscribers.json') || [];
    res.json({ success: true, subscribers: subs });
});

// Admin: delete subscriber
app.delete('/api/admin/newsletter/subscribers/:id', (req, res) => {
    const subs = readData('newsletter_subscribers.json') || [];
    const filtered = subs.filter(s => s.id != req.params.id);
    if (filtered.length === subs.length) return res.status(404).json({ success: false });
    writeData('newsletter_subscribers.json', filtered);
    res.json({ success: true });
});

// ===== Blog Comments =====
function sanitizeComment(text) {
    // Strip HTML tags for safety; keep line breaks
    return String(text || '').replace(/<[^>]+>/g, '').trim();
}

// Public: get approved comments for a blog (with admin replies)
app.get('/api/blogs/:id/comments', (req, res) => {
    const all = readData('blog_comments.json') || [];
    const approved = all.filter(c => c.blogId == req.params.id && c.approved);
    res.json({ success: true, comments: approved });
});

// Public: post a new comment (requires moderation)
app.post('/api/blogs/:id/comments', (req, res) => {
    const blogId = parseInt(req.params.id);
    const { name, email, content, parentId } = req.body || {};
    const cleanName = String(name || '').trim().substring(0, 80);
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanContent = sanitizeComment(content).substring(0, 3000);

    if (!cleanName) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ success: false, message: 'Valid email required' });
    if (!cleanContent || cleanContent.length < 3) return res.status(400).json({ success: false, message: 'Comment is too short' });

    const blogs = readData('blogs.json') || [];
    if (!blogs.some(b => b.id === blogId)) return res.status(404).json({ success: false, message: 'Blog not found' });

    const all = readData('blog_comments.json') || [];
    // Validate parent exists and belongs to same blog
    let validParentId = null;
    if (parentId) {
        const parent = all.find(c => c.id == parentId && c.blogId === blogId);
        if (parent) validParentId = parent.id;
    }
    const comment = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        blogId,
        parentId: validParentId,
        name: cleanName,
        email: cleanEmail,
        content: cleanContent,
        approved: false,
        isAdmin: false,
        createdAt: new Date().toISOString()
    };
    all.push(comment);
    writeData('blog_comments.json', all);
    res.json({ success: true, message: 'Thank you! Your comment is awaiting moderation.', comment: { ...comment, email: undefined } });
});

// Admin: list all comments with optional filter (status=pending/approved/all)
app.get('/api/admin/comments', (req, res) => {
    const status = req.query.status || 'all';
    const all = readData('blog_comments.json') || [];
    const blogs = readData('blogs.json') || [];
    let filtered = all;
    if (status === 'pending') filtered = all.filter(c => !c.approved);
    else if (status === 'approved') filtered = all.filter(c => c.approved);
    // Attach blog title for context
    const enriched = filtered.map(c => {
        const b = blogs.find(x => x.id === c.blogId);
        return { ...c, blogTitle: b ? b.title : '(deleted blog)', blogSlug: b ? b.slug : null };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, comments: enriched, pendingCount: all.filter(c => !c.approved).length });
});

// Admin: approve comment
app.put('/api/admin/comments/:id/approve', (req, res) => {
    const all = readData('blog_comments.json') || [];
    const idx = all.findIndex(c => c.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false });
    all[idx].approved = true;
    writeData('blog_comments.json', all);
    res.json({ success: true });
});

// Admin: unapprove (set back to pending)
app.put('/api/admin/comments/:id/unapprove', (req, res) => {
    const all = readData('blog_comments.json') || [];
    const idx = all.findIndex(c => c.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false });
    all[idx].approved = false;
    writeData('blog_comments.json', all);
    res.json({ success: true });
});

// Admin: reply to a comment (auto-approved, marked as admin)
app.post('/api/admin/comments/:id/reply', (req, res) => {
    const { content, name } = req.body || {};
    const cleanContent = sanitizeComment(content).substring(0, 3000);
    if (!cleanContent || cleanContent.length < 1) return res.status(400).json({ success: false, message: 'Reply cannot be empty' });

    const all = readData('blog_comments.json') || [];
    const parent = all.find(c => c.id == req.params.id);
    if (!parent) return res.status(404).json({ success: false });

    const reply = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        blogId: parent.blogId,
        parentId: parent.id,
        name: (name || 'Admin').trim(),
        email: 'admin@internal',
        content: cleanContent,
        approved: true,
        isAdmin: true,
        createdAt: new Date().toISOString()
    };
    all.push(reply);
    // Auto-approve parent if it isn't approved yet
    const parentIdx = all.findIndex(c => c.id == req.params.id);
    if (parentIdx !== -1 && !all[parentIdx].approved) all[parentIdx].approved = true;
    writeData('blog_comments.json', all);
    res.json({ success: true, reply });
});

// Admin: delete comment (and its replies)
app.delete('/api/admin/comments/:id', (req, res) => {
    const all = readData('blog_comments.json') || [];
    const id = parseInt(req.params.id);
    const filtered = all.filter(c => c.id !== id && c.parentId !== id);
    if (filtered.length === all.length) return res.status(404).json({ success: false });
    writeData('blog_comments.json', filtered);
    res.json({ success: true });
});

// Admin: bulk approve / delete
app.post('/api/admin/comments/bulk', (req, res) => {
    const { ids, action } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false });
    let all = readData('blog_comments.json') || [];
    const idSet = new Set(ids.map(Number));
    if (action === 'approve') {
        all.forEach(c => { if (idSet.has(c.id)) c.approved = true; });
    } else if (action === 'delete') {
        all = all.filter(c => !idSet.has(c.id) && !idSet.has(c.parentId));
    } else {
        return res.status(400).json({ success: false, message: 'Unknown action' });
    }
    writeData('blog_comments.json', all);
    res.json({ success: true });
});

app.delete('/api/blogs/:id', (req, res) => {
    const blogs = readData('blogs.json') || [];
    const idx = blogs.findIndex(b => b.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Blog not found' });
    
    blogs.splice(idx, 1);
    writeData('blogs.json', blogs);
    res.json({ success: true });
});

// --- Local Holidays/Events Management ---
app.get('/api/holidays', (req, res) => {
    const holidays = readData('holidays.json') || [];
    res.json({ success: true, holidays });
});

app.post('/api/holidays', (req, res) => {
    const { date, title, description, type } = req.body;
    if (!date || !title) return res.status(400).json({ success: false, message: 'Date and title required' });
    
    const holidays = readData('holidays.json') || [];
    const holiday = {
        id: Date.now(),
        date,
        title,
        description: description || '',
        type: type || 'holiday', // holiday, event, festival
        createdAt: new Date().toISOString()
    };
    
    holidays.push(holiday);
    writeData('holidays.json', holidays);
    res.json({ success: true, holiday });
});

app.put('/api/holidays/:id', (req, res) => {
    const holidays = readData('holidays.json') || [];
    const idx = holidays.findIndex(h => h.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Holiday not found' });
    
    const { date, title, description, type } = req.body;
    if (date) holidays[idx].date = date;
    if (title) holidays[idx].title = title;
    if (description !== undefined) holidays[idx].description = description;
    if (type) holidays[idx].type = type;
    
    writeData('holidays.json', holidays);
    res.json({ success: true, holiday: holidays[idx] });
});

app.delete('/api/holidays/:id', (req, res) => {
    const holidays = readData('holidays.json') || [];
    const idx = holidays.findIndex(h => h.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Holiday not found' });
    
    holidays.splice(idx, 1);
    writeData('holidays.json', holidays);
    res.json({ success: true });
});

app.get('/api/holidays/by-date/:date', (req, res) => {
    const holidays = readData('holidays.json') || [];
    const holidayOnDate = holidays.find(h => h.date === req.params.date);
    res.json({ success: true, holiday: holidayOnDate || null });
});

// --- Attendance Management ---
app.get('/api/attendance', (req, res) => {
    const attendance = readData('attendance.json') || [];
    res.json({ success: true, attendance });
});

app.get('/api/attendance/:studentId', (req, res) => {
    const attendance = readData('attendance.json') || [];
    const studentAttendance = attendance.filter(a => a.studentId == req.params.studentId);
    
    // Calculate attendance statistics
    const present = studentAttendance.filter(a => a.status === 'present').length;
    const absent = studentAttendance.filter(a => a.status === 'absent').length;
    const holiday = studentAttendance.filter(a => a.status === 'holiday').length;
    const late = studentAttendance.filter(a => a.status === 'late').length;
    const total = studentAttendance.length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    
    res.json({ 
        success: true, 
        attendance: {
            present,
            absent,
            holiday,
            late,
            total,
            percentage,
            records: studentAttendance
        }
    });
});

app.post('/api/attendance', (req, res) => {
    const { studentId, date, status, course, batch } = req.body;
    if (!studentId || !date || !status) return res.status(400).json({ success: false, message: 'Student ID, date, and status required' });
    
    const attendance = readData('attendance.json') || [];
    const record = {
        id: Date.now(),
        studentId: parseInt(studentId),
        date: date,
        status: status, // present, absent, holiday
        course: course || '',
        batch: batch || '',
        timestamp: new Date().toISOString()
    };
    
    attendance.push(record);
    writeData('attendance.json', attendance);
    res.json({ success: true, record });
});

app.put('/api/attendance/:id', (req, res) => {
    const attendance = readData('attendance.json') || [];
    const idx = attendance.findIndex(a => a.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    
    const { status, course, batch } = req.body;
    if (status) attendance[idx].status = status;
    if (course) attendance[idx].course = course;
    if (batch) attendance[idx].batch = batch;
    
    writeData('attendance.json', attendance);
    res.json({ success: true, record: attendance[idx] });
});

app.delete('/api/attendance/:id', (req, res) => {
    const attendance = readData('attendance.json') || [];
    const idx = attendance.findIndex(a => a.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    
    attendance.splice(idx, 1);
    writeData('attendance.json', attendance);
    res.json({ success: true });
});

// --- Study Materials ---
app.get('/api/study-materials', (req, res) => {
    const materials = readData('study-materials.json') || [];
    if (req.query.course) {
        const filtered = materials.filter(m => m.course === req.query.course);
        res.json({ success: true, materials: filtered });
    } else {
        res.json({ success: true, materials });
    }
});

app.post('/api/study-materials', uploadStudyMaterial.single('file'), (req, res) => {
    const { title, course, type, description, author, category, difficulty, tags, batch } = req.body;
    if (!title || !course || !type) return res.status(400).json({ success: false, message: 'Title, course, and type required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'File required' });
    
    const materials = readData('study-materials.json') || [];
    const material = {
        id: Date.now(),
        title: title,
        course: course,
        type: type,
        url: '/uploads/study-materials/' + req.file.filename,
        size: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
        description: description || '',
        author: author || 'Admin',
        category: category || 'General',
        difficulty: difficulty || 'Beginner',
        tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
        batch: batch || '',
        date: formatDate(new Date()),
        timestamp: new Date().toISOString(),
        viewCount: 0,
        downloadCount: 0
    };
    
    materials.push(material);
    writeData('study-materials.json', materials);
    res.json({ success: true, material });
});

app.put('/api/study-materials/:id', (req, res) => {
    const materials = readData('study-materials.json') || [];
    const idx = materials.findIndex(m => m.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Material not found' });
    
    const { title, course, type, url, size, description, author, category, difficulty, tags, batch } = req.body;
    if (title) materials[idx].title = title;
    if (course) materials[idx].course = course;
    if (type) materials[idx].type = type;
    if (url) materials[idx].url = url;
    if (size) materials[idx].size = size;
    if (description !== undefined) materials[idx].description = description;
    if (author !== undefined) materials[idx].author = author;
    if (category !== undefined) materials[idx].category = category;
    if (difficulty !== undefined) materials[idx].difficulty = difficulty;
    if (tags !== undefined) materials[idx].tags = tags;
    if (batch !== undefined) materials[idx].batch = batch;
    
    writeData('study-materials.json', materials);
    res.json({ success: true, material: materials[idx] });
});

app.delete('/api/study-materials/:id', (req, res) => {
    const materials = readData('study-materials.json') || [];
    const idx = materials.findIndex(m => m.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Material not found' });
    
    materials.splice(idx, 1);
    writeData('study-materials.json', materials);
    res.json({ success: true });
});

app.post('/api/study-materials/:id/view', (req, res) => {
    const materials = readData('study-materials.json') || [];
    const idx = materials.findIndex(m => m.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Material not found' });
    
    materials[idx].viewCount = (materials[idx].viewCount || 0) + 1;
    writeData('study-materials.json', materials);
    res.json({ success: true, viewCount: materials[idx].viewCount });
});

app.post('/api/study-materials/:id/download', (req, res) => {
    const materials = readData('study-materials.json') || [];
    const idx = materials.findIndex(m => m.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Material not found' });
    
    materials[idx].downloadCount = (materials[idx].downloadCount || 0) + 1;
    writeData('study-materials.json', materials);
    res.json({ success: true, downloadCount: materials[idx].downloadCount });
});

// --- Exam Results ---
app.get('/api/exam-results', (req, res) => {
    const results = readData('exam-results.json') || [];
    res.json({ success: true, results });
});

app.get('/api/exam-results/:studentId', (req, res) => {
    const results = readData('exam-results.json') || [];
    const studentResults = results.filter(r => r.studentId == req.params.studentId);
    res.json({ success: true, results: studentResults });
});

app.post('/api/exam-results', (req, res) => {
    const { studentId, studentName, course, examName, totalMarks, obtainedMarks, percentage, grade, date } = req.body;
    if (!studentId || !examName || !totalMarks || !obtainedMarks) return res.status(400).json({ success: false, message: 'Student ID, exam name, and marks required' });
    
    const results = readData('exam-results.json') || [];
    const result = {
        id: Date.now(),
        studentId: parseInt(studentId),
        studentName: studentName || '',
        course: course || '',
        examName: examName,
        totalMarks: parseInt(totalMarks),
        obtainedMarks: parseInt(obtainedMarks),
        percentage: percentage || Math.round((parseInt(obtainedMarks) / parseInt(totalMarks)) * 100),
        grade: grade || '',
        date: date || formatDate(new Date()),
        timestamp: new Date().toISOString()
    };
    
    results.push(result);
    writeData('exam-results.json', results);
    res.json({ success: true, result });
});

app.put('/api/exam-results/:id', (req, res) => {
    const results = readData('exam-results.json') || [];
    const idx = results.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Result not found' });
    
    const { examName, totalMarks, obtainedMarks, percentage, grade, date } = req.body;
    if (examName) results[idx].examName = examName;
    if (totalMarks) results[idx].totalMarks = parseInt(totalMarks);
    if (obtainedMarks) {
        results[idx].obtainedMarks = parseInt(obtainedMarks);
        results[idx].percentage = Math.round((parseInt(obtainedMarks) / results[idx].totalMarks) * 100);
    }
    if (percentage) results[idx].percentage = percentage;
    if (grade) results[idx].grade = grade;
    if (date) results[idx].date = date;
    
    writeData('exam-results.json', results);
    res.json({ success: true, result: results[idx] });
});

app.delete('/api/exam-results/:id', (req, res) => {
    const results = readData('exam-results.json') || [];
    const idx = results.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Result not found' });
    
    results.splice(idx, 1);
    writeData('exam-results.json', results);
    res.json({ success: true });
});

// --- Certificates ---
app.get('/api/certificates', (req, res) => {
    const certificates = readData('certificates.json') || [];
    res.json({ success: true, certificates });
});

app.get('/api/certificates/:studentId', (req, res) => {
    const certificates = readData('certificates.json') || [];
    const studentCertificates = certificates.filter(c => c.studentId == req.params.studentId);
    res.json({ success: true, certificates: studentCertificates });
});

app.post('/api/certificates', (req, res) => {
    const { studentId, studentName, certificateType, issueDate, grade, remarks, template, certificateNumber, 
            achievementTitle, awardRank,
            eventName, eventDuration, eventLocation, participationLevel,
            excellenceCategory, excellenceAward,
            internshipRole, companyName, internshipDuration, performanceRating,
            attendancePeriod, attendancePercentage } = req.body;
    
    if (!studentId || !certificateType) return res.status(400).json({ success: false, message: 'Student ID and certificate type required' });
    
    const certificates = readData('certificates.json') || [];
    
    // Generate certificate number if not provided
    const certNumber = certificateNumber || `GCE-CERT-${new Date().getFullYear()}-${String(certificates.length + 1).padStart(4, '0')}`;
    
    const certificate = {
        id: Date.now(),
        studentId: parseInt(studentId),
        studentName: studentName || '',
        certificateType: certificateType,
        issueDate: issueDate || formatDate(new Date()),
        grade: grade || '',
        remarks: remarks || '',
        template: template || 'classic',
        certificateNumber: certNumber,
        achievementTitle: achievementTitle || '',
        awardRank: awardRank || '',
        eventName: eventName || '',
        eventDuration: eventDuration || '',
        eventLocation: eventLocation || '',
        participationLevel: participationLevel || '',
        excellenceCategory: excellenceCategory || '',
        excellenceAward: excellenceAward || '',
        internshipRole: internshipRole || '',
        companyName: companyName || '',
        internshipDuration: internshipDuration || '',
        performanceRating: performanceRating || '',
        attendancePeriod: attendancePeriod || '',
        attendancePercentage: attendancePercentage || '',
        timestamp: new Date().toISOString()
    };
    
    certificates.push(certificate);
    writeData('certificates.json', certificates);
    res.json({ success: true, certificate });
});

// Bulk certificate generation for batch
app.post('/api/certificates/batch', (req, res) => {
    const { studentIds, certificateType, issueDate, grade, remarks, template } = req.body;
    if (!studentIds || !certificateType) return res.status(400).json({ success: false, message: 'Student IDs and certificate type required' });
    
    const certificates = readData('certificates.json') || [];
    const students = readData('students.json') || [];
    
    const newCertificates = studentIds.map(studentId => {
        const student = students.find(s => s.id == studentId);
        const certNumber = `GCE-CERT-${new Date().getFullYear()}-${String(certificates.length + 1).padStart(4, '0')}`;
        certificates.push({}); // Increment count for numbering
        
        return {
            id: Date.now() + Math.random(),
            studentId: parseInt(studentId),
            studentName: student ? student.name : '',
            certificateType: certificateType,
            issueDate: issueDate || formatDate(new Date()),
            grade: grade || '',
            remarks: remarks || '',
            template: template || 'classic',
            certificateNumber: certNumber,
            timestamp: new Date().toISOString()
        };
    });
    
    // Remove the temporary empty entries
    certificates.splice(certificates.length - studentIds.length, studentIds.length);
    
    // Add the actual certificates
    certificates.push(...newCertificates);
    writeData('certificates.json', certificates);
    
    res.json({ success: true, count: newCertificates.length, certificates: newCertificates });
});

app.delete('/api/certificates/:id', (req, res) => {
    const certificates = readData('certificates.json') || [];
    const idx = certificates.findIndex(c => c.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Certificate not found' });
    
    certificates.splice(idx, 1);
    writeData('certificates.json', certificates);
    res.json({ success: true });
});

// --- Videos (Video Learning Platform) ---
app.get('/api/videos', (req, res) => {
    const videos = readData('videos.json') || [];
    res.json(videos);
});

app.get('/api/videos/:id', (req, res) => {
    const videos = readData('videos.json') || [];
    const video = videos.find(v => v.id == req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
});

app.get('/api/videos/course/:courseId', (req, res) => {
    const videos = readData('videos.json') || [];
    const courseVideos = videos.filter(v => v.courseId == req.params.courseId);
    res.json(courseVideos);
});

app.post('/api/videos', uploadVideo.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req, res) => {
    const videos = readData('videos.json') || [];
    const videoFile = req.files && req.files.video ? req.files.video[0] : null;
    const thumbFile = req.files && req.files.thumbnail ? req.files.thumbnail[0] : null;
    const title = (req.body.title || '').trim();
    const courseId = (req.body.courseId || '').trim();
    const videoUrlInput = (req.body.videoUrl || '').trim();

    if (!title) {
        return res.status(400).json({ success: false, message: 'Video title is required' });
    }
    if (!courseId) {
        return res.status(400).json({ success: false, message: 'Course is required' });
    }
    if (!videoFile && !videoUrlInput) {
        return res.status(400).json({ success: false, message: 'Please provide a video file or video URL' });
    }

    let thumbnail = req.body.thumbnail || '';

    if (thumbFile) {
        thumbnail = '/uploads/thumbnails/' + thumbFile.filename;
        try { imageSize(thumbFile.path); } catch (e) { /* dimensions read failed, thumbnail still valid */ }
    }

    const video = {
        id: Date.now(),
        title,
        description: req.body.description,
        courseId,
        chapterId: req.body.chapterId || null,
        videoUrl: videoFile ? '/uploads/videos/' + videoFile.filename : videoUrlInput,
        thumbnail: thumbnail,
        duration: req.body.duration || 0,
        category: req.body.category || 'General',
        subtitleUrl: req.body.subtitleUrl || '',
        watermarkText: req.body.watermarkText || '',
        lastNotifiedAt: '',
        lastNotificationSent: 0,
        availabilityStart: req.body.availabilityStart || '',
        availabilityEnd: req.body.availabilityEnd || '',
        expiryDays: parseInt(req.body.expiryDays) || 0,
        enforceSingleSession: req.body.enforceSingleSession === 'true' || req.body.enforceSingleSession === true,
        uploadedAt: new Date().toISOString(),
        views: 0,
        progress: {} // Track student progress: { studentId: { currentTime, completed, lastWatched } }
    };
    videos.push(video);
    writeData('videos.json', videos);
    res.json({ success: true, video });
});

app.put('/api/videos/:id', uploadVideo.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req, res) => {
    const videos = readData('videos.json') || [];
    const idx = videos.findIndex(v => v.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Video not found' });

    const videoFile = req.files && req.files.video ? req.files.video[0] : null;
    const thumbFile = req.files && req.files.thumbnail ? req.files.thumbnail[0] : null;
    let thumbnail = videos[idx].thumbnail;

    if (thumbFile) {
        thumbnail = '/uploads/thumbnails/' + thumbFile.filename;
        try { imageSize(thumbFile.path); } catch (e) { /* dimensions read failed, thumbnail still valid */ }
    } else if (req.body.thumbnail !== undefined) {
        thumbnail = req.body.thumbnail;
    }

    videos[idx] = {
        ...videos[idx],
        title: req.body.title || videos[idx].title,
        description: req.body.description || videos[idx].description,
        courseId: req.body.courseId || videos[idx].courseId,
        chapterId: req.body.chapterId !== undefined ? req.body.chapterId : videos[idx].chapterId,
        videoUrl: videoFile
            ? '/uploads/videos/' + videoFile.filename
            : (req.body.videoUrl !== undefined && String(req.body.videoUrl).trim() !== ''
                ? String(req.body.videoUrl).trim()
                : videos[idx].videoUrl),
        thumbnail: thumbnail,
        duration: req.body.duration || videos[idx].duration,
        category: req.body.category || videos[idx].category,
        subtitleUrl: req.body.subtitleUrl !== undefined ? req.body.subtitleUrl : (videos[idx].subtitleUrl || ''),
        watermarkText: req.body.watermarkText !== undefined ? req.body.watermarkText : (videos[idx].watermarkText || ''),
        lastNotifiedAt: videos[idx].lastNotifiedAt || '',
        lastNotificationSent: videos[idx].lastNotificationSent || 0,
        availabilityStart: req.body.availabilityStart !== undefined ? req.body.availabilityStart : (videos[idx].availabilityStart || ''),
        availabilityEnd: req.body.availabilityEnd !== undefined ? req.body.availabilityEnd : (videos[idx].availabilityEnd || ''),
        expiryDays: req.body.expiryDays !== undefined ? (parseInt(req.body.expiryDays) || 0) : (videos[idx].expiryDays || 0),
        enforceSingleSession: req.body.enforceSingleSession !== undefined
            ? (req.body.enforceSingleSession === 'true' || req.body.enforceSingleSession === true)
            : !!videos[idx].enforceSingleSession
    };
    writeData('videos.json', videos);
    res.json({ success: true, video: videos[idx] });
});

// Multer error handler for video uploads
app.use('/api/videos', (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File size too large. Maximum allowed is 1GB.' });
        return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
    next();
});

app.delete('/api/videos/:id', (req, res) => {
    const videos = readData('videos.json') || [];
    const idx = videos.findIndex(v => v.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Video not found' });
    
    videos.splice(idx, 1);
    writeData('videos.json', videos);
    res.json({ success: true });
});

// Increment video view count (session check is best-effort for single-session enforcement)
app.post('/api/videos/:id/view', (req, res) => {
    const studentId = req.body.studentId || req.query.studentId;
    // Best-effort session check — don't block view count on stale tokens
    let sessionOk = true;
    if (studentId) {
        const token = getStudentSessionToken(req);
        if (token) {
            const sessions = readData('student-sessions.json') || [];
            const record = sessions.find(s => String(s.studentId) === String(studentId) && s.token === token);
            sessionOk = !!record;
            if (record) {
                record.lastSeen = new Date().toISOString();
                writeData('student-sessions.json', sessions);
            }
        } else {
            sessionOk = false;
        }
    }

    const videos = readData('videos.json') || [];
    const idx = videos.findIndex(v => v.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Video not found' });

    if (sessionOk && studentId && videos[idx].enforceSingleSession && isVideoSingleSessionBlocked(studentId, req.params.id)) {
        return res.status(409).json({ success: false, message: 'Another video session is active on your account.' });
    }
    if (sessionOk && studentId && videos[idx].enforceSingleSession) touchVideoSingleSession(studentId, req.params.id);

    videos[idx].views = (videos[idx].views || 0) + 1;
    writeData('videos.json', videos);
    res.json({ success: true, views: videos[idx].views });
});

app.post('/api/videos/:id/progress', (req, res) => {
    const videos = readData('videos.json') || [];
    const video = videos.find(v => v.id == req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    
    const { studentId, currentTime, completed } = req.body;
    if (!ensureStudentSession(req, res, studentId)) return;

    if (video.enforceSingleSession && isVideoSingleSessionBlocked(studentId, req.params.id)) {
        return res.status(409).json({ success: false, message: 'Another video session is active on your account.' });
    }
    if (video.enforceSingleSession) touchVideoSingleSession(studentId, req.params.id);

    if (!video.progress) video.progress = {};
    const existing = video.progress[studentId] || {};
    const nowIso = new Date().toISOString();
    const shouldSetFirstWatch = ((currentTime || 0) > 0 || !!completed) && !existing.firstWatchedAt;
    
    video.progress[studentId] = {
        currentTime: currentTime || 0,
        completed: completed || false,
        lastWatched: nowIso,
        firstWatchedAt: existing.firstWatchedAt || (shouldSetFirstWatch ? nowIso : null)
    };
    
    writeData('videos.json', videos);
    res.json({ success: true, progress: video.progress[studentId] });
});

app.get('/api/videos/:id/progress/:studentId', (req, res) => {
    // Read-only progress lookup; no session gate to avoid 401 spam on stale tokens.
    const videos = readData('videos.json') || [];
    const video = videos.find(v => v.id == req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });

    const progress = video.progress && video.progress[req.params.studentId] ? video.progress[req.params.studentId] : { currentTime: 0, completed: false };
    res.json({ success: true, progress });
});

// --- Chapters ---
app.get('/api/chapters', (req, res) => {
    const chapters = readData('chapters.json') || [];
    if (req.query.courseId) {
        res.json(chapters.filter(c => c.courseId == req.query.courseId).sort((a, b) => a.order - b.order));
    } else {
        res.json(chapters.sort((a, b) => a.order - b.order));
    }
});

app.post('/api/chapters', (req, res) => {
    const chapters = readData('chapters.json') || [];
    const chapter = {
        id: Date.now(),
        courseId: req.body.courseId,
        name: req.body.name,
        order: req.body.order || chapters.filter(c => c.courseId == req.body.courseId).length + 1,
        createdAt: new Date().toISOString()
    };
    chapters.push(chapter);
    writeData('chapters.json', chapters);
    res.json({ success: true, chapter });
});

app.put('/api/chapters/:id', (req, res) => {
    const chapters = readData('chapters.json') || [];
    const idx = chapters.findIndex(c => c.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Chapter not found' });
    chapters[idx] = { ...chapters[idx], name: req.body.name || chapters[idx].name, order: req.body.order !== undefined ? req.body.order : chapters[idx].order };
    writeData('chapters.json', chapters);
    res.json({ success: true, chapter: chapters[idx] });
});

app.delete('/api/chapters/:id', (req, res) => {
    const chapters = readData('chapters.json') || [];
    const idx = chapters.findIndex(c => c.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Chapter not found' });
    chapters.splice(idx, 1);
    writeData('chapters.json', chapters);
    res.json({ success: true });
});

// =========================================
// BATCH 1 APIs: Bookmarks, Resources, Quiz
// =========================================

// --- Bookmarks ---
app.get('/api/videos/:id/bookmarks/:studentId', (req, res) => {
    const bookmarks = readData('video-bookmarks.json') || [];
    const list = bookmarks.filter(b => b.videoId == req.params.id && b.studentId == req.params.studentId);
    res.json({ success: true, bookmarks: list });
});

app.post('/api/videos/:id/bookmarks', (req, res) => {
    const bookmarks = readData('video-bookmarks.json') || [];
    const { studentId, timestamp, label } = req.body;
    if (!studentId || timestamp == null) return res.status(400).json({ success: false, message: 'Missing data' });
    const bookmark = {
        id: Date.now(),
        videoId: parseInt(req.params.id),
        studentId,
        timestamp: parseFloat(timestamp),
        label: label || 'Bookmark',
        createdAt: new Date().toISOString()
    };
    bookmarks.push(bookmark);
    writeData('video-bookmarks.json', bookmarks);
    res.json({ success: true, bookmark });
});

app.delete('/api/videos/bookmarks/:bookmarkId', (req, res) => {
    const bookmarks = readData('video-bookmarks.json') || [];
    const filtered = bookmarks.filter(b => b.id != req.params.bookmarkId);
    writeData('video-bookmarks.json', filtered);
    res.json({ success: true });
});

// --- Attached Resources (PDFs/Files per video) ---
const uploadResource = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, 'uploads/video-resources');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
    }),
    limits: { fileSize: 50 * 1024 * 1024 }
});

app.get('/api/videos/:id/resources', (req, res) => {
    const resources = readData('video-resources.json') || [];
    const list = resources.filter(r => r.videoId == req.params.id);
    res.json({ success: true, resources: list });
});

app.post('/api/videos/:id/resources', uploadResource.single('file'), (req, res) => {
    const resources = readData('video-resources.json') || [];
    const { title, description } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'File required' });
    const resource = {
        id: Date.now(),
        videoId: parseInt(req.params.id),
        title: title || req.file.originalname,
        description: description || '',
        fileUrl: '/uploads/video-resources/' + req.file.filename,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString()
    };
    resources.push(resource);
    writeData('video-resources.json', resources);
    res.json({ success: true, resource });
});

app.delete('/api/videos/resources/:resourceId', (req, res) => {
    const resources = readData('video-resources.json') || [];
    const resource = resources.find(r => r.id == req.params.resourceId);
    if (resource && resource.fileUrl) {
        const filePath = path.join(__dirname, resource.fileUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const filtered = resources.filter(r => r.id != req.params.resourceId);
    writeData('video-resources.json', filtered);
    res.json({ success: true });
});

// --- Quiz ---
app.get('/api/videos/:id/quiz', (req, res) => {
    const quizzes = readData('video-quizzes.json') || [];
    const quiz = quizzes.find(q => q.videoId == req.params.id);
    res.json({ success: true, quiz: quiz || null });
});

app.post('/api/videos/:id/quiz', (req, res) => {
    const quizzes = readData('video-quizzes.json') || [];
    const { questions, passingScore } = req.body;
    const idx = quizzes.findIndex(q => q.videoId == req.params.id);
    const quiz = {
        id: idx !== -1 ? quizzes[idx].id : Date.now(),
        videoId: parseInt(req.params.id),
        questions: questions || [],
        passingScore: passingScore || 60,
        updatedAt: new Date().toISOString()
    };
    if (idx !== -1) quizzes[idx] = quiz;
    else quizzes.push(quiz);
    writeData('video-quizzes.json', quizzes);
    res.json({ success: true, quiz });
});

app.delete('/api/videos/:id/quiz', (req, res) => {
    const quizzes = readData('video-quizzes.json') || [];
    const filtered = quizzes.filter(q => q.videoId != req.params.id);
    writeData('video-quizzes.json', filtered);
    res.json({ success: true });
});

app.post('/api/videos/:id/quiz/submit', (req, res) => {
    const quizzes = readData('video-quizzes.json') || [];
    const quiz = quizzes.find(q => q.videoId == req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    
    const { studentId, answers } = req.body;
    let correctCount = 0;
    const results = quiz.questions.map((q, i) => {
        const isCorrect = answers[i] === q.correctAnswer;
        if (isCorrect) correctCount++;
        return { questionIndex: i, selected: answers[i], correct: q.correctAnswer, isCorrect };
    });
    
    const scorePct = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = scorePct >= quiz.passingScore;
    
    // Save attempt
    const attempts = readData('video-quiz-attempts.json') || [];
    attempts.push({
        id: Date.now(),
        videoId: parseInt(req.params.id),
        studentId,
        score: scorePct,
        passed,
        totalQuestions: quiz.questions.length,
        correctCount,
        attemptedAt: new Date().toISOString()
    });
    writeData('video-quiz-attempts.json', attempts);
    
    res.json({ success: true, score: scorePct, passed, correctCount, totalQuestions: quiz.questions.length, results });
});

app.get('/api/videos/:id/quiz/attempts/:studentId', (req, res) => {
    const attempts = readData('video-quiz-attempts.json') || [];
    const list = attempts.filter(a => a.videoId == req.params.id && a.studentId == req.params.studentId);
    res.json({ success: true, attempts: list });
});

// --- Video Hotspots (timestamp interactions) ---
app.get('/api/videos/:id/hotspots', (req, res) => {
    const hotspots = readData('video-hotspots.json') || [];
    const list = hotspots
        .filter(h => h.videoId == req.params.id)
        .sort((a, b) => (a.timeSeconds || 0) - (b.timeSeconds || 0));
    res.json({ success: true, hotspots: list });
});

app.post('/api/videos/:id/hotspots', (req, res) => {
    const hotspots = readData('video-hotspots.json') || [];
    const { hotspots: inputList } = req.body;
    if (!Array.isArray(inputList)) return res.status(400).json({ success: false, message: 'Invalid hotspots data' });

    const cleaned = inputList
        .filter(h => h && h.text)
        .map(h => ({
            id: h.id || Date.now() + Math.random(),
            videoId: parseInt(req.params.id),
            timeSeconds: Math.max(0, parseFloat(h.timeSeconds) || 0),
            text: String(h.text || '').trim(),
            linkUrl: String(h.linkUrl || '').trim(),
            updatedAt: new Date().toISOString()
        }));

    const filtered = hotspots.filter(h => h.videoId != req.params.id);
    writeData('video-hotspots.json', [...filtered, ...cleaned]);
    res.json({ success: true, hotspots: cleaned });
});

app.delete('/api/videos/:id/hotspots/:hotspotId', (req, res) => {
    const hotspots = readData('video-hotspots.json') || [];
    const filtered = hotspots.filter(h => !(h.videoId == req.params.id && h.id == req.params.hotspotId));
    writeData('video-hotspots.json', filtered);
    res.json({ success: true });
});

// --- Video Course Certificate ---
app.get('/api/students/:studentId/video-certificate/:courseId', (req, res) => {
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.studentId);
    if (!student) return res.status(404).send('Student not found');
    
    const courses = readData('courses.json') || [];
    const course = courses.find(c => c.id == req.params.courseId);
    if (!course) return res.status(404).send('Course not found');
    
    const videos = readData('videos.json') || [];
    const courseVideos = videos.filter(v => v.courseId == req.params.courseId);
    
    // Check all videos completed
    const allCompleted = courseVideos.length > 0 && courseVideos.every(v => 
        v.progress && v.progress[req.params.studentId] && v.progress[req.params.studentId].completed
    );
    
    if (!allCompleted) return res.status(400).send('Complete all videos first to get certificate');
    
    const settings = readData('settings.json') || {};
    const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const html = `<!DOCTYPE html>
<html><head><title>Certificate - ${student.name}</title>
<style>
body { margin:0; padding:40px; font-family: 'Georgia', serif; background: #f3f4f6; }
.cert { max-width: 900px; margin: auto; background: #fff; padding: 60px 80px; border: 15px solid #1e40af; position: relative; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
.cert::before { content:''; position: absolute; top: 10px; left: 10px; right: 10px; bottom: 10px; border: 3px solid #f59e0b; pointer-events: none; }
h1 { text-align: center; color: #1e40af; font-size: 48px; margin: 20px 0; letter-spacing: 3px; }
.subtitle { text-align: center; color: #64748b; font-size: 18px; margin-bottom: 30px; }
.name { text-align: center; color: #dc2626; font-size: 36px; font-weight: bold; margin: 30px 0; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; }
.content { text-align: center; font-size: 16px; line-height: 1.8; color: #374151; }
.course { font-size: 24px; color: #059669; font-weight: bold; margin: 20px 0; }
.footer { display: flex; justify-content: space-between; margin-top: 60px; }
.sig { text-align: center; }
.sig-line { border-top: 2px solid #1e293b; width: 200px; margin: 40px auto 5px; }
.logo { text-align: center; margin-bottom: 20px; }
.logo i { font-size: 60px; color: #1e40af; }
.cert-id { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 30px; }
@media print { body { background: #fff; padding: 0; } .no-print { display: none; } }
</style></head>
<body>
<div class="cert">
  <div class="logo"><i class="fas fa-graduation-cap">🎓</i></div>
  <h1>CERTIFICATE</h1>
  <div class="subtitle">OF COURSE COMPLETION</div>
  <div class="content">This is to certify that</div>
  <div class="name">${student.name}</div>
  <div class="content">
    has successfully completed the online video course
    <div class="course">${course.name}</div>
    at <strong>${settings.name || 'Genius Computer Education'}</strong><br>
    on <strong>${date}</strong>
  </div>
  <div class="footer">
    <div class="sig">
      <div class="sig-line"></div>
      <div>Director</div>
    </div>
    <div class="sig">
      <div class="sig-line"></div>
      <div>Date: ${date}</div>
    </div>
  </div>
  <div class="cert-id">Certificate ID: VID-${req.params.courseId}-${req.params.studentId}-${Date.now()}</div>
</div>
<div class="no-print" style="text-align:center;margin-top:20px;">
  <button onclick="window.print()" style="padding:12px 30px;background:#1e40af;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:16px;">Print Certificate</button>
</div>
</body></html>`;
    res.send(html);
});

// =========================================
// End of Batch 1 APIs
// =========================================

// =========================================
// BATCH 2 APIs: Comments, Ratings, Watch Later, Leaderboard
// =========================================

// --- Comments/Q&A ---
app.get('/api/videos/:id/comments', (req, res) => {
    const comments = readData('video-comments.json') || [];
    const list = comments.filter(c => c.videoId == req.params.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, comments: list });
});

app.post('/api/videos/:id/comments', (req, res) => {
    const comments = readData('video-comments.json') || [];
    const { studentId, studentName, text } = req.body;
    if (!text || !studentId) return res.status(400).json({ success: false, message: 'Missing data' });
    const comment = {
        id: Date.now(),
        videoId: parseInt(req.params.id),
        studentId,
        studentName: studentName || 'Student',
        text,
        replies: [],
        createdAt: new Date().toISOString()
    };
    comments.push(comment);
    writeData('video-comments.json', comments);
    res.json({ success: true, comment });
});

app.post('/api/videos/comments/:commentId/reply', (req, res) => {
    const comments = readData('video-comments.json') || [];
    const comment = comments.find(c => c.id == req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
    const { authorName, authorType, text } = req.body;
    const reply = {
        id: Date.now(),
        authorName: authorName || 'Teacher',
        authorType: authorType || 'teacher',
        text,
        createdAt: new Date().toISOString()
    };
    if (!comment.replies) comment.replies = [];
    comment.replies.push(reply);
    writeData('video-comments.json', comments);
    res.json({ success: true, reply });
});

app.delete('/api/videos/comments/:commentId', (req, res) => {
    const comments = readData('video-comments.json') || [];
    const filtered = comments.filter(c => c.id != req.params.commentId);
    writeData('video-comments.json', filtered);
    res.json({ success: true });
});

app.get('/api/admin/video-comments', (req, res) => {
    const comments = readData('video-comments.json') || [];
    const videos = readData('videos.json') || [];
    const videoMap = {};
    videos.forEach(v => videoMap[v.id] = v.title);
    const enriched = comments.map(c => ({ ...c, videoTitle: videoMap[c.videoId] || 'Unknown' }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, comments: enriched });
});

// --- Ratings ---
app.get('/api/videos/:id/rating', (req, res) => {
    const ratings = readData('video-ratings.json') || [];
    const videoRatings = ratings.filter(r => r.videoId == req.params.id);
    const avg = videoRatings.length > 0 ? videoRatings.reduce((s, r) => s + r.rating, 0) / videoRatings.length : 0;
    res.json({ success: true, average: Math.round(avg * 10) / 10, count: videoRatings.length });
});

app.get('/api/videos/:id/rating/:studentId', (req, res) => {
    const ratings = readData('video-ratings.json') || [];
    const userRating = ratings.find(r => r.videoId == req.params.id && r.studentId == req.params.studentId);
    res.json({ success: true, rating: userRating ? userRating.rating : 0 });
});

app.post('/api/videos/:id/rating', (req, res) => {
    const ratings = readData('video-ratings.json') || [];
    const { studentId, rating } = req.body;
    if (!studentId || !rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Invalid data' });
    const existing = ratings.findIndex(r => r.videoId == req.params.id && r.studentId == studentId);
    const entry = {
        id: existing !== -1 ? ratings[existing].id : Date.now(),
        videoId: parseInt(req.params.id),
        studentId,
        rating: parseInt(rating),
        ratedAt: new Date().toISOString()
    };
    if (existing !== -1) ratings[existing] = entry;
    else ratings.push(entry);
    writeData('video-ratings.json', ratings);
    res.json({ success: true });
});

// --- Watch Later / Playlist ---
app.get('/api/students/:studentId/watch-later', (req, res) => {
    const list = readData('video-watch-later.json') || [];
    const entries = list.filter(w => w.studentId == req.params.studentId);
    const videos = readData('videos.json') || [];
    const enriched = entries.map(w => {
        const v = videos.find(vv => vv.id == w.videoId);
        return v ? { ...w, video: v } : null;
    }).filter(Boolean);
    res.json({ success: true, items: enriched });
});

app.post('/api/students/:studentId/watch-later/:videoId', (req, res) => {
    const list = readData('video-watch-later.json') || [];
    const existing = list.find(w => w.studentId == req.params.studentId && w.videoId == req.params.videoId);
    if (existing) return res.json({ success: true, alreadyAdded: true });
    list.push({
        id: Date.now(),
        studentId: req.params.studentId,
        videoId: parseInt(req.params.videoId),
        addedAt: new Date().toISOString()
    });
    writeData('video-watch-later.json', list);
    res.json({ success: true });
});

app.delete('/api/students/:studentId/watch-later/:videoId', (req, res) => {
    const list = readData('video-watch-later.json') || [];
    const filtered = list.filter(w => !(w.studentId == req.params.studentId && w.videoId == req.params.videoId));
    writeData('video-watch-later.json', filtered);
    res.json({ success: true });
});

// --- Leaderboard ---
app.get('/api/videos/leaderboard/:courseId?', (req, res) => {
    const videos = readData('videos.json') || [];
    const students = readData('students.json') || [];
    const courses = readData('courses.json') || [];
    
    let targetVideos = videos;
    if (req.params.courseId) {
        targetVideos = videos.filter(v => v.courseId == req.params.courseId);
    }
    
    // Calculate each student's stats
    const stats = {};
    targetVideos.forEach(v => {
        if (!v.progress) return;
        Object.keys(v.progress).forEach(sid => {
            if (!stats[sid]) stats[sid] = { studentId: sid, videosCompleted: 0, totalWatchTime: 0, videosStarted: 0 };
            const p = v.progress[sid];
            stats[sid].totalWatchTime += p.currentTime || 0;
            if (p.completed) stats[sid].videosCompleted++;
            if ((p.currentTime || 0) > 0) stats[sid].videosStarted++;
        });
    });
    
    // Add student info
    const leaderboard = Object.values(stats).map(s => {
        const student = students.find(st => st.id == s.studentId);
        const course = student ? courses.find(c => c.name == student.course) : null;
        return {
            ...s,
            name: student ? student.name : 'Unknown',
            course: student ? student.course : '',
            photo: student ? (student.photo || '') : '',
            totalWatchMinutes: Math.floor(s.totalWatchTime / 60)
        };
    }).filter(s => s.videosStarted > 0)
      .sort((a, b) => b.videosCompleted - a.videosCompleted || b.totalWatchTime - a.totalWatchTime)
      .slice(0, 20);
    
    res.json({ success: true, leaderboard });
});

// =========================================
// BATCH 3 APIs: Analytics, Scheduling/Expiry, Concurrent Session
// =========================================

app.get('/api/admin/video-analytics', (req, res) => {
    const videos = readData('videos.json') || [];
    const comments = readData('video-comments.json') || [];

    const analytics = videos.map(v => {
        const progressEntries = Object.values(v.progress || {});
        const uniqueViewers = progressEntries.filter(p => (p.currentTime || 0) > 0 || p.completed).length;
        const completedCount = progressEntries.filter(p => p.completed).length;
        const totalWatchSeconds = progressEntries.reduce((sum, p) => sum + (p.currentTime || 0), 0);
        const avgWatchMinutes = uniqueViewers ? Math.round((totalWatchSeconds / uniqueViewers) / 60) : 0;
        const videoComments = comments.filter(c => c.videoId == v.id);

        return {
            id: v.id,
            title: v.title,
            courseId: v.courseId,
            views: v.views || 0,
            uniqueViewers,
            completedCount,
            completionRate: uniqueViewers ? Math.round((completedCount / uniqueViewers) * 100) : 0,
            avgWatchMinutes,
            commentsCount: videoComments.length,
            availabilityStart: v.availabilityStart || '',
            availabilityEnd: v.availabilityEnd || '',
            expiryDays: v.expiryDays || 0,
            enforceSingleSession: !!v.enforceSingleSession
        };
    });

    res.json({ success: true, analytics });
});

app.post('/api/admin/videos/:id/notify-availability', async (req, res) => {
    const videos = readData('videos.json') || [];
    const video = videos.find(v => v.id == req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });

    const settings = readData('settings.json') || {};
    const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
    if (!smtpUser || !smtpPass) {
        return res.status(400).json({ success: false, message: 'SMTP settings are not configured.' });
    }

    const students = readData('students.json') || [];
    const courses = readData('courses.json') || [];
    const course = courses.find(c => c.id == video.courseId);
    const targetStudents = students.filter(s => s.email && (!course || s.course == course.name));
    if (targetStudents.length === 0) {
        return res.json({ success: true, sent: 0, message: 'No students with valid email found for this course.' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: smtpPass }
        });
        const fromName = settings.name || 'Genius Computer Education';
        const startText = video.availabilityStart ? formatDate(video.availabilityStart) : 'Now';
        const endText = video.availabilityEnd ? formatDate(video.availabilityEnd) : 'No end date';
        let sent = 0;
        let failed = 0;
        const failedEmails = [];

        for (const st of targetStudents) {
            try {
                await transporter.sendMail({
                    from: `"${fromName}" <${settings.smtpUser}>`,
                    to: st.email,
                    subject: `New Video Available: ${video.title}`,
                    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
<div style="background:#1e40af;color:#fff;padding:20px;"><h2 style="margin:0;">${fromName}</h2><p style="margin:6px 0 0;opacity:.9;">Video Learning Update</p></div>
<div style="padding:20px;">
<p>Hi ${st.name || 'Student'},</p>
<p>A new video is available for your course:</p>
<h3 style="margin:8px 0;color:#0f172a;">${video.title}</h3>
<p style="color:#475569;">${video.description || 'Please login to your student portal and start learning.'}</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:14px 0;">
<div><strong>Available from:</strong> ${startText}</div>
<div><strong>Available till:</strong> ${endText}</div>
</div>
<a href="http://localhost:3000/student-portal.html" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open Student Portal</a>
</div></div>`
                });
                sent++;
            } catch (mailError) {
                failed++;
                failedEmails.push(st.email);
                console.error('Failed to send video notification to', st.email, mailError.message);
            }
        }

        video.lastNotifiedAt = new Date().toISOString();
        video.lastNotificationSent = sent;
        writeData('videos.json', videos);

        res.json({
            success: true,
            sent,
            failed,
            total: targetStudents.length,
            failedEmails
        });
    } catch (error) {
        console.error('Video notification error:', error);
        res.status(500).json({ success: false, message: 'Failed to send notifications', error: error.message });
    }
});

app.get('/api/students/:studentId/video-study-schedule', (req, res) => {
    // Read-only derived view; no hard session gate to avoid blocking on stale tokens.
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const courses = readData('courses.json') || [];
    const videos = readData('videos.json') || [];
    const chapters = readData('chapters.json') || [];

    const course = courses.find(c => c.name == student.course);
    if (!course) return res.json({ success: true, schedule: [], summary: { totalPending: 0, dailyTarget: 0 } });

    const chapterMap = {};
    chapters.forEach(ch => { chapterMap[ch.id] = ch.name; });

    const pending = videos
        .filter(v => v.courseId == course.id)
        .filter(v => !(v.progress && v.progress[req.params.studentId] && v.progress[req.params.studentId].completed))
        .sort((a, b) => {
            if ((a.chapterId || '') !== (b.chapterId || '')) return String(a.chapterId || '').localeCompare(String(b.chapterId || ''));
            return String(a.title || '').localeCompare(String(b.title || ''));
        });

    const desiredDays = 7;
    const dailyTarget = pending.length > 0 ? Math.max(1, Math.ceil(pending.length / desiredDays)) : 0;
    const plan = [];
    for (let d = 0; d < desiredDays && pending.length > 0; d++) {
        const date = new Date();
        date.setDate(date.getDate() + d);
        const items = pending.splice(0, dailyTarget).map(v => ({
            id: v.id,
            title: v.title,
            duration: v.duration || 0,
            chapter: chapterMap[v.chapterId] || 'General'
        }));
        if (items.length > 0) {
            plan.push({
                dayOffset: d,
                date: date.toISOString(),
                totalMinutes: items.reduce((sum, i) => sum + (parseInt(i.duration) || 0), 0),
                videos: items
            });
        }
    }

    res.json({
        success: true,
        schedule: plan,
        summary: {
            totalPending: plan.reduce((sum, d) => sum + d.videos.length, 0),
            dailyTarget
        }
    });
});

// =========================================
// End of Batch 2 APIs
// =========================================

// Student video endpoint with chapter grouping (read-only; no hard session gate
// so stale tokens don't block the catalog view — progress/write endpoints remain guarded)
app.get('/api/videos/student/:studentId', (req, res) => {
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const videos = readData('videos.json') || [];
    const chapters = readData('chapters.json') || [];
    const courses = readData('courses.json') || [];
    
    // Find course by name to get ID for matching
    const studentCourse = courses.find(c => c.name == student.course);
    const studentCourseId = studentCourse ? studentCourse.id : null;
    
    const isVideoAvailableForStudent = (video, studentId) => {
        const now = Date.now();

        if (video.availabilityStart) {
            const startAt = new Date(video.availabilityStart).getTime();
            if (!Number.isNaN(startAt) && now < startAt) return false;
        }

        if (video.availabilityEnd) {
            const endAt = new Date(video.availabilityEnd).getTime();
            if (!Number.isNaN(endAt) && now > endAt) return false;
        }

        const expiryDays = parseInt(video.expiryDays) || 0;
        if (expiryDays > 0) {
            const p = video.progress && video.progress[studentId] ? video.progress[studentId] : null;
            if (p && p.firstWatchedAt) {
                const expiresAt = new Date(p.firstWatchedAt).getTime() + (expiryDays * 24 * 60 * 60 * 1000);
                if (!Number.isNaN(expiresAt) && now > expiresAt) return false;
            }
        }

        return true;
    };

    // Filter videos by courseId (use ID match) + scheduling/expiry conditions
    const courseVideos = studentCourseId
        ? videos.filter(v => v.courseId == studentCourseId && isVideoAvailableForStudent(v, req.params.studentId))
        : [];
    const courseChapters = studentCourseId ? chapters.filter(c => c.courseId == studentCourseId).sort((a, b) => a.order - b.order) : [];

    // Group videos by chapter
    const grouped = courseChapters.map(ch => ({
        id: ch.id,
        name: ch.name,
        order: ch.order,
        videos: courseVideos.filter(v => v.chapterId == ch.id).map(v => ({
            ...v,
            progress: v.progress && v.progress[req.params.studentId] ? v.progress[req.params.studentId] : { currentTime: 0, completed: false }
        }))
    })).filter(ch => ch.videos.length > 0);

    // Ungrouped videos
    const ungrouped = courseVideos.filter(v => !v.chapterId).map(v => ({
        ...v,
        progress: v.progress && v.progress[req.params.studentId] ? v.progress[req.params.studentId] : { currentTime: 0, completed: false }
    }));

    res.json({ success: true, chapters: grouped, ungrouped });
});

// --- Assignments (Assignment Management) ---
app.get('/api/assignments', (req, res) => {
    const assignments = readData('assignments.json') || [];
    res.json(assignments);
});

app.get('/api/assignments/:id', (req, res) => {
    const assignments = readData('assignments.json') || [];
    const assignment = assignments.find(a => a.id == req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json(assignment);
});

app.get('/api/assignments/course/:courseId', (req, res) => {
    const assignments = readData('assignments.json') || [];
    const courseAssignments = assignments.filter(a => a.courseId == req.params.courseId);
    res.json(courseAssignments);
});

app.get('/api/assignments/student/:studentId', (req, res) => {
    const assignments = readData('assignments.json') || [];
    const studentAssignments = assignments.filter(a => a.studentId == req.params.studentId || a.target === 'all');
    res.json(studentAssignments);
});

app.post('/api/assignments', uploadAssignment.single('file'), (req, res) => {
    const assignments = readData('assignments.json') || [];
    const assignment = {
        id: Date.now(),
        title: req.body.title,
        description: req.body.description,
        courseId: req.body.courseId,
        batchId: req.body.batchId,
        target: req.body.target || 'all', // all, course, batch, student
        studentId: req.body.studentId,
        fileUrl: req.file ? '/uploads/assignments/' + req.file.filename : req.body.fileUrl,
        dueDate: req.body.dueDate,
        maxMarks: req.body.maxMarks,
        createdAt: new Date().toISOString(),
        submissions: [] // Track student submissions
    };
    assignments.push(assignment);
    writeData('assignments.json', assignments);
    res.json({ success: true, assignment });
});

app.put('/api/assignments/:id', uploadAssignment.single('file'), (req, res) => {
    const assignments = readData('assignments.json') || [];
    const idx = assignments.findIndex(a => a.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Assignment not found' });
    
    assignments[idx] = {
        ...assignments[idx],
        title: req.body.title || assignments[idx].title,
        description: req.body.description || assignments[idx].description,
        courseId: req.body.courseId || assignments[idx].courseId,
        batchId: req.body.batchId || assignments[idx].batchId,
        target: req.body.target || assignments[idx].target,
        studentId: req.body.studentId || assignments[idx].studentId,
        fileUrl: req.file ? '/uploads/assignments/' + req.file.filename : assignments[idx].fileUrl,
        dueDate: req.body.dueDate || assignments[idx].dueDate,
        maxMarks: req.body.maxMarks || assignments[idx].maxMarks
    };
    writeData('assignments.json', assignments);
    res.json({ success: true, assignment: assignments[idx] });
});

app.delete('/api/assignments/:id', (req, res) => {
    const assignments = readData('assignments.json') || [];
    const idx = assignments.findIndex(a => a.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Assignment not found' });
    
    assignments.splice(idx, 1);
    writeData('assignments.json', assignments);
    res.json({ success: true });
});

app.post('/api/assignments/:id/submit', uploadAssignment.single('file'), (req, res) => {
    const assignments = readData('assignments.json') || [];
    const assignment = assignments.find(a => a.id == req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    
    const submission = {
        studentId: req.body.studentId,
        fileUrl: req.file ? '/uploads/assignments/' + req.file.filename : req.body.fileUrl,
        submittedAt: new Date().toISOString(),
        marks: null,
        feedback: '',
        status: 'submitted'
    };
    
    if (!assignment.submissions) assignment.submissions = [];
    assignment.submissions.push(submission);
    
    writeData('assignments.json', assignments);
    res.json({ success: true, submission });
});

app.put('/api/assignments/:id/grade/:submissionId', (req, res) => {
    const assignments = readData('assignments.json') || [];
    const assignment = assignments.find(a => a.id == req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    
    const submission = assignment.submissions.find(s => s.studentId == req.params.submissionId);
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
    
    submission.marks = req.body.marks;
    submission.feedback = req.body.feedback;
    submission.status = 'graded';
    submission.gradedAt = new Date().toISOString();
    
    writeData('assignments.json', assignments);
    res.json({ success: true, submission });
});

app.get('/api/assignments/:id/submissions', (req, res) => {
    const assignments = readData('assignments.json') || [];
    const assignment = assignments.find(a => a.id == req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    
    res.json({ success: true, submissions: assignment.submissions || [] });
});

// --- Alumni (Alumni Network) ---
app.get('/api/alumni', (req, res) => {
    const alumni = readData('alumni.json') || [];
    res.json(alumni);
});

app.get('/api/alumni/:id', (req, res) => {
    const alumni = readData('alumni.json') || [];
    const alumnus = alumni.find(a => a.id == req.params.id);
    if (!alumnus) return res.status(404).json({ error: 'Alumnus not found' });
    res.json(alumnus);
});

app.post('/api/alumni', uploadAlumni.single('photo'), (req, res) => {
    const alumni = readData('alumni.json') || [];
    const alumnus = {
        id: Date.now(),
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        course: req.body.course,
        batch: req.body.batch,
        graduationYear: req.body.graduationYear,
        currentCompany: req.body.currentCompany,
        designation: req.body.designation,
        location: req.body.location,
        linkedin: req.body.linkedin,
        photo: req.file ? '/uploads/alumni/' + req.file.filename : req.body.photo,
        bio: req.body.bio,
        achievements: req.body.achievements ? req.body.achievements.split(',').map(a => a.trim()) : [],
        isVerified: false,
        registeredAt: new Date().toISOString()
    };
    alumni.push(alumnus);
    writeData('alumni.json', alumni);
    res.json({ success: true, alumnus });
});

app.put('/api/alumni/:id', uploadAlumni.single('photo'), (req, res) => {
    const alumni = readData('alumni.json') || [];
    const idx = alumni.findIndex(a => a.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Alumnus not found' });
    
    alumni[idx] = {
        ...alumni[idx],
        name: req.body.name || alumni[idx].name,
        email: req.body.email || alumni[idx].email,
        phone: req.body.phone || alumni[idx].phone,
        course: req.body.course || alumni[idx].course,
        batch: req.body.batch || alumni[idx].batch,
        graduationYear: req.body.graduationYear || alumni[idx].graduationYear,
        currentCompany: req.body.currentCompany || alumni[idx].currentCompany,
        designation: req.body.designation || alumni[idx].designation,
        location: req.body.location || alumni[idx].location,
        linkedin: req.body.linkedin || alumni[idx].linkedin,
        photo: req.file ? '/uploads/alumni/' + req.file.filename : alumni[idx].photo,
        bio: req.body.bio || alumni[idx].bio,
        achievements: req.body.achievements ? req.body.achievements.split(',').map(a => a.trim()) : alumni[idx].achievements
    };
    writeData('alumni.json', alumni);
    res.json({ success: true, alumnus: alumni[idx] });
});

app.delete('/api/alumni/:id', (req, res) => {
    const alumni = readData('alumni.json') || [];
    const idx = alumni.findIndex(a => a.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Alumnus not found' });
    
    alumni.splice(idx, 1);
    writeData('alumni.json', alumni);
    res.json({ success: true });
});

app.put('/api/alumni/:id/verify', (req, res) => {
    const alumni = readData('alumni.json') || [];
    const alumnus = alumni.find(a => a.id == req.params.id);
    if (!alumnus) return res.status(404).json({ success: false, message: 'Alumnus not found' });
    
    alumnus.isVerified = req.body.isVerified;
    writeData('alumni.json', alumni);
    res.json({ success: true, alumnus });
});

app.post('/api/alumni/:id/job-posting', (req, res) => {
    const alumni = readData('alumni.json') || [];
    const alumnus = alumni.find(a => a.id == req.params.id);
    if (!alumnus) return res.status(404).json({ success: false, message: 'Alumnus not found' });
    
    const jobPosting = {
        id: Date.now(),
        title: req.body.title,
        company: req.body.company,
        location: req.body.location,
        description: req.body.description,
        requirements: req.body.requirements,
        salary: req.body.salary,
        postedBy: alumnus.id,
        postedAt: new Date().toISOString(),
        isActive: true
    };
    
    if (!alumnus.jobPostings) alumnus.jobPostings = [];
    alumnus.jobPostings.push(jobPosting);
    
    writeData('alumni.json', alumni);
    res.json({ success: true, jobPosting });
});

// --- Helpdesk/Support System ---
app.get('/api/tickets', (req, res) => {
    const tickets = readData('tickets.json') || [];
    res.json(tickets);
});

app.get('/api/tickets/:id', (req, res) => {
    const tickets = readData('tickets.json') || [];
    const ticket = tickets.find(t => t.id == req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
});

app.get('/api/tickets/student/:studentId', (req, res) => {
    const tickets = readData('tickets.json') || [];
    const studentTickets = tickets.filter(t => t.studentId == req.params.studentId);
    res.json(studentTickets);
});

app.post('/api/tickets', (req, res) => {
    const tickets = readData('tickets.json') || [];
    const ticket = {
        id: Date.now(),
        subject: req.body.subject,
        description: req.body.description,
        category: req.body.category || 'General',
        priority: req.body.priority || 'Medium', // Low, Medium, High, Urgent
        status: 'Open', // Open, In Progress, Resolved, Closed
        studentId: req.body.studentId,
        studentName: req.body.studentName,
        studentEmail: req.body.studentEmail,
        attachments: req.body.attachments || [],
        assignedTo: req.body.assignedTo || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        responses: []
    };
    tickets.push(ticket);
    writeData('tickets.json', tickets);
    res.json({ success: true, ticket });
});

app.put('/api/tickets/:id', (req, res) => {
    const tickets = readData('tickets.json') || [];
    const idx = tickets.findIndex(t => t.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Ticket not found' });
    
    tickets[idx] = {
        ...tickets[idx],
        subject: req.body.subject || tickets[idx].subject,
        description: req.body.description || tickets[idx].description,
        category: req.body.category || tickets[idx].category,
        priority: req.body.priority || tickets[idx].priority,
        status: req.body.status || tickets[idx].status,
        assignedTo: req.body.assignedTo || tickets[idx].assignedTo,
        updatedAt: new Date().toISOString()
    };
    writeData('tickets.json', tickets);
    res.json({ success: true, ticket: tickets[idx] });
});

app.delete('/api/tickets/:id', (req, res) => {
    const tickets = readData('tickets.json') || [];
    const idx = tickets.findIndex(t => t.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Ticket not found' });
    
    tickets.splice(idx, 1);
    writeData('tickets.json', tickets);
    res.json({ success: true });
});

app.post('/api/tickets/:id/response', (req, res) => {
    const tickets = readData('tickets.json') || [];
    const ticket = tickets.find(t => t.id == req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    
    const response = {
        id: Date.now(),
        message: req.body.message,
        sender: req.body.sender, // student or admin
        senderName: req.body.senderName,
        createdAt: new Date().toISOString()
    };
    
    if (!ticket.responses) ticket.responses = [];
    ticket.responses.push(response);
    ticket.updatedAt = new Date().toISOString();
    
    writeData('tickets.json', tickets);
    res.json({ success: true, response });
});

app.get('/api/tickets/:id/responses', (req, res) => {
    const tickets = readData('tickets.json') || [];
    const ticket = tickets.find(t => t.id == req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    
    res.json({ success: true, responses: ticket.responses || [] });
});

// --- Backup & Recovery ---
app.get('/api/backup/create', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const archiver = require('archiver');
        
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupFileName = `backup_${Date.now()}.zip`;
        const backupPath = path.join(backupDir, backupFileName);
        
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', () => {
            res.json({ success: true, message: 'Backup created successfully', filename: backupFileName });
        });
        
        archive.on('error', (err) => {
            console.error('Backup error:', err);
            res.status(500).json({ success: false, message: 'Backup failed' });
        });
        
        archive.pipe(output);
        
        // Backup data files
        const dataFiles = ['students.json', 'courses.json', 'faculty.json', 'batches.json', 'enquiries.json', 'notices.json', 'announcements.json', 'tests.json', 'gallery.json', 'holidays.json', 'blogs.json', 'notifications.json', 'study-materials.json', 'exam-results.json', 'certificates.json', 'questions.json', 'exam-schedules.json', 'exam-registrations.json', 'online-exams.json', 'videos.json', 'assignments.json', 'alumni.json', 'tickets.json', 'carousel.json', 'settings.json'];
        
        dataFiles.forEach(file => {
            const filePath = path.join(__dirname, 'data', file);
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: file });
            }
        });
        
        // Backup uploads folder
        const uploadsPath = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsPath)) {
            archive.directory(uploadsPath, 'uploads');
        }
        
        await archive.finalize();
    } catch (e) {
        console.error('Backup error:', e);
        res.status(500).json({ success: false, message: 'Backup failed: ' + e.message });
    }
});

app.get('/api/backup/list', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const backupDir = path.join(__dirname, 'backups');
        
        if (!fs.existsSync(backupDir)) {
            return res.json({ success: true, backups: [] });
        }
        
        const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.zip'));
        const backups = files.map(file => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            return {
                filename: file,
                size: stats.size,
                created: stats.birthtime,
                sizeFormatted: formatFileSize(stats.size)
            };
        }).sort((a, b) => b.created - a.created);
        
        res.json({ success: true, backups });
    } catch (e) {
        console.error('List backups error:', e);
        res.status(500).json({ success: false, message: 'Failed to list backups' });
    }
});

app.delete('/api/backup/:filename', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const backupDir = path.join(__dirname, 'backups');
        const backupPath = path.join(backupDir, req.params.filename);
        
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ success: false, message: 'Backup not found' });
        }
        
        fs.unlinkSync(backupPath);
        res.json({ success: true, message: 'Backup deleted successfully' });
    } catch (e) {
        console.error('Delete backup error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete backup' });
    }
});

app.post('/api/backup/restore/:filename', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const unzipper = require('unzipper');
        
        const backupDir = path.join(__dirname, 'backups');
        const backupPath = path.join(backupDir, req.params.filename);
        
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ success: false, message: 'Backup not found' });
        }
        
        // Extract backup
        await fs.createReadStream(backupPath)
            .pipe(unzipper.Extract({ path: __dirname }))
            .promise();
        
        res.json({ success: true, message: 'Backup restored successfully' });
    } catch (e) {
        console.error('Restore error:', e);
        res.status(500).json({ success: false, message: 'Restore failed: ' + e.message });
    }
});

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// --- Role-based Access Control (RBAC) ---
app.get('/api/roles', (req, res) => {
    const roles = readData('roles.json') || [
        { id: 1, name: 'Super Admin', permissions: ['all'], description: 'Full access to all features' },
        { id: 2, name: 'Admin', permissions: ['students', 'courses', 'faculty', 'batches', 'enquiries', 'notices', 'announcements', 'tests', 'gallery', 'blogs', 'videos', 'assignments', 'exam-results'], description: 'Access to all academic features' },
        { id: 3, name: 'Faculty', permissions: ['students', 'courses', 'attendance', 'study-materials', 'videos', 'assignments', 'exam-results'], description: 'Access to teaching-related features' },
        { id: 4, name: 'Staff', permissions: ['enquiries', 'notices', 'attendance', 'fees'], description: 'Access to administrative features' }
    ];
    res.json(roles);
});

app.get('/api/roles/:id', (req, res) => {
    const roles = readData('roles.json') || [
        { id: 1, name: 'Super Admin', permissions: ['all'], description: 'Full access to all features' },
        { id: 2, name: 'Admin', permissions: ['students', 'courses', 'faculty', 'batches', 'enquiries', 'notices', 'announcements', 'tests', 'gallery', 'blogs', 'videos', 'assignments', 'exam-results'], description: 'Access to all academic features' },
        { id: 3, name: 'Faculty', permissions: ['students', 'courses', 'attendance', 'study-materials', 'videos', 'assignments', 'exam-results'], description: 'Access to teaching-related features' },
        { id: 4, name: 'Staff', permissions: ['enquiries', 'notices', 'attendance', 'fees'], description: 'Access to administrative features' }
    ];
    const role = roles.find(r => r.id == req.params.id);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json(role);
});

app.post('/api/roles', (req, res) => {
    const roles = readData('roles.json') || [
        { id: 1, name: 'Super Admin', permissions: ['all'], description: 'Full access to all features' },
        { id: 2, name: 'Admin', permissions: ['students', 'courses', 'faculty', 'batches', 'enquiries', 'notices', 'announcements', 'tests', 'gallery', 'blogs', 'videos', 'assignments', 'exam-results'], description: 'Access to all academic features' },
        { id: 3, name: 'Faculty', permissions: ['students', 'courses', 'attendance', 'study-materials', 'videos', 'assignments', 'exam-results'], description: 'Access to teaching-related features' },
        { id: 4, name: 'Staff', permissions: ['enquiries', 'notices', 'attendance', 'fees'], description: 'Access to administrative features' }
    ];
    const role = {
        id: Date.now(),
        name: req.body.name,
        permissions: req.body.permissions || [],
        description: req.body.description
    };
    roles.push(role);
    writeData('roles.json', roles);
    res.json({ success: true, role });
});

app.put('/api/roles/:id', (req, res) => {
    const roles = readData('roles.json') || [
        { id: 1, name: 'Super Admin', permissions: ['all'], description: 'Full access to all features' },
        { id: 2, name: 'Admin', permissions: ['students', 'courses', 'faculty', 'batches', 'enquiries', 'notices', 'announcements', 'tests', 'gallery', 'blogs', 'videos', 'assignments', 'exam-results'], description: 'Access to all academic features' },
        { id: 3, name: 'Faculty', permissions: ['students', 'courses', 'attendance', 'study-materials', 'videos', 'assignments', 'exam-results'], description: 'Access to teaching-related features' },
        { id: 4, name: 'Staff', permissions: ['enquiries', 'notices', 'attendance', 'fees'], description: 'Access to administrative features' }
    ];
    const idx = roles.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Role not found' });
    
    roles[idx] = {
        ...roles[idx],
        name: req.body.name || roles[idx].name,
        permissions: req.body.permissions || roles[idx].permissions,
        description: req.body.description || roles[idx].description
    };
    writeData('roles.json', roles);
    res.json({ success: true, role: roles[idx] });
});

app.delete('/api/roles/:id', (req, res) => {
    const roles = readData('roles.json') || [
        { id: 1, name: 'Super Admin', permissions: ['all'], description: 'Full access to all features' },
        { id: 2, name: 'Admin', permissions: ['students', 'courses', 'faculty', 'batches', 'enquiries', 'notices', 'announcements', 'tests', 'gallery', 'blogs', 'videos', 'assignments', 'exam-results'], description: 'Access to all academic features' },
        { id: 3, name: 'Faculty', permissions: ['students', 'courses', 'attendance', 'study-materials', 'videos', 'assignments', 'exam-results'], description: 'Access to teaching-related features' },
        { id: 4, name: 'Staff', permissions: ['enquiries', 'notices', 'attendance', 'fees'], description: 'Access to administrative features' }
    ];
    const idx = roles.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Role not found' });
    
    roles.splice(idx, 1);
    writeData('roles.json', roles);
    res.json({ success: true });
});

app.get('/api/permissions', (req, res) => {
    const permissions = [
        { id: 'students', name: 'Students Management' },
        { id: 'courses', name: 'Courses Management' },
        { id: 'faculty', name: 'Faculty Management' },
        { id: 'batches', name: 'Batches Management' },
        { id: 'enquiries', name: 'Enquiries Management' },
        { id: 'notices', name: 'Notices Management' },
        { id: 'announcements', name: 'Announcements Management' },
        { id: 'tests', name: 'Tests Management' },
        { id: 'gallery', name: 'Gallery Management' },
        { id: 'blogs', name: 'Blog Management' },
        { id: 'entrance-exam', name: 'Entrance Exam Management (Full Access)' },
        { id: 'admission', name: 'Admission Submission' },
        { id: 'videos', name: 'Video Learning' },
        { id: 'assignments', name: 'Assignments Management' },
        { id: 'exam-results', name: 'Exam Results Management' },
        { id: 'study-materials', name: 'Study Materials' },
        { id: 'attendance', name: 'Attendance Management' },
        { id: 'fees', name: 'Fees Management' },
        { id: 'certificates', name: 'Certificates Management' },
        { id: 'alumni', name: 'Alumni Network' },
        { id: 'helpdesk', name: 'Helpdesk/Support' },
        { id: 'backup', name: 'Backup & Recovery' },
        { id: 'settings', name: 'Settings' },
        { id: 'roles', name: 'Roles & Permissions' }
    ];
    res.json(permissions);
});

// Certificate verification endpoint
app.get('/api/certificates/verify/:certificateNumber', (req, res) => {
    const certificates = readData('certificates.json') || [];
    const certificate = certificates.find(c => c.certificateNumber === req.params.certificateNumber);
    
    if (!certificate) {
        return res.json({ success: false, message: 'Certificate not found' });
    }
    
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == certificate.studentId);
    
    res.json({ 
        success: true, 
        certificate: {
            ...certificate,
            studentName: student ? student.name : '',
            course: student ? student.course : '',
            rollNo: student ? student.rollNo : ''
        }
    });
});

// Certificate verification page
app.get('/verify-certificate', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Certificate - Genius Computer Education</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { background: white; padding: 40px; border-radius: 15px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; width: 90%; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #1e293b; margin: 0; font-size: 28px; }
        .header p { color: #64748b; margin: 10px 0 0; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; color: #374151; font-weight: 600; }
        .form-group input { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box; }
        .form-group input:focus { outline: none; border-color: #667eea; }
        .btn { width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.3s; }
        .btn:hover { background: #5568d3; }
        .result { margin-top: 30px; padding: 20px; border-radius: 8px; display: none; }
        .result.success { background: #dcfce7; border: 2px solid #22c55e; }
        .result.error { background: #fee2e2; border: 2px solid #ef4444; }
        .result h3 { margin: 0 0 15px 0; }
        .result.success h3 { color: #15803d; }
        .result.error h3 { color: #b91c1c; }
        .result p { margin: 8px 0; color: #374151; }
        .result .label { font-weight: 600; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-certificate"></i> Verify Certificate</h1>
            <p>Enter certificate number to verify authenticity</p>
        </div>
        <div class="form-group">
            <label>Certificate Number</label>
            <input type="text" id="certNumber" placeholder="e.g., GCE-CERT-2026-0001">
        </div>
        <button class="btn" onclick="verifyCertificate()">Verify</button>
        <div id="result" class="result"></div>
    </div>
    <script>
        async function verifyCertificate() {
            const certNumber = document.getElementById('certNumber').value.trim();
            const resultDiv = document.getElementById('result');
            
            if (!certNumber) {
                resultDiv.className = 'result error';
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '<h3>Error</h3><p>Please enter a certificate number</p>';
                return;
            }
            
            try {
                const res = await fetch('/api/certificates/verify/' + certNumber);
                const data = await res.json();
                
                if (data.success) {
                    const cert = data.certificate;
                    resultDiv.className = 'result success';
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<h3><i class="fas fa-check-circle"></i> Certificate Verified</h3>' +
                        '<p><span class="label">Student:</span> ' + sanitizeHTML(cert.studentName) + '</p>' +
                        '<p><span class="label">Certificate Type:</span> ' + sanitizeHTML(cert.certificateType) + '</p>' +
                        '<p><span class="label">Certificate No:</span> ' + sanitizeHTML(cert.certificateNumber) + '</p>' +
                        '<p><span class="label">Course:</span> ' + sanitizeHTML(cert.course) + '</p>' +
                        '<p><span class="label">Roll No:</span> ' + sanitizeHTML(cert.rollNo) + '</p>' +
                        '<p><span class="label">Grade:</span> ' + sanitizeHTML(cert.grade || '—') + '</p>' +
                        '<p><span class="label">Issue Date:</span> ' + sanitizeHTML(cert.issueDate) + '</p>' +
                        '<p><span class="label">Template:</span> ' + sanitizeHTML(cert.template) + '</p>';
                } else {
                    resultDiv.className = 'result error';
                    resultDiv.style.display = 'block';
                    resultDiv.textContent = 'Not Found: ' + sanitizeHTML(data.message);
                }
            } catch (e) {
                resultDiv.className = 'result error';
                resultDiv.style.display = 'block';
                resultDiv.textContent = 'Error: Unable to verify certificate';
            }
        }
        
        // Allow Enter key to trigger verification
        document.getElementById('certNumber').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') verifyCertificate();
        });
    </script>
</body>
</html>
    `);
});

// Student certificate endpoint for student portal
app.get('/api/students/:id/certificate', (req, res) => {
    const certificates = readData('certificates.json') || [];
    const studentCertificates = certificates.filter(c => c.studentId == req.params.id);
    
    if (studentCertificates.length === 0) {
        return res.json({ success: false, message: 'No certificate found for this student' });
    }
    
    // Return the most recent certificate
    const latestCertificate = studentCertificates[studentCertificates.length - 1];
    res.json({ success: true, certificate: latestCertificate });
});

// I-Card endpoint for student portal (matching admin panel design)
app.get('/api/students/:id/icard', (req, res) => {
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.id);
    if (!student) return res.status(404).send('Student not found');
    
    const settings = readData('settings.json') || {};
    const inst = settings.name || 'Genius Computer Education';
    const logo = settings.logo ? `<img src="http://localhost:3000${settings.logo}" class="icard-logo">` : '';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>I-Card - ${student.name}</title>
    <style>
        @media print {
            @page { margin: 0; size: 54mm 85.6mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #e8f4f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .icard { width: 54mm; height: 85.6mm; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%); border-radius: 10px; overflow: hidden; position: relative; box-shadow: 0 15px 35px rgba(0,0,0,0.3); }
        .icard::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6); }
        .icard::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #8b5cf6, #3b82f6, #06b6d4); }
        .icard-header { background: rgba(255,255,255,0.95); padding: 10px 15px; text-align: center; border-bottom: 2px solid #1e40af; position: relative; z-index: 1; }
        .icard-logo { width: 35px; height: 35px; object-fit: contain; vertical-align: middle; margin-right: 8px; }
        .icard-institute { color: #1e40af; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; vertical-align: middle; }
        .icard-body { padding: 6px 12px 8px; text-align: center; background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%); position: relative; z-index: 1; }
        .icard-photo { width: 70px; height: 85px; border: 3px solid white; border-radius: 8px; overflow: hidden; background: white; margin: 0 auto 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        .icard-photo img { width: 100%; height: 100%; object-fit: cover; }
        .icard-details { color: white; font-size: 8px; line-height: 1.4; text-align: left; position: relative; z-index: 1; }
        .icard-details h2 { margin: 0 0 3px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; color: white; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        .icard-details p { margin: 2px 0; font-size: 8px; }
        .icard-details .label { color: #e0f2fe; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
        .icard-details .value { color: white; font-weight: 500; }
        .icard-footer { background: rgba(255,255,255,0.95); padding: 8px 12px; text-align: center; border-top: 2px solid #1e40af; position: relative; z-index: 1; }
        .icard-footer p { margin: 0; font-size: 7px; color: #1e40af; font-weight: 600; }
        .icard-footer .valid { color: #059669; }
    </style>
</head>
<body>
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; display: flex; align-items: center; justify-content: center; opacity: 0.04;"><img src="http://localhost:3000${settings.logo || '/uploads/logo/logo.png'}" style="max-width: 200px; max-height: 200px;" onerror="this.style.display='none'"></div>
    <div class="icard">
        <div class="icard-header">
            ${logo}<span class="icard-institute">${inst}</span>
        </div>
        <div class="icard-body">
            <div class="icard-photo">
                ${student.photo ? `<img src="http://localhost:3000${student.photo}">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;font-size:24px;color:#64748b;"><i class="fas fa-user"></i></div>'}
            </div>
            <div class="icard-details">
                <h2>${student.name}</h2>
                <p><span class="label">Roll No:</span> <span class="value">${student.rollNo}</span></p>
                <p><span class="label">Course:</span> <span class="value">${student.course}</span></p>
                <p><span class="label">Batch:</span> <span class="value">${student.batch || '—'}</span></p>
                <p><span class="label">Phone:</span> <span class="value">${student.phone || '—'}</span></p>
            </div>
        </div>
        <div class="icard-footer">
            <p>Valid Till: <span class="valid">${formatDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)))}</span></p>
        </div>
    </div>
</body>
</html>`;
    
    res.send(html);
});

// Certificate HTML template generators
function getCertificateTemplate(template, student, certificate, settings) {
    const inst = settings.name || 'Genius Computer Education';
    const addr = settings.address || '';
    const phone = settings.phone || '';
    const logo = settings.logo ? `<img src="http://localhost:3000${settings.logo}" style="max-height:60px;">` : '';
    
    // Get content based on certificate type
    const certificateContent = getCertificateContent(certificate.certificateType);
    
    // Get type-specific color scheme
    const typeColors = getTypeColors(certificate.certificateType);
    
    // Determine display item and label based on certificate type
    const type = certificate.certificateType;
    let displayItem, displayLabel, showRollNo, showGrade, additionalFields = [];
    
    switch (type) {
        case 'Course Completion':
            displayItem = student.course;
            displayLabel = 'Course';
            showRollNo = true;
            showGrade = true;
            break;
        case 'Achievement':
            displayItem = certificate.achievementTitle || student.course;
            displayLabel = 'Achievement';
            showRollNo = true;
            showGrade = false;
            if (certificate.awardRank) additionalFields.push({ label: 'Award/Rank', value: certificate.awardRank });
            break;
        case 'Participation':
            displayItem = certificate.eventName || student.course;
            displayLabel = 'Event';
            showRollNo = false;
            showGrade = false;
            if (certificate.eventDuration) additionalFields.push({ label: 'Duration', value: certificate.eventDuration });
            if (certificate.eventLocation) additionalFields.push({ label: 'Location', value: certificate.eventLocation });
            if (certificate.participationLevel) additionalFields.push({ label: 'Participation', value: certificate.participationLevel });
            break;
        case 'Excellence':
            displayItem = certificate.excellenceCategory || student.course;
            displayLabel = 'Excellence Category';
            showRollNo = true;
            showGrade = false;
            if (certificate.excellenceAward) additionalFields.push({ label: 'Award', value: certificate.excellenceAward });
            break;
        case 'Internship':
            displayItem = certificate.internshipRole || student.course;
            displayLabel = 'Internship Role';
            showRollNo = false;
            showGrade = false;
            if (certificate.companyName) additionalFields.push({ label: 'Company', value: certificate.companyName });
            if (certificate.internshipDuration) additionalFields.push({ label: 'Duration', value: certificate.internshipDuration });
            if (certificate.performanceRating) additionalFields.push({ label: 'Performance', value: certificate.performanceRating });
            break;
        case 'Attendance':
            displayItem = student.course;
            displayLabel = 'Course';
            showRollNo = true;
            showGrade = false;
            if (certificate.attendancePeriod) additionalFields.push({ label: 'Attendance Period', value: certificate.attendancePeriod });
            if (certificate.attendancePercentage) additionalFields.push({ label: 'Attendance', value: certificate.attendancePercentage });
            break;
        default:
            displayItem = student.course;
            displayLabel = 'Course';
            showRollNo = true;
            showGrade = true;
    }
    
    const templates = {
        classic: () => `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Certificate - ${student.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Great+Vibes&family=Georgia&family=Lato:wght@400;600&family=Cinzel+Decorative:wght@700&display=swap" rel="stylesheet">
    <style>
        @page { size: landscape; margin: 0; }
        body { font-family: 'Georgia', serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .certificate { max-width: 1000px; margin: 0 auto; background: white; border: 10px solid ${typeColors.primary}; padding: 40px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); position: relative; }
        .certificate::before { content: ''; position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; border: 2px solid ${typeColors.secondary}; pointer-events: none; }
        .certificate::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 200px; height: 200px; background: radial-gradient(circle, ${typeColors.primary} 0%, transparent 70%); opacity: 0.03; border-radius: 50%; pointer-events: none; }
        .header { text-align: center; margin-bottom: 30px; }
        .header img { max-height: 60px; margin-bottom: 15px; }
        .header h1 { color: ${typeColors.primary}; margin: 0; font-size: 20px; font-family: 'Playfair Display', serif; font-weight: 700; letter-spacing: 1px; }
        .header p { color: ${typeColors.primary}; margin: 10px 0 0; font-size: 40px; text-transform: uppercase; letter-spacing: 2px; font-family: 'Cinzel Decorative', cursive; font-weight: 700; }
        .content { text-align: center; margin: 40px 0; }
        .content h2 { color: #1e293b; font-size: 28px; margin-bottom: 20px; font-family: 'Playfair Display', serif; font-weight: 700; }
        .content p { color: #374151; font-size: 16px; line-height: 1.8; margin: 10px 0; }
        .content .name { font-size: 42px; font-family: 'Great Vibes', cursive; color: ${typeColors.primary}; margin: 30px 0; }
        .content .description { color: #475569; font-size: 14px; line-height: 1.6; margin: 20px 0; font-style: italic; }
        .content .best-wishes { color: ${typeColors.primary}; font-size: 15px; line-height: 1.6; margin: 20px 0; font-weight: 600; }
        .details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px; }
        .details div { text-align: left; }
        .details label { font-size: 13px; color: #64748b; display: block; font-family: 'Lato', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .details span { font-size: 15px; font-weight: 600; color: #1e293b; font-family: 'Lato', sans-serif; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
        .footer p { color: #64748b; margin: 5px 0; font-size: 13px; font-family: 'Lato', sans-serif; }
        .signature { text-align: right; margin-top: 40px; }
        .signature .name { margin: 0; font-family: 'Great Vibes', cursive; font-size: 26px; color: ${typeColors.primary}; }
        .signature .title { margin: 5px 0 0; font-size: 14px; color: #64748b; font-family: 'Lato', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .signature .line { border-top: 2px solid #1e293b; width: 200px; margin-top: 5px; }
        .seal { position: absolute; bottom: 60px; right: 60px; width: 80px; height: 80px; border: 3px solid ${typeColors.primary}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: ${typeColors.primary}; font-weight: bold; text-align: center; line-height: 1.2; background: linear-gradient(135deg, #ffd700 0%, #ffec8b 100%); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        ${typeColors.accent ? `.certificate::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, ${typeColors.accent}, ${typeColors.primary}); }` : ''}
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">
            ${logo}
            <h1>${inst}</h1>
            <p>${certificateContent.title}</p>
        </div>
        <div class="content">
            <p>${certificateContent.intro}</p>
            <div class="name">${student.name}</div>
            <p>${certificateContent.action}</p>
            <h2>${displayItem}</h2>
            <p>${certificateContent.conclusion} ${inst}</p>
            <p class="description">${certificateContent.description}</p>
            <p class="best-wishes">${certificateContent.bestWishes}</p>
        </div>
        <div class="details">
            ${showRollNo ? '<div><label>Roll No</label><span>' + student.rollNo + '</span></div>' : ''}
            <div><label>${displayLabel}</label><span>${displayItem}</span></div>
            ${showGrade ? '<div><label>Grade</label><span>' + (certificate.grade || '—') + '</span></div>' : ''}
            ${additionalFields.map(f => '<div><label>' + f.label + '</label><span>' + f.value + '</span></div>').join('')}
            <div><label>Issue Date</label><span>${certificate.issueDate}</span></div>
        </div>
        <div class="footer">
            <p>${addr}</p>
            <p>${phone}</p>
        </div>
        <div class="signature">
            <p class="name">Vashim Kaushar</p>
            <p class="title">Director</p>
            <div class="line"></div>
        </div>
    </div>
</body>
</html>`,
        
        modern: () => `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Certificate - ${student.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Pacifico&family=Open+Sans:wght@400&family=Roboto:wght@400;600&family=Cinzel+Decorative:wght@700&display=swap" rel="stylesheet">
    <style>
        @page { size: landscape; margin: 0; }
        body { font-family: 'Open Sans', sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, ${typeColors.primary} 0%, ${typeColors.secondary} 100%); }
        .certificate { max-width: 1000px; margin: 0 auto; background: white; padding: 50px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); border-radius: 10px; position: relative; }
        .certificate::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, ${typeColors.primary}, ${typeColors.secondary}); border-radius: 10px 10px 0 0; }
        .certificate::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle at 2px 2px, rgba(0,0,0,0.03) 1px, transparent 0); background-size: 30px 30px; pointer-events: none; border-radius: 10px; }
        .header { text-align: center; margin-bottom: 40px; }
        .header img { max-height: 70px; margin-bottom: 20px; }
        .header h1 { color: ${typeColors.primary}; margin: 0; font-size: 20px; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 1px; }
        .header p { color: ${typeColors.primary}; margin: 15px 0 0; font-size: 40px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; font-family: 'Cinzel Decorative', cursive; }
        .content { text-align: center; margin: 50px 0; }
        .content h2 { color: #333; font-size: 32px; margin-bottom: 25px; font-weight: bold; font-family: 'Montserrat', sans-serif; }
        .content p { color: #555; font-size: 18px; line-height: 2; margin: 15px 0; }
        .content .name { font-size: 44px; font-family: 'Pacifico', cursive; color: ${typeColors.primary}; margin: 40px 0; }
        .content .description { color: #555; font-size: 14px; line-height: 1.6; margin: 20px 0; font-style: italic; }
        .content .best-wishes { color: ${typeColors.primary}; font-size: 15px; line-height: 1.6; margin: 20px 0; font-weight: 600; }
        .details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; margin: 40px 0; padding: 30px; background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%); border-radius: 10px; }
        .details div { text-align: left; }
        .details label { font-size: 14px; color: ${typeColors.primary}; display: block; font-family: 'Roboto', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .details span { font-size: 16px; font-weight: 600; color: #333; font-family: 'Roboto', sans-serif; }
        .footer { text-align: center; margin-top: 50px; padding-top: 25px; border-top: 3px solid ${typeColors.primary}; }
        .footer p { color: #666; margin: 8px 0; font-size: 14px; font-family: 'Roboto', sans-serif; }
        .signature { text-align: right; margin-top: 50px; }
        .signature .name { margin: 0; font-family: 'Pacifico', cursive; font-size: 28px; color: ${typeColors.primary}; }
        .signature .title { margin: 5px 0 0; font-size: 14px; color: #64748b; font-family: 'Roboto', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .signature .line { border-top: 3px solid ${typeColors.primary}; width: 220px; margin-top: 8px; }
        ${typeColors.accent ? `.certificate::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 10px; background: ${typeColors.accent}; border-radius: 10px 10px 0 0; }` : ''}
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">
            ${logo}
            <h1>${inst}</h1>
            <p>${certificateContent.title}</p>
        </div>
        <div class="content">
            <p>${certificateContent.intro}</p>
            <div class="name">${student.name}</div>
            <p>${certificateContent.action}</p>
            <h2>${displayItem}</h2>
            <p>${certificateContent.conclusion} ${inst}</p>
            <p class="description">${certificateContent.description}</p>
            <p class="best-wishes">${certificateContent.bestWishes}</p>
        </div>
        <div class="details">
            ${showRollNo ? '<div><label>Roll No</label><span>' + student.rollNo + '</span></div>' : ''}
            <div><label>${displayLabel}</label><span>${displayItem}</span></div>
            ${showGrade ? '<div><label>Grade</label><span>' + (certificate.grade || '—') + '</span></div>' : ''}
            ${additionalFields.map(f => '<div><label>' + f.label + '</label><span>' + f.value + '</span></div>').join('')}
            <div><label>Issue Date</label><span>${certificate.issueDate}</span></div>
        </div>
        <div class="footer">
            <p>${addr}</p>
            <p>${phone}</p>
        </div>
        <div class="signature">
            <p class="name">Vashim Kaushar</p>
            <p class="title">Director</p>
            <div class="line"></div>
        </div>
    </div>
</body>
</html>`,
        
        elegant: () => `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Certificate - ${student.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Brush+Script&family=Playfair+Display:wght@400;600&family=Cinzel+Decorative:wght@700&display=swap" rel="stylesheet">
    <style>
        @page { size: landscape; margin: 0; }
        body { font-family: 'Times New Roman', serif; margin: 0; padding: 30px; background: ${typeColors.background}; }
        .certificate { max-width: 1000px; margin: 0 auto; background: ${typeColors.bg}; padding: 50px; box-shadow: 0 15px 40px rgba(0,0,0,0.3); border: 5px double ${typeColors.primary}; position: relative; }
        .certificate::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(212,175,55,0.05) 50%, rgba(212,175,55,0.1) 100%); pointer-events: none; }
        .certificate::after { content: ''; position: absolute; top: 15px; left: 15px; right: 15px; bottom: 15px; border: 1px solid ${typeColors.accent || '#d4af37'}; pointer-events: none; }
        .header { text-align: center; margin-bottom: 40px; }
        .header img { max-height: 70px; margin-bottom: 20px; }
        .header h1 { color: ${typeColors.primary}; margin: 0; font-size: 20px; font-weight: bold; font-family: 'Cinzel', serif; letter-spacing: 1px; }
        .header p { color: ${typeColors.primary}; margin: 15px 0 0; font-size: 40px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-family: 'Cinzel Decorative', cursive; }
        .content { text-align: center; margin: 50px 0; }
        .content h2 { color: #5d4037; font-size: 30px; margin-bottom: 25px; font-family: 'Cinzel', serif; }
        .content p { color: #4e342e; font-size: 18px; line-height: 2; margin: 15px 0; font-style: italic; }
        .content .name { font-size: 40px; font-weight: bold; color: ${typeColors.primary}; margin: 40px 0; font-family: 'Brush Script', cursive; }
        .content .description { color: #5d4037; font-size: 14px; line-height: 1.6; margin: 20px 0; font-style: italic; }
        .content .best-wishes { color: ${typeColors.primary}; font-size: 15px; line-height: 1.6; margin: 20px 0; font-weight: bold; }
        .details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; margin: 40px 0; padding: 25px; background: ${typeColors.detailsBg}; border: 2px solid ${typeColors.primary}; }
        .details div { text-align: left; }
        .details label { font-size: 14px; color: ${typeColors.primary}; display: block; font-family: 'Playfair Display', serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .details span { font-size: 16px; font-weight: 600; color: #5d4037; font-family: 'Playfair Display', serif; }
        .footer { text-align: center; margin-top: 50px; padding-top: 25px; border-top: 3px double ${typeColors.primary}; }
        .footer p { color: #6d4c41; margin: 8px 0; font-size: 14px; font-family: 'Playfair Display', serif; }
        .signature { text-align: right; margin-top: 50px; }
        .signature .name { margin: 0; color: ${typeColors.primary}; font-weight: bold; font-family: 'Brush Script', cursive; font-size: 28px; }
        .signature .title { margin: 5px 0 0; font-size: 14px; color: #6d4c41; font-family: 'Playfair Display', serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .signature .line { border-top: 3px double ${typeColors.primary}; width: 220px; margin-top: 8px; }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">
            ${logo}
            <h1>${inst}</h1>
            <p>${certificateContent.title}</p>
        </div>
        <div class="content">
            <p>${certificateContent.intro}</p>
            <div class="name">${student.name}</div>
            <p>${certificateContent.action}</p>
            <h2>${displayItem}</h2>
            <p>${certificateContent.conclusion} ${inst}</p>
            <p class="description">${certificateContent.description}</p>
            <p class="best-wishes">${certificateContent.bestWishes}</p>
        </div>
        <div class="details">
            ${showRollNo ? '<div><label>Roll No</label><span>' + student.rollNo + '</span></div>' : ''}
            <div><label>${displayLabel}</label><span>${displayItem}</span></div>
            ${showGrade ? '<div><label>Grade</label><span>' + (certificate.grade || '—') + '</span></div>' : ''}
            ${additionalFields.map(f => '<div><label>' + f.label + '</label><span>' + f.value + '</span></div>').join('')}
            <div><label>Issue Date</label><span>${certificate.issueDate}</span></div>
        </div>
        <div class="footer">
            <p>${addr}</p>
            <p>${phone}</p>
        </div>
        <div class="signature">
            <p class="name">Vashim Kaushar</p>
            <p class="title">Director</p>
            <div class="line"></div>
        </div>
    </div>
</body>
</html>`,
        
        professional: () => `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Certificate - ${student.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700&family=Cormorant+Garamond:wght@600&family=Merriweather:wght@400&family=Open+Sans:wght@400;600&family=Cinzel+Decorative:wght@700&display=swap" rel="stylesheet">
    <style>
        @page { size: landscape; margin: 0; }
        body { font-family: 'Merriweather', serif; margin: 0; padding: 20px; background: ${typeColors.background}; }
        .certificate { max-width: 1000px; margin: 0 auto; background: white; padding: 45px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); border-left: 8px solid ${typeColors.primary}; position: relative; }
        .certificate::before { content: ''; position: absolute; top: 0; left: 8px; right: 0; height: 4px; background: linear-gradient(90deg, ${typeColors.primary}, ${typeColors.secondary}); }
        .header { display: flex; justify-content: center; align-items: center; gap: 20px; margin-bottom: 35px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
        .header img { max-height: 65px; }
        .header h1 { color: #1e293b; margin: 0; font-size: 20px; font-weight: 700; font-family: 'Poppins', sans-serif; letter-spacing: 0.5px; }
        .header .cert-no { position: absolute; top: 20px; right: 20px; color: #64748b; font-size: 14px; font-weight: 600; font-family: 'Open Sans', sans-serif; letter-spacing: 0.5px; }
        .content { text-align: center; margin: 45px 0; }
        .content h2 { color: ${typeColors.primary}; font-size: 40px; margin-bottom: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-family: 'Cinzel Decorative', cursive; }
        .content p { color: #475569; font-size: 17px; line-height: 1.9; margin: 12px 0; }
        .content .name { font-size: 38px; font-weight: 700; color: #1e293b; margin: 35px 0; letter-spacing: 1px; font-family: 'Cormorant Garamond', serif; }
        .content .description { color: #475569; font-size: 13px; line-height: 1.6; margin: 20px 0; font-style: italic; }
        .content .best-wishes { color: ${typeColors.primary}; font-size: 14px; line-height: 1.6; margin: 20px 0; font-weight: 600; }
        .details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; margin: 35px 0; padding: 25px; background: #f8fafc; border-left: 4px solid ${typeColors.primary}; }
        .details div { text-align: left; }
        .details label { font-size: 12px; color: #64748b; display: block; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Open Sans', sans-serif; }
        .details span { font-size: 15px; font-weight: 600; color: #1e293b; font-family: 'Open Sans', sans-serif; }
        .footer { display: flex; justify-content: space-between; margin-top: 45px; padding-top: 25px; border-top: 2px solid #e5e7eb; }
        .footer .contact p { color: #64748b; margin: 5px 0; font-size: 13px; font-family: 'Open Sans', sans-serif; }
        .footer .qr { text-align: right; }
        .footer .qr p { color: #64748b; margin: 5px 0; font-size: 12px; font-family: 'Open Sans', sans-serif; }
        .signature { text-align: right; margin-top: 45px; }
        .signature .name { margin: 0; color: #1e293b; font-weight: 700; font-size: 18px; font-family: 'Cormorant Garamond', serif; }
        .signature .title { margin: 5px 0 0; font-size: 13px; color: #64748b; font-family: 'Open Sans', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .signature .line { border-top: 2px solid ${typeColors.primary}; width: 180px; margin-top: 6px; }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="header">
            ${logo}
            <h1>${inst}</h1>
            <div class="cert-no">Certificate No: ${certificate.certificateNumber || 'N/A'}</div>
        </div>
        <div class="content">
            <h2>${certificateContent.title}</h2>
            <p>${certificateContent.intro}</p>
            <div class="name">${student.name}</div>
            <p>${certificateContent.action}</p>
            <h2>${displayItem}</h2>
            <p>${certificateContent.conclusion} ${inst}</p>
            <p class="description">${certificateContent.description}</p>
            <p class="best-wishes">${certificateContent.bestWishes}</p>
        </div>
        <div class="details">
            ${showRollNo ? '<div><label>Roll No</label><span>' + student.rollNo + '</span></div>' : ''}
            <div><label>${displayLabel}</label><span>${displayItem}</span></div>
            ${showGrade ? '<div><label>Grade</label><span>' + (certificate.grade || '—') + '</span></div>' : ''}
            ${additionalFields.map(f => '<div><label>' + f.label + '</label><span>' + f.value + '</span></div>').join('')}
            <div><label>Issue Date</label><span>${certificate.issueDate}</span></div>
        </div>
        <div class="footer">
            <div class="contact">
                <p>${addr}</p>
                <p>${phone}</p>
            </div>
            <div class="qr">
                <p>Verify at: genius-education.com/verify</p>
                <p>${certificate.certificateNumber || 'N/A'}</p>
            </div>
        </div>
        <div class="signature">
            <p class="name">Vashim Kaushar</p>
            <p class="title">Director</p>
            <div class="line"></div>
        </div>
    </div>
</body>
</html>`
    };
    
    return (templates[template] || templates.classic)();
}

// Get type-specific color scheme
function getTypeColors(certificateType) {
    const colors = {
        'Course Completion': {
            primary: '#1e3a8a',
            secondary: '#3b82f6',
            accent: '#1e40af',
            background: '#f5f5f5'
        },
        'Achievement': {
            primary: '#f59e0b',
            secondary: '#fbbf24',
            accent: '#d97706',
            background: '#fef3c7'
        },
        'Participation': {
            primary: '#14b8a6',
            secondary: '#2dd4bf',
            accent: '#0d9488',
            background: '#f0fdfa'
        },
        'Excellence': {
            primary: '#4f46e5',
            secondary: '#6366f1',
            accent: '#4338ca',
            background: '#eef2ff'
        },
        'Internship': {
            primary: '#0ea5e9',
            secondary: '#38bdf8',
            accent: '#0284c7',
            background: '#f0f9ff'
        },
        'Attendance': {
            primary: '#10b981',
            secondary: '#34d399',
            accent: '#059669',
            background: '#ecfdf5'
        }
    };
    
    // Add special colors for Elegant template
    if (certificateType === 'Achievement') {
        return {
            primary: '#8b4513',
            secondary: '#a0522d',
            accent: '#d4af37',
            background: '#d4a574',
            bg: '#f5f5dc',
            detailsBg: '#fff8dc'
        };
    }
    
    if (certificateType === 'Excellence') {
        return {
            primary: '#8b4513',
            secondary: '#a0522d',
            accent: '#d4af37',
            background: '#d4a574',
            bg: '#f5f5dc',
            detailsBg: '#fff8dc'
        };
    }
    
    return colors[certificateType] || colors['Course Completion'];
}

// Get certificate content based on type
function getCertificateContent(certificateType) {
    const content = {
        'Course Completion': {
            title: 'Certificate of Completion',
            intro: 'This is to certify that',
            action: 'has successfully completed the',
            conclusion: 'at',
            description: 'This course was designed to provide comprehensive knowledge and practical skills in the respective field.',
            bestWishes: 'We wish you continued success in your future endeavors and hope this achievement serves as a stepping stone to greater heights.'
        },
        'Achievement': {
            title: 'Certificate of Achievement',
            intro: 'This is to certify that',
            action: 'has achieved excellence in',
            conclusion: 'at',
            description: 'This achievement recognizes outstanding performance, dedication, and exceptional contribution in the respective field.',
            bestWishes: 'Congratulations on your remarkable achievement! May this success inspire you to reach even greater milestones in your journey.'
        },
        'Participation': {
            title: 'Certificate of Participation',
            intro: 'This is to certify that',
            action: 'has participated in',
            conclusion: 'at',
            description: 'This participation demonstrates active involvement, enthusiasm, and commitment to learning and personal development.',
            bestWishes: 'We appreciate your participation and encourage you to continue exploring new opportunities for growth and learning.'
        },
        'Excellence': {
            title: 'Certificate of Excellence',
            intro: 'This is to certify that',
            action: 'has demonstrated outstanding performance in',
            conclusion: 'at',
            description: 'This excellence award recognizes exceptional dedication, superior performance, and remarkable achievements in the respective domain.',
            bestWishes: 'Your commitment to excellence is truly inspiring. We wish you continued success and many more accolades in your future endeavors.'
        },
        'Internship': {
            title: 'Certificate of Internship',
            intro: 'This is to certify that',
            action: 'has successfully completed internship in',
            conclusion: 'at',
            description: 'During this internship, valuable practical experience, industry exposure, and professional skills were acquired in a real-world environment.',
            bestWishes: 'We wish you great success in your professional career and hope this internship experience serves as a strong foundation for your future endeavors.'
        },
        'Attendance': {
            title: 'Certificate of Attendance',
            intro: 'This is to certify that',
            action: 'has maintained perfect attendance for',
            conclusion: 'at',
            description: 'This certificate recognizes consistent dedication, punctuality, and commitment to regular participation throughout the specified period.',
            bestWishes: 'Your discipline and commitment are commendable. We wish you continued success in all your future pursuits.'
        }
    };
    
    return content[certificateType] || content['Course Completion'];
}

// Certificate HTML endpoint for student portal
app.get('/api/students/:id/certificate/view', (req, res) => {
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.id);
    if (!student) return res.status(404).send('Student not found');
    
    const certificates = readData('certificates.json') || [];
    const studentCertificates = certificates.filter(c => c.studentId == req.params.id);
    
    if (studentCertificates.length === 0) {
        return res.status(404).send('No certificate found for this student');
    }
    
    const certificate = studentCertificates[studentCertificates.length - 1];
    const settings = readData('settings.json') || {};
    
    const template = certificate.template || 'classic';
    const html = getCertificateTemplate(template, student, certificate, settings);
    
    res.send(html);
});

app.get('/api/students/:id/slip', (req, res) => {
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.id);
    if (!student) return res.status(404).send('Student not found');
    const settings = readData('settings.json') || {};
    res.send(generateSlipHTML(student, settings, null));
});

// --- Carousel ---
app.get('/api/carousel', (req, res) => {
    res.json(readData('carousel.json') || []);
});

app.post('/api/carousel', uploadCarousel.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const carousel = readData('carousel.json') || [];
    const item = {
        id: Date.now(),
        caption: req.body.caption || '',
        image: '/uploads/carousel/' + req.file.filename
    };
    carousel.push(item);
    writeData('carousel.json', carousel);
    res.json({ success: true, item });
});

app.delete('/api/carousel/:id', (req, res) => {
    let carousel = readData('carousel.json');
    const item = carousel.find(c => c.id == req.params.id);
    if (item && item.image) {
        const imgPath = path.join(__dirname, item.image);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    carousel = carousel.filter(c => c.id != req.params.id);
    writeData('carousel.json', carousel);
    res.json({ success: true });
});

// --- Exam Management ---
app.get('/api/exams', (req, res) => {
    res.json(readData('exams.json') || []);
});

app.post('/api/exams', (req, res) => {
    const exams = readData('exams.json') || [];
    const newExam = {
        id: Date.now(),
        name: req.body.name,
        course: req.body.course,
        date: req.body.date,
        duration: req.body.duration,
        totalMarks: req.body.totalMarks,
        status: req.body.status || 'Draft',
        createdAt: new Date().toISOString()
    };
    exams.push(newExam);
    writeData('exams.json', exams);
    res.json({ success: true, exam: newExam });
});

app.put('/api/exams/:id', (req, res) => {
    let exams = readData('exams.json') || [];
    const index = exams.findIndex(e => e.id == req.params.id);
    if (index !== -1) {
        exams[index] = { ...exams[index], ...req.body };
        writeData('exams.json', exams);
        res.json({ success: true, exam: exams[index] });
    } else {
        res.status(404).json({ success: false, message: 'Exam not found' });
    }
});

app.delete('/api/exams/:id', (req, res) => {
    let exams = readData('exams.json') || [];
    exams = exams.filter(e => e.id != req.params.id);
    writeData('exams.json', exams);
    res.json({ success: true });
});

// --- Question Bank ---
app.get('/api/questions', (req, res) => {
    const questions = readData('questions.json') || [];
    const courses = readData('courses.json') || [];
    const { course, type, difficulty } = req.query;
    let filtered = questions;
    if (course) filtered = filtered.filter(q => q.course === course);
    if (type) filtered = filtered.filter(q => q.type === type);
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);
    
    // Add course name to each question
    const questionsWithCourseName = filtered.map(q => {
        const courseObj = courses.find(c => c.id == q.course);
        return { ...q, courseName: courseObj ? courseObj.name : '' };
    });
    
    res.json({ questions: questionsWithCourseName });
});

app.get('/api/questions/:id', (req, res) => {
    const questions = readData('questions.json') || [];
    const questionId = parseInt(req.params.id);
    const question = questions.find(q => q.id == questionId);
    if (question) {
        res.json(question);
    } else {
        res.status(404).json({ success: false, message: 'Question not found' });
    }
});

app.post('/api/questions', (req, res) => {
    const questions = readData('questions.json') || [];
    const newQuestion = {
        id: Date.now(),
        text: req.body.text,
        textHindi: req.body.textHindi || '',
        course: req.body.course,
        type: req.body.type,
        difficulty: req.body.difficulty,
        marks: req.body.marks,
        options: req.body.options || [],
        correctAnswer: req.body.correctAnswer,
        gradingCriteria: req.body.gradingCriteria || '',
        createdAt: new Date().toISOString()
    };
    questions.push(newQuestion);
    writeData('questions.json', questions);
    res.json({ success: true, question: newQuestion });
});

app.post('/api/questions/bulk-upload', uploadBulk.single('file'), async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const course = req.body.course;
        const type = req.body.type;
        const difficulty = req.body.difficulty;
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        // Read the Excel/CSV file
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        if (data.length === 0) {
            return res.status(400).json({ success: false, message: 'No data found in file' });
        }
        
        const questions = readData('questions.json') || [];
        let addedCount = 0;
        
        data.forEach(row => {
            // Build options array (plain strings, matching saveQuestion format)
            const options = [];
            const rawOpts = [
                row.Option1 || row.option1,
                row.Option2 || row.option2,
                row.Option3 || row.option3,
                row.Option4 || row.option4
            ];
            rawOpts.forEach(o => {
                if (o != null && String(o).trim() !== '') options.push(String(o));
            });
            
            // Normalize correctAnswer to format expected by app
            let correctAnswer = row.CorrectAnswer != null ? row.CorrectAnswer : (row.correctAnswer != null ? row.correctAnswer : '');
            correctAnswer = String(correctAnswer).trim();
            
            if (type === 'MCQ' && options.length > 0) {
                // Accept: 1-4, A-D, or matching option text → convert to 0-based index string
                let idx = -1;
                const ca = correctAnswer.toUpperCase();
                if (/^[1-9]$/.test(ca)) {
                    idx = parseInt(ca) - 1;
                } else if (/^[A-Z]$/.test(ca) && ca.length === 1) {
                    idx = ca.charCodeAt(0) - 'A'.charCodeAt(0);
                } else {
                    idx = options.findIndex(o => String(o).trim().toLowerCase() === correctAnswer.toLowerCase());
                }
                correctAnswer = (idx >= 0 && idx < options.length) ? String(idx) : '';
            } else if (type === 'TrueFalse') {
                const ca = correctAnswer.toLowerCase();
                if (['true', 't', '1', 'yes'].includes(ca)) correctAnswer = 'true';
                else if (['false', 'f', '0', 'no'].includes(ca)) correctAnswer = 'false';
            }
            
            const question = {
                id: Date.now() + addedCount,
                text: row.Question || row.question || '',
                textHindi: row.QuestionHindi || row.questionHindi || '',
                course: course,
                type: type,
                difficulty: difficulty,
                marks: parseInt(row.Marks || row.marks) || 1,
                options: options,
                correctAnswer: correctAnswer,
                createdAt: new Date().toISOString()
            };
            
            questions.push(question);
            addedCount++;
        });
        
        writeData('questions.json', questions);
        
        // Delete the uploaded file
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, message: `Successfully uploaded ${addedCount} questions` });
    } catch (e) {
        console.error('Error uploading bulk questions:', e);
        res.status(500).json({ success: false, message: 'Error processing file: ' + e.message });
    }
});

app.put('/api/questions/:id', (req, res) => {
    let questions = readData('questions.json') || [];
    const questionId = parseInt(req.params.id);
    const index = questions.findIndex(q => q.id == questionId);
    if (index !== -1) {
        const originalQuestion = questions[index];
        questions[index] = {
            id: originalQuestion.id,
            createdAt: originalQuestion.createdAt,
            ...req.body
        };
        writeData('questions.json', questions);
        res.json({ success: true, question: questions[index] });
    } else {
        res.status(404).json({ success: false, message: 'Question not found' });
    }
});

app.delete('/api/questions/:id', (req, res) => {
    let questions = readData('questions.json') || [];
    const questionId = parseInt(req.params.id);
    questions = questions.filter(q => q.id != questionId);
    writeData('questions.json', questions);
    res.json({ success: true });
});

// --- Exam Schedule ---
app.get('/api/exam-schedules', (req, res) => {
    res.json(readData('exam-schedules.json') || []);
});

app.get('/api/exam-schedules/:id', (req, res) => {
    const schedules = readData('exam-schedules.json') || [];
    const scheduleId = parseInt(req.params.id);
    const schedule = schedules.find(s => s.id == scheduleId);
    if (schedule) {
        res.json(schedule);
    } else {
        res.status(404).json({ success: false, message: 'Exam schedule not found' });
    }
});

app.post('/api/exam-schedules', (req, res) => {
    const schedules = readData('exam-schedules.json') || [];
    const newSchedule = {
        id: Date.now(),
        exam: req.body.exam,
        course: req.body.course,
        batch: req.body.batch,
        date: req.body.date,
        time: req.body.time,
        duration: req.body.duration,
        totalMarks: req.body.totalMarks,
        venue: req.body.venue,
        status: req.body.status || 'Scheduled',
        description: req.body.description || '',
        createdAt: new Date().toISOString()
    };
    schedules.push(newSchedule);
    writeData('exam-schedules.json', schedules);
    res.json({ success: true, schedule: newSchedule });
});

app.put('/api/exam-schedules/:id', (req, res) => {
    let schedules = readData('exam-schedules.json') || [];
    const scheduleId = parseInt(req.params.id);
    const index = schedules.findIndex(s => s.id == scheduleId);
    if (index !== -1) {
        const originalSchedule = schedules[index];
        schedules[index] = {
            id: originalSchedule.id,
            createdAt: originalSchedule.createdAt,
            ...req.body
        };
        writeData('exam-schedules.json', schedules);
        res.json({ success: true, schedule: schedules[index] });
    } else {
        res.status(404).json({ success: false, message: 'Exam schedule not found' });
    }
});

app.delete('/api/exam-schedules/:id', (req, res) => {
    let schedules = readData('exam-schedules.json') || [];
    const scheduleId = parseInt(req.params.id);
    schedules = schedules.filter(s => s.id != scheduleId);
    writeData('exam-schedules.json', schedules);
    res.json({ success: true });
});

// --- Exam Registration ---
app.get('/api/exam-registrations', (req, res) => {
    const registrations = readData('exam-registrations.json') || [];
    const students = readData('students.json') || [];
    const schedules = readData('exam-schedules.json') || [];
    
    const enriched = registrations.map(r => {
        const student = students.find(s => s.id == r.student);
        const schedule = schedules.find(s => s.id == r.exam);
        const fees = student ? (student.fees || {}) : {};
        return {
            ...r,
            studentName: r.studentName || (student ? student.name : 'Unknown'),
            studentRollNo: r.studentRollNo || (student ? student.rollNo : ''),
            examName: r.examName || (schedule ? schedule.exam : 'Unknown'),
            examDate: schedule ? schedule.date : '',
            examTime: schedule ? schedule.time : '',
            feeStatus: (fees.dueAmount || 0) > 0 ? 'Pending' : 'Paid',
            dueAmount: fees.dueAmount || 0
        };
    });
    
    res.json(enriched.reverse());
});

app.get('/api/exam-registrations/:id', (req, res) => {
    const registrations = readData('exam-registrations.json') || [];
    const registrationId = parseInt(req.params.id);
    const registration = registrations.find(r => r.id == registrationId);
    if (registration) {
        res.json(registration);
    } else {
        res.status(404).json({ success: false, message: 'Registration not found' });
    }
});

app.post('/api/exam-registrations', (req, res) => {
    const registrations = readData('exam-registrations.json') || [];
    const students = readData('students.json') || [];
    const schedules = readData('exam-schedules.json') || [];
    
    const studentId = req.body.student;
    const examId = req.body.exam;
    
    // Get student details
    const student = students.find(s => s.id == studentId);
    if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    // Fee check: only allow if all fees are paid
    const fees = student.fees || {};
    if ((fees.dueAmount || 0) > 0) {
        return res.status(403).json({ success: false, message: 'Please clear all pending dues before registering for exam. Due amount: ₹' + fees.dueAmount });
    }
    
    // Check for duplicate registration
    const existing = registrations.find(r => r.student == studentId && r.exam == examId && r.status !== 'Rejected');
    if (existing) {
        return res.status(409).json({ success: false, message: 'You have already registered for this exam. Status: ' + existing.status });
    }
    
    // Get exam schedule details
    const schedule = schedules.find(s => s.id == examId);
    
    const newRegistration = {
        id: Date.now(),
        student: studentId,
        studentName: student.name || '',
        exam: examId,
        examName: schedule ? (schedule.exam || '') : '',
        course: req.body.course || student.course || '',
        courseName: student.course || '',
        status: 'Pending',
        payment: req.body.payment || 'Pending',
        registrationDate: req.body.registrationDate || new Date().toISOString().split('T')[0],
        registeredAt: new Date().toISOString()
    };
    
    registrations.push(newRegistration);
    writeData('exam-registrations.json', registrations);
    res.json({ success: true, registration: newRegistration, message: 'Registration submitted. Waiting for admin approval.' });
});

app.get('/api/exam-registrations/student/:studentId', (req, res) => {
    const registrations = readData('exam-registrations.json') || [];
    const schedules = readData('exam-schedules.json') || [];
    const studentId = req.params.studentId;
    
    const studentRegs = registrations.filter(r => r.student == studentId).map(r => {
        const schedule = schedules.find(s => s.id == r.exam);
        return {
            ...r,
            examName: r.examName || (schedule ? schedule.exam : 'Unknown'),
            examDate: schedule ? schedule.date : '',
            examTime: schedule ? schedule.time : ''
        };
    });
    
    res.json({ success: true, registrations: studentRegs });
});

app.put('/api/exam-registrations/:id/approve', (req, res) => {
    let registrations = readData('exam-registrations.json') || [];
    const students = readData('students.json') || [];
    const schedules = readData('exam-schedules.json') || [];
    const settings = readData('settings.json') || {};
    
    const registrationId = parseInt(req.params.id);
    const index = registrations.findIndex(r => r.id == registrationId);
    
    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    
    const registration = registrations[index];
    const action = req.body.action || 'approve'; // 'approve' or 'reject'
    
    if (action === 'approve') {
        const student = students.find(s => s.id == registration.student);
        const schedule = schedules.find(s => s.id == registration.exam);
        
        registrations[index].status = 'Approved';
        registrations[index].approvedAt = new Date().toISOString();
        registrations[index].approvedBy = req.body.approvedBy || 'admin';
        
        // Generate 7-digit numeric roll number on approval (e.g., 2024001)
        const year = new Date().getFullYear();
        const existingRollNos = registrations
            .filter(r => r.rollNo && r.status === 'Approved')
            .map(r => parseInt(r.rollNo))
            .filter(n => !isNaN(n) && String(n).startsWith(String(year)));
        const maxRoll = existingRollNos.length > 0 ? Math.max(...existingRollNos) : parseInt(year + '000');
        const newRollNo = maxRoll + 1;
        registrations[index].rollNo = String(newRollNo);
        
        // Generate admit card on approval
        if (student && schedule) {
            const admitCard = {
                id: Date.now(),
                registrationId: registration.id,
                studentId: registration.student,
                examId: registration.exam,
                studentName: student.name,
                studentPhoto: student.photo || '',
                fatherName: student.fatherName || '',
                rollNo: registrations[index].rollNo,
                course: student.course,
                batch: student.batch,
                examName: schedule.exam,
                examDate: schedule.date,
                examTime: schedule.time,
                duration: schedule.duration,
                venue: schedule.venue,
                totalMarks: schedule.totalMarks,
                instituteName: settings.instituteName || 'Genius Computer Education',
                instituteLogo: settings.logo || '/uploads/logo/logo.png',
                instituteAddress: settings.address || '',
                instituteContact: settings.phone || '',
                generatedAt: new Date().toISOString()
            };
            
            const admitCards = readData('admit-cards.json') || [];
            admitCards.push(admitCard);
            writeData('admit-cards.json', admitCards);
        }
        
        writeData('exam-registrations.json', registrations);
        res.json({ success: true, registration: registrations[index], message: 'Registration approved and admit card generated.' });
    } else {
        // Reject
        registrations[index].status = 'Rejected';
        registrations[index].rejectedAt = new Date().toISOString();
        registrations[index].rejectionReason = req.body.reason || '';
        
        writeData('exam-registrations.json', registrations);
        res.json({ success: true, registration: registrations[index], message: 'Registration rejected.' });
    }
});

app.put('/api/exam-registrations/:id', (req, res) => {
    let registrations = readData('exam-registrations.json') || [];
    const registrationId = parseInt(req.params.id);
    const index = registrations.findIndex(r => r.id == registrationId);
    if (index !== -1) {
        const originalRegistration = registrations[index];
        registrations[index] = {
            id: originalRegistration.id,
            registeredAt: originalRegistration.registeredAt,
            ...req.body
        };
        writeData('exam-registrations.json', registrations);
        res.json({ success: true, registration: registrations[index] });
    } else {
        res.status(404).json({ success: false, message: 'Registration not found' });
    }
});

app.delete('/api/exam-registrations/:id', (req, res) => {
    let registrations = readData('exam-registrations.json') || [];
    const registrationId = parseInt(req.params.id);
    registrations = registrations.filter(r => r.id != registrationId);
    writeData('exam-registrations.json', registrations);
    res.json({ success: true });
});

// --- Admit Cards ---
app.get('/api/admit-cards', (req, res) => {
    res.json({ success: true, admitCards: readData('admit-cards.json') || [] });
});

app.get('/api/admit-cards/student/:studentId', (req, res) => {
    const admitCards = readData('admit-cards.json') || [];
    const studentAdmitCards = admitCards.filter(ac => ac.studentId == req.params.studentId);
    res.json({ success: true, admitCards: studentAdmitCards });
});

app.get('/api/admit-cards/:id', (req, res) => {
    const admitCards = readData('admit-cards.json') || [];
    const admitCard = admitCards.find(ac => ac.id == req.params.id);
    if (admitCard) {
        res.json({ success: true, admitCard });
    } else {
        res.status(404).json({ success: false, message: 'Admit card not found' });
    }
});

app.delete('/api/admit-cards/:id', (req, res) => {
    const admitCards = readData('admit-cards.json') || [];
    const admitCardId = parseInt(req.params.id);
    const filtered = admitCards.filter(ac => ac.id != admitCardId);
    writeData('admit-cards.json', filtered);
    res.json({ success: true });
});

// --- Online Exam ---
app.get('/api/online-exams', (req, res) => {
    res.json(readData('online-exams.json') || []);
});

app.get('/api/online-exams/:id', (req, res) => {
    const onlineExams = readData('online-exams.json') || [];
    const examId = parseInt(req.params.id);
    const exam = onlineExams.find(e => e.id == examId);
    if (exam) {
        res.json(exam);
    } else {
        res.status(404).json({ success: false, message: 'Online exam not found' });
    }
});

app.post('/api/online-exams', (req, res) => {
    const onlineExams = readData('online-exams.json') || [];
    // Generate reference number once at exam creation
    const referenceNumber = Date.now().toString().padStart(16, '0').substring(0, 16);
    
    const newOnlineExam = {
        id: Date.now(),
        name: req.body.name,
        course: req.body.course,
        questions: req.body.questions || [],
        totalMarks: req.body.totalMarks,
        passingMarks: req.body.passingMarks,
        duration: req.body.duration,
        status: req.body.status || 'Draft',
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        instructions: req.body.instructions || '',
        shuffleQuestions: req.body.shuffleQuestions || false,
        shuffleOptions: req.body.shuffleOptions || false,
        showResultImmediately: req.body.showResultImmediately !== false,
        maxAttempts: req.body.maxAttempts || 1,
        referenceNumber: referenceNumber,
        security: req.body.security || {
            disableTabSwitch: false,
            disableCopyPaste: false,
            enforceFullscreen: false,
            enableWebcamMonitoring: false,
            enableIPRestriction: false,
            encryptQuestions: false
        },
        createdAt: new Date().toISOString()
    };
    onlineExams.push(newOnlineExam);
    writeData('online-exams.json', onlineExams);
    res.json({ success: true, onlineExam: newOnlineExam });
});

app.put('/api/online-exams/:id', (req, res) => {
    let onlineExams = readData('online-exams.json') || [];
    const examId = parseInt(req.params.id);
    const index = onlineExams.findIndex(e => e.id == examId);
    if (index !== -1) {
        const originalExam = onlineExams[index];
        onlineExams[index] = {
            id: originalExam.id,
            createdAt: originalExam.createdAt,
            security: req.body.security || originalExam.security,
            ...req.body
        };
        writeData('online-exams.json', onlineExams);
        res.json({ success: true, onlineExam: onlineExams[index] });
    } else {
        res.status(404).json({ success: false, message: 'Online exam not found' });
    }
});

app.delete('/api/online-exams/:id', (req, res) => {
    let onlineExams = readData('online-exams.json') || [];
    const examId = parseInt(req.params.id);
    onlineExams = onlineExams.filter(e => e.id != examId);
    writeData('online-exams.json', onlineExams);
    res.json({ success: true });
});

// --- Exam Attempts ---
app.get('/api/exam-attempts', (req, res) => {
    res.json(readData('exam-attempts.json') || []);
});

app.get('/api/exam-attempts/:id', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const attemptId = parseInt(req.params.id);
    const attempt = attempts.find(a => a.id == attemptId);
    if (attempt) {
        res.json(attempt);
    } else {
        res.status(404).json({ success: false, message: 'Attempt not found' });
    }
});

app.post('/api/exam-attempts', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const newAttempt = {
        id: Date.now(),
        examId: req.body.examId,
        examName: req.body.examName,
        course: req.body.course,
        studentId: req.body.studentId,
        answers: req.body.answers,
        score: req.body.score,
        totalMarks: req.body.totalMarks,
        percentage: req.body.percentage,
        passed: req.body.passed,
        referenceNumber: req.body.referenceNumber || null,
        submittedAt: req.body.submittedAt,
        createdAt: new Date().toISOString()
    };
    attempts.push(newAttempt);
    writeData('exam-attempts.json', attempts);
    
    // Also save to exam-grades.json for admin panel display
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.body.studentId);
    const onlineExams = readData('online-exams.json') || [];
    const exam = onlineExams.find(e => e.id == req.body.examId);
    const settings = readData('settings.json') || {};
    
    const examGrades = readData('exam-grades.json') || [];
    const percentage = req.body.percentage;
    let grade = '';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B+';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 50) grade = 'C';
    else if (percentage >= 40) grade = 'D';
    else grade = 'F';
    
    examGrades.push({
        id: Date.now(),
        studentId: req.body.studentId,
        studentName: student ? student.name : 'Student',
        course: req.body.course,
        examName: req.body.examName,
        examId: req.body.examId,
        total: req.body.totalMarks,
        obtained: req.body.score,
        percentage: percentage,
        grade: grade,
        status: req.body.passed ? 'Passed' : 'Failed',
        published: false,
        date: formatDate(new Date()),
        timestamp: new Date().toISOString()
    });
    writeData('exam-grades.json', examGrades);
    
    // Generate admit card for online exam
    let admitCard = null;
    if (student && exam) {
        admitCard = {
            id: Date.now() + 1,
            attemptId: newAttempt.id,
            studentId: req.body.studentId,
            examId: req.body.examId,
            studentName: student.name,
            studentPhoto: student.photo || '',
            fatherName: student.fatherName || '',
            rollNo: student.rollNo || '',
            course: student.course,
            batch: student.batch,
            examName: exam.title || req.body.examName,
            examDate: exam.startDate || new Date().toISOString().split('T')[0],
            examTime: exam.startTime || 'N/A',
            duration: exam.duration || 'N/A',
            venue: 'Online',
            totalMarks: exam.totalMarks || req.body.totalMarks,
            instituteName: settings.instituteName || 'Genius Computer Education',
            instituteLogo: settings.logo || '/uploads/logo/logo.png',
            instituteAddress: settings.address || '',
            instituteContact: settings.phone || '',
            generatedAt: new Date().toISOString()
        };
        
        // Save admit card to separate file
        const admitCards = readData('admit-cards.json') || [];
        admitCards.push(admitCard);
        writeData('admit-cards.json', admitCards);
    }
    
    res.json({ success: true, attempt: newAttempt, admitCard });
});

app.put('/api/exam-attempts/:id', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const attemptId = parseInt(req.params.id);
    const index = attempts.findIndex(a => a.id == attemptId);
    
    if (index !== -1) {
        attempts[index] = {
            ...attempts[index],
            ...req.body,
            id: attempts[index].id,
            updatedAt: new Date().toISOString()
        };
        writeData('exam-attempts.json', attempts);
        res.json({ success: true, attempt: attempts[index] });
    } else {
        res.status(404).json({ success: false, message: 'Attempt not found' });
    }
});

app.delete('/api/exam-attempts/:id', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const attemptId = parseInt(req.params.id);
    const index = attempts.findIndex(a => a.id == attemptId);
    
    if (index !== -1) {
        attempts.splice(index, 1);
        writeData('exam-attempts.json', attempts);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Attempt not found' });
    }
});

// --- Exam Grading ---
app.post('/api/grade-question', (req, res) => {
    const gradingFeedback = readData('grading-feedback.json') || [];
    const newFeedback = {
        id: Date.now(),
        attemptId: req.body.attemptId,
        questionId: req.body.questionId,
        studentId: req.body.studentId,
        manualScore: req.body.manualScore,
        maxScore: req.body.maxScore,
        feedback: req.body.feedback || '',
        gradedBy: req.body.gradedBy || 'admin',
        gradedAt: new Date().toISOString()
    };
    gradingFeedback.push(newFeedback);
    writeData('grading-feedback.json', gradingFeedback);
    
    // Update attempt score
    const attempts = readData('exam-attempts.json') || [];
    const attemptIndex = attempts.findIndex(a => a.id == req.body.attemptId);
    if (attemptIndex !== -1) {
        // Recalculate score based on manual grades
        const attemptFeedback = gradingFeedback.filter(f => f.attemptId == req.body.attemptId);
        let newScore = 0;
        attemptFeedback.forEach(f => {
            newScore += f.manualScore || 0;
        });
        attempts[attemptIndex].score = newScore;
        attempts[attemptIndex].percentage = Math.round((newScore / attempts[attemptIndex].totalMarks) * 100);
        attempts[attemptIndex].passed = attempts[attemptIndex].percentage >= 50;
        writeData('exam-attempts.json', attempts);
    }
    
    res.json({ success: true, feedback: newFeedback });
});

app.put('/api/exam-attempts/:id/override', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const attemptId = parseInt(req.params.id);
    const index = attempts.findIndex(a => a.id == attemptId);
    
    if (index !== -1) {
        attempts[index].score = req.body.score;
        attempts[index].percentage = Math.round((req.body.score / attempts[index].totalMarks) * 100);
        attempts[index].passed = attempts[index].percentage >= 50;
        attempts[index].overrideReason = req.body.reason || '';
        attempts[index].overriddenBy = req.body.overriddenBy || 'admin';
        attempts[index].overriddenAt = new Date().toISOString();
        attempts[index].updatedAt = new Date().toISOString();
        writeData('exam-attempts.json', attempts);
        res.json({ success: true, attempt: attempts[index] });
    } else {
        res.status(404).json({ success: false, message: 'Attempt not found' });
    }
});

app.get('/api/exam-attempts/:id/feedback', (req, res) => {
    const gradingFeedback = readData('grading-feedback.json') || [];
    const attemptId = parseInt(req.params.id);
    const feedback = gradingFeedback.filter(f => f.attemptId == attemptId);
    res.json(feedback);
});

// --- Manual Grading Endpoints ---
app.get('/api/grading/pending', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const onlineExams = readData('online-exams.json') || [];
    const gradingFeedback = readData('grading-feedback.json') || [];
    
    // Apply filters
    const examId = req.query.examId;
    const courseId = req.query.courseId;
    const studentId = req.query.studentId;
    const status = req.query.status; // pending, graded, all
    
    let filteredAttempts = attempts;
    
    if (examId) {
        filteredAttempts = filteredAttempts.filter(a => a.examId == examId);
    }
    
    if (courseId) {
        filteredAttempts = filteredAttempts.filter(a => a.course == courseId);
    }
    
    if (studentId) {
        filteredAttempts = filteredAttempts.filter(a => a.studentId == studentId);
    }
    
    // Find attempts with subjective questions
    const pendingGrading = [];
    for (const attempt of filteredAttempts) {
        const exam = onlineExams.find(e => e.id == attempt.examId);
        if (exam && exam.questions) {
            const subjectiveQuestions = exam.questions.filter(q => q.type === 'ShortAnswer' || q.type === 'Essay');
            if (subjectiveQuestions.length > 0) {
                // Check grading status
                const attemptFeedback = gradingFeedback.filter(f => f.attemptId == attempt.id);
                const gradedCount = attemptFeedback.length;
                const totalSubjective = subjectiveQuestions.length;
                const isFullyGraded = gradedCount >= totalSubjective;
                
                if (status === 'pending' && !isFullyGraded) {
                    pendingGrading.push({
                        attempt: attempt,
                        exam: exam,
                        subjectiveCount: totalSubjective,
                        gradedCount: gradedCount,
                        gradingStatus: 'pending'
                    });
                } else if (status === 'graded' && isFullyGraded) {
                    pendingGrading.push({
                        attempt: attempt,
                        exam: exam,
                        subjectiveCount: totalSubjective,
                        gradedCount: gradedCount,
                        gradingStatus: 'graded'
                    });
                } else if (!status || status === 'all') {
                    pendingGrading.push({
                        attempt: attempt,
                        exam: exam,
                        subjectiveCount: totalSubjective,
                        gradedCount: gradedCount,
                        gradingStatus: isFullyGraded ? 'graded' : 'pending'
                    });
                }
            }
        }
    }
    
    res.json(pendingGrading);
});

app.get('/api/grading/:attemptId', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const onlineExams = readData('online-exams.json') || [];
    const gradingFeedback = readData('grading-feedback.json') || [];
    const attemptId = parseInt(req.params.attemptId);
    
    const attempt = attempts.find(a => a.id == attemptId);
    if (!attempt) {
        return res.status(404).json({ success: false, message: 'Attempt not found' });
    }
    
    const exam = onlineExams.find(e => e.id == attempt.examId);
    if (!exam) {
        return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    
    const attemptFeedback = gradingFeedback.filter(f => f.attemptId == attemptId);
    
    res.json({
        attempt: attempt,
        exam: exam,
        feedback: attemptFeedback
    });
});

app.put('/api/grading/:id', (req, res) => {
    const gradingFeedback = readData('grading-feedback.json') || [];
    const feedbackId = parseInt(req.params.id);
    const index = gradingFeedback.findIndex(f => f.id == feedbackId);
    
    if (index !== -1) {
        gradingFeedback[index] = {
            ...gradingFeedback[index],
            ...req.body,
            id: gradingFeedback[index].id,
            updatedAt: new Date().toISOString()
        };
        writeData('grading-feedback.json', gradingFeedback);
        res.json({ success: true, feedback: gradingFeedback[index] });
    } else {
        res.status(404).json({ success: false, message: 'Feedback not found' });
    }
});

app.get('/api/grading/history/:studentId', (req, res) => {
    const gradingFeedback = readData('grading-feedback.json') || [];
    const studentId = req.params.studentId;
    
    const history = gradingFeedback.filter(f => f.studentId == studentId);
    res.json(history);
});

// --- Analytics ---
app.get('/api/results/statistics', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const examId = req.query.examId;
    
    let filteredAttempts = attempts;
    if (examId) {
        filteredAttempts = attempts.filter(a => a.examId == examId);
    }
    
    if (filteredAttempts.length === 0) {
        return res.json({
            totalAttempts: 0,
            averageScore: 0,
            passRate: 0,
            highestScore: 0,
            lowestScore: 0
        });
    }
    
    const totalAttempts = filteredAttempts.length;
    const averageScore = filteredAttempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts;
    const passRate = filteredAttempts.filter(a => a.passed).length / totalAttempts * 100;
    const highestScore = Math.max(...filteredAttempts.map(a => a.score));
    const lowestScore = Math.min(...filteredAttempts.map(a => a.score));
    
    res.json({
        totalAttempts,
        averageScore: Math.round(averageScore),
        passRate: Math.round(passRate),
        highestScore,
        lowestScore
    });
});

app.get('/api/results/question-analysis', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const examId = req.query.examId;
    
    let filteredAttempts = attempts;
    if (examId) {
        filteredAttempts = attempts.filter(a => a.examId == examId);
    }
    
    // This would need question data from the exam to do proper analysis
    // For now, return basic attempt statistics
    res.json({
        totalAttempts: filteredAttempts.length,
        averageScore: filteredAttempts.length > 0 ? Math.round(filteredAttempts.reduce((sum, a) => sum + a.score, 0) / filteredAttempts.length) : 0
    });
});

app.get('/api/results/student-performance', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const studentId = req.query.studentId;
    
    if (!studentId) {
        return res.json({ error: 'Student ID required' });
    }
    
    const studentAttempts = attempts.filter(a => a.studentId == studentId);
    
    if (studentAttempts.length === 0) {
        return res.json({
            totalAttempts: 0,
            averageScore: 0,
            passRate: 0,
            attempts: []
        });
    }
    
    const averageScore = studentAttempts.reduce((sum, a) => sum + a.score, 0) / studentAttempts.length;
    const passRate = studentAttempts.filter(a => a.passed).length / studentAttempts.length * 100;
    
    res.json({
        totalAttempts: studentAttempts.length,
        averageScore: Math.round(averageScore),
        passRate: Math.round(passRate),
        attempts: studentAttempts
    });
});

app.get('/api/results/course-performance', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const course = req.query.course;
    
    let filteredAttempts = attempts;
    if (course) {
        filteredAttempts = attempts.filter(a => a.course == course);
    }
    
    if (filteredAttempts.length === 0) {
        return res.json({
            totalAttempts: 0,
            averageScore: 0,
            passRate: 0
        });
    }
    
    const averageScore = filteredAttempts.reduce((sum, a) => sum + a.score, 0) / filteredAttempts.length;
    const passRate = filteredAttempts.filter(a => a.passed).length / filteredAttempts.length * 100;
    
    res.json({
        totalAttempts: filteredAttempts.length,
        averageScore: Math.round(averageScore),
        passRate: Math.round(passRate)
    });
});

// --- Result Publication ---
app.put('/api/exam-attempts/:id/publish', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const attemptId = parseInt(req.params.id);
    const index = attempts.findIndex(a => a.id == attemptId);
    
    if (index !== -1) {
        attempts[index].published = true;
        attempts[index].publishedAt = new Date().toISOString();
        attempts[index].updatedAt = new Date().toISOString();
        writeData('exam-attempts.json', attempts);
        res.json({ success: true, attempt: attempts[index] });
    } else {
        res.status(404).json({ success: false, message: 'Attempt not found' });
    }
});

app.put('/api/exam-attempts/:id/unpublish', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const attemptId = parseInt(req.params.id);
    const index = attempts.findIndex(a => a.id == attemptId);
    
    if (index !== -1) {
        attempts[index].published = false;
        attempts[index].updatedAt = new Date().toISOString();
        writeData('exam-attempts.json', attempts);
        res.json({ success: true, attempt: attempts[index] });
    } else {
        res.status(404).json({ success: false, message: 'Attempt not found' });
    }
});

app.get('/api/results/merit-list/:examId', (req, res) => {
    const attempts = readData('exam-attempts.json') || [];
    const examId = parseInt(req.params.examId);
    
    const examAttempts = attempts
        .filter(a => a.examId == examId && a.published !== false)
        .sort((a, b) => b.score - a.score)
        .map((a, index) => ({
            rank: index + 1,
            studentId: a.studentId,
            score: a.score,
            percentage: a.percentage,
            passed: a.passed
        }));
    
    res.json(examAttempts);
});

// --- Re-evaluation ---
app.get('/api/re-evaluation', (req, res) => {
    const reevalRequests = readData('re-evaluation-requests.json') || [];
    const attempts = readData('exam-attempts.json') || [];
    const onlineExams = readData('online-exams.json') || [];
    const students = readData('students.json') || [];
    
    const enriched = reevalRequests.map(r => {
        const attempt = attempts.find(a => a.id == r.attemptId);
        const exam = attempt ? onlineExams.find(e => e.id == attempt.examId) : null;
        const student = attempt ? students.find(s => s.id == attempt.studentId) : null;
        return {
            ...r,
            studentName: student ? student.name : 'Unknown',
            examName: exam ? (exam.examName || exam.title || exam.name) : 'Unknown',
        };
    });
    res.json(enriched.reverse());
});

app.post('/api/re-evaluation', (req, res) => {
    const reevalRequests = readData('re-evaluation-requests.json') || [];
    const newRequest = {
        id: Date.now(),
        attemptId: req.body.attemptId,
        studentId: req.body.studentId,
        reason: req.body.reason,
        status: 'Pending',
        requestedAt: new Date().toISOString()
    };
    reevalRequests.push(newRequest);
    writeData('re-evaluation-requests.json', reevalRequests);
    res.json({ success: true, request: newRequest });
});

app.get('/api/re-evaluation/:id', (req, res) => {
    const reevalRequests = readData('re-evaluation-requests.json') || [];
    const requestId = parseInt(req.params.id);
    const request = reevalRequests.find(r => r.id == requestId);
    
    if (request) {
        res.json(request);
    } else {
        res.status(404).json({ success: false, message: 'Request not found' });
    }
});

app.put('/api/re-evaluation/:id/approve', (req, res) => {
    const reevalRequests = readData('re-evaluation-requests.json') || [];
    const requestId = parseInt(req.params.id);
    const index = reevalRequests.findIndex(r => r.id == requestId);
    
    if (index !== -1) {
        reevalRequests[index].status = req.body.status || 'Approved';
        reevalRequests[index].approvedBy = req.body.approvedBy || 'admin';
        reevalRequests[index].approvedAt = new Date().toISOString();
        reevalRequests[index].comments = req.body.comments || '';
        writeData('re-evaluation-requests.json', reevalRequests);
        res.json({ success: true, request: reevalRequests[index] });
    } else {
        res.status(404).json({ success: false, message: 'Request not found' });
    }
});

app.get('/api/exam-grades', (req, res) => {
    res.json(readData('exam-grades.json') || []);
});

app.post('/api/exam-grades', (req, res) => {
    const grades = readData('exam-grades.json') || [];
    const newGrade = {
        id: Date.now(),
        student: req.body.student,
        studentId: req.body.studentId,
        exam: req.body.exam,
        examId: req.body.examId,
        obtained: req.body.obtained,
        total: req.body.total,
        percentage: req.body.percentage,
        grade: req.body.grade,
        status: req.body.status || 'Graded',
        gradedAt: new Date().toISOString()
    };
    grades.push(newGrade);
    writeData('exam-grades.json', grades);
    res.json({ success: true, grade: newGrade });
});

app.put('/api/exam-grades/:id', (req, res) => {
    let grades = readData('exam-grades.json') || [];
    const index = grades.findIndex(g => g.id == req.params.id);
    if (index !== -1) {
        grades[index] = { ...grades[index], ...req.body };
        writeData('exam-grades.json', grades);
        res.json({ success: true, grade: grades[index] });
    } else {
        res.status(404).json({ success: false, message: 'Grade not found' });
    }
});

// --- Exam Reports ---
app.get('/api/exam-reports', (req, res) => {
    const grades = readData('exam-grades.json') || [];
    const { course, exam, fromDate, toDate } = req.query;
    let filtered = grades;
    if (course) filtered = filtered.filter(g => g.course === course);
    if (exam) filtered = filtered.filter(g => g.exam === exam);
    if (fromDate) filtered = filtered.filter(g => g.gradedAt >= fromDate);
    if (toDate) filtered = filtered.filter(g => g.gradedAt <= toDate);
    res.json(filtered);
});

// --- Student Exam APIs ---
app.get('/api/exam-schedule/:studentId', (req, res) => {
    const schedules = readData('exam-schedules.json') || [];
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == req.params.studentId);
    
    if (!student) return res.json({ success: true, schedules: [] });
    
    // Filter schedules matching student's course/batch (or 'All')
    const studentSchedules = schedules.filter(s => {
        const courseMatch = !s.course || s.course === 'All' || s.course === student.course;
        const batchMatch = !s.batch || s.batch === 'All' || s.batch === student.batch;
        return courseMatch && batchMatch;
    });
    
    res.json({ success: true, schedules: studentSchedules });
});

app.get('/api/available-exams/:studentId', (req, res) => {
    const onlineExams = readData('online-exams.json') || [];
    const tests = readData('tests.json') || [];
    const examAttempts = readData('exam-attempts.json') || [];
    const studentId = parseInt(req.params.studentId);
    
    const examsWithAttempts = onlineExams.map(exam => {
        // Find attempts for this student in exam-attempts.json (primary source)
        // Match both string and number studentId for compatibility
        const attemptsFromExamAttempts = examAttempts.filter(a => 
            a.examId == exam.id && 
            (parseInt(a.studentId) == studentId || a.studentId == studentId.toString())
        );
        
        // Also check tests.json for backward compatibility
        const test = tests.find(t => t.id == exam.id);
        const attemptsFromTests = test ? (test.attempts || []).filter(a => 
            parseInt(a.studentId) == studentId || a.studentId == studentId.toString()
        ) : [];
        
        // Use the maximum attempt count from both sources
        const attemptCount = Math.max(attemptsFromExamAttempts.length, attemptsFromTests.length);
        const maxAttempts = exam.maxAttempts || 1;
        const canAttempt = attemptCount < maxAttempts;
        
        return {
            ...exam,
            attemptCount,
            maxAttempts,
            canAttempt,
            attemptsRemaining: maxAttempts - attemptCount
        };
    });
    
    res.json({ success: true, exams: examsWithAttempts });
});

app.get('/api/exam-history/:studentId', (req, res) => {
    const grades = readData('exam-grades.json') || [];
    const studentGrades = grades.filter(g => g.studentId == req.params.studentId);
    res.json({ success: true, history: studentGrades });
});

// API to get published exam results for a student
app.get('/api/exam-results/:studentId', (req, res) => {
    const examResults = readData('exam-results.json') || [];
    const studentResults = examResults.filter(r => r.studentId == req.params.studentId);
    res.json({ success: true, results: studentResults });
});

// API to publish exam result
app.post('/api/exam-grades/publish', async (req, res) => {
    const { gradeId, sendEmail } = req.body;
    if (!gradeId) return res.status(400).json({ success: false, message: 'Grade ID required' });
    
    const grades = readData('exam-grades.json') || [];
    const gradeIndex = grades.findIndex(g => g.id == gradeId);
    
    if (gradeIndex === -1) {
        return res.status(404).json({ success: false, message: 'Grade not found' });
    }
    
    const grade = grades[gradeIndex];
    
    grades[gradeIndex].published = true;
    grades[gradeIndex].publishedAt = new Date().toISOString();
    grades[gradeIndex].scheduledPublishAt = null;
    
    // Calculate and save rank
    const rank = calculateExamRank(grades[gradeIndex]);
    grades[gradeIndex].rank = rank;
    writeData('exam-grades.json', grades);
    
    const examResults = readData('exam-results.json') || [];
    const result = {
        id: Date.now(),
        studentId: grade.studentId,
        studentName: grade.studentName,
        course: grade.course,
        examName: grade.examName,
        totalMarks: grade.total,
        obtainedMarks: grade.obtained,
        percentage: grade.percentage,
        grade: grade.grade,
        date: grade.date,
        timestamp: grade.timestamp,
        publishedAt: new Date().toISOString()
    };
    examResults.push(result);
    writeData('exam-results.json', examResults);
    
    let emailResult = { sent: false };
    if (sendEmail) {
        try { emailResult = await sendExamResultEmail(grades[gradeIndex]); }
        catch (e) { emailResult = { sent: false, reason: e.message }; }
    }
    
    res.json({ success: true, grade: grades[gradeIndex], email: emailResult });
});

// API to unpublish an exam result
app.post('/api/exam-grades/unpublish', (req, res) => {
    const { gradeId } = req.body;
    if (!gradeId) return res.status(400).json({ success: false, message: 'Grade ID required' });
    
    const grades = readData('exam-grades.json') || [];
    const gradeIndex = grades.findIndex(g => g.id == gradeId);
    if (gradeIndex === -1) return res.status(404).json({ success: false, message: 'Grade not found' });
    
    const grade = grades[gradeIndex];
    grades[gradeIndex].published = false;
    grades[gradeIndex].publishedAt = null;
    writeData('exam-grades.json', grades);
    
    let examResults = readData('exam-results.json') || [];
    const before = examResults.length;
    examResults = examResults.filter(r => !(
        r.studentId == grade.studentId &&
        r.examName === grade.examName &&
        (r.timestamp === grade.timestamp || r.date === grade.date)
    ));
    if (examResults.length !== before) writeData('exam-results.json', examResults);
    
    res.json({ success: true });
});

// API to publish multiple selected results (bulk) with optional email
app.post('/api/exam-grades/publish-selected', async (req, res) => {
    const { gradeIds, sendEmail } = req.body;
    if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
        return res.status(400).json({ success: false, message: 'gradeIds array required' });
    }
    
    const grades = readData('exam-grades.json') || [];
    const examResults = readData('exam-results.json') || [];
    const now = new Date().toISOString();
    let publishedCount = 0, emailsSent = 0, emailsFailed = 0;
    const emailPromises = [];
    
    for (const gid of gradeIds) {
        const idx = grades.findIndex(g => g.id == gid);
        if (idx === -1 || grades[idx].published) continue;
        grades[idx].published = true;
        grades[idx].publishedAt = now;
        grades[idx].scheduledPublishAt = null;
        
        examResults.push({
            id: Date.now() + publishedCount,
            studentId: grades[idx].studentId,
            studentName: grades[idx].studentName,
            course: grades[idx].course,
            examName: grades[idx].examName,
            totalMarks: grades[idx].total,
            obtainedMarks: grades[idx].obtained,
            percentage: grades[idx].percentage,
            grade: grades[idx].grade,
            date: grades[idx].date,
            timestamp: grades[idx].timestamp,
            publishedAt: now
        });
        publishedCount++;
        
        if (sendEmail) {
            emailPromises.push(
                sendExamResultEmail(grades[idx])
                    .then(r => { if (r.sent) emailsSent++; else emailsFailed++; })
                    .catch(() => { emailsFailed++; })
            );
        }
    }
    
    writeData('exam-grades.json', grades);
    writeData('exam-results.json', examResults);
    
    if (emailPromises.length) await Promise.all(emailPromises);
    
    res.json({ success: true, publishedCount, emailsSent, emailsFailed });
});

// API to unpublish multiple selected results
app.post('/api/exam-grades/unpublish-selected', (req, res) => {
    const { gradeIds } = req.body;
    if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
        return res.status(400).json({ success: false, message: 'gradeIds array required' });
    }
    
    const grades = readData('exam-grades.json') || [];
    let examResults = readData('exam-results.json') || [];
    let unpublishedCount = 0;
    const idSet = new Set(gradeIds.map(String));
    const unpublishedGrades = [];
    
    grades.forEach(g => {
        if (idSet.has(String(g.id)) && g.published) {
            g.published = false;
            g.publishedAt = null;
            unpublishedCount++;
            unpublishedGrades.push(g);
        }
    });
    
    examResults = examResults.filter(r => !unpublishedGrades.some(g =>
        r.studentId == g.studentId && r.examName === g.examName &&
        (r.timestamp === g.timestamp || r.date === g.date)
    ));
    
    writeData('exam-grades.json', grades);
    writeData('exam-results.json', examResults);
    
    res.json({ success: true, unpublishedCount });
});

// API to schedule publish for selected results
app.post('/api/exam-grades/schedule', (req, res) => {
    const { gradeIds, scheduledAt, sendEmail } = req.body;
    if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
        return res.status(400).json({ success: false, message: 'gradeIds array required' });
    }
    if (!scheduledAt) return res.status(400).json({ success: false, message: 'scheduledAt required' });
    const scheduleDate = new Date(scheduledAt);
    if (isNaN(scheduleDate.getTime())) return res.status(400).json({ success: false, message: 'Invalid date' });
    
    const grades = readData('exam-grades.json') || [];
    const idSet = new Set(gradeIds.map(String));
    let scheduledCount = 0;
    
    grades.forEach(g => {
        if (idSet.has(String(g.id)) && !g.published) {
            g.scheduledPublishAt = scheduleDate.toISOString();
            g.scheduledWithEmail = !!sendEmail;
            scheduledCount++;
        }
    });
    
    writeData('exam-grades.json', grades);
    res.json({ success: true, scheduledCount, scheduledAt: scheduleDate.toISOString() });
});

// API to cancel scheduled publish
app.post('/api/exam-grades/cancel-schedule', (req, res) => {
    const { gradeIds } = req.body;
    if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
        return res.status(400).json({ success: false, message: 'gradeIds array required' });
    }
    
    const grades = readData('exam-grades.json') || [];
    const idSet = new Set(gradeIds.map(String));
    let cancelledCount = 0;
    
    grades.forEach(g => {
        if (idSet.has(String(g.id)) && g.scheduledPublishAt) {
            g.scheduledPublishAt = null;
            g.scheduledWithEmail = false;
            cancelledCount++;
        }
    });
    
    writeData('exam-grades.json', grades);
    res.json({ success: true, cancelledCount });
});

// Email helper for exam results
async function sendExamResultEmail(grade) {
    const settings = readData('settings.json') || {};
    const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = getSMTPConfig();
    if (!smtpUser || !smtpPass) return { sent: false, reason: 'SMTP not configured' };
    
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == grade.studentId);
    if (!student || !student.email) return { sent: false, reason: 'Student email not found' };
    
    const instName = settings.name || 'Genius Computer Education';
    const passColor = grade.status === 'Passed' ? '#22c55e' : '#ef4444';
    
    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass }
    });
    
    // Generate PDF attachment for the result
    let pdfAttachment = null;
    try {
        const pdfBuffer = await generateResultPDF(grade, student, settings);
        if (pdfBuffer) {
            const safeName = (grade.studentName || 'student').replace(/[^a-z0-9]/gi, '_');
            const safeExam = (grade.examName || 'exam').replace(/[^a-z0-9]/gi, '_');
            pdfAttachment = {
                filename: `Result_${safeName}_${safeExam}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            };
        }
    } catch (e) {
        console.warn('[PDF] Generation failed:', e.message);
    }
    
    await transporter.sendMail({
        from: `"${instName}" <${settings.smtpUser}>`,
        to: student.email,
        subject: `Your Result: ${grade.examName}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <p>Dear <strong>${grade.studentName}</strong>,</p>
                <p>Your result for <strong>${grade.examName}</strong> has been published.</p>
                <table style="width:100%;border-collapse:collapse;margin:15px 0;">
                    <tr><td style="padding:8px;background:#f1f5f9;width:40%;"><strong>Course</strong></td><td style="padding:8px;">${grade.course}</td></tr>
                    <tr><td style="padding:8px;background:#f1f5f9;"><strong>Total Marks</strong></td><td style="padding:8px;">${grade.total}</td></tr>
                    <tr><td style="padding:8px;background:#f1f5f9;"><strong>Obtained</strong></td><td style="padding:8px;">${grade.obtained}</td></tr>
                    <tr><td style="padding:8px;background:#f1f5f9;"><strong>Percentage</strong></td><td style="padding:8px;">${grade.percentage}%</td></tr>
                    <tr><td style="padding:8px;background:#f1f5f9;"><strong>Grade</strong></td><td style="padding:8px;font-size:18px;font-weight:700;color:${passColor};">${grade.grade}</td></tr>
                    <tr><td style="padding:8px;background:#f1f5f9;"><strong>Status</strong></td><td style="padding:8px;color:${passColor};font-weight:600;">${grade.status}</td></tr>
                </table>
                ${pdfAttachment ? `<p style="background:#ecfdf5;border-left:4px solid #22c55e;padding:10px;"><strong>📎 Official Result Marksheet attached as PDF.</strong></p>` : ''}
                <p>Login to your student portal to view detailed result.</p>
                <p style="margin-top:30px;color:#64748b;font-size:12px;">Regards,<br>${instName}</p>
            </div>
        `,
        attachments: pdfAttachment ? [pdfAttachment] : []
    });
    
    return { sent: true, pdfAttached: !!pdfAttachment };
}

// Calculate rank for a grade within its exam
function calculateExamRank(grade) {
    const allGrades = readData('exam-grades.json') || [];
    const examGrades = allGrades.filter(g => g.examId === grade.examId && g.published);
    examGrades.sort((a, b) => b.percentage - a.percentage);
    const rank = examGrades.findIndex(g => g.id == grade.id) + 1;
    return rank || examGrades.length + 1;
}

// Build marksheet HTML used for both PDF and admin preview
function buildResultMarksheetHTML(grade, student, settings, options) {  // options: { rank, qrCode, isCertificate, signatureImage }
    settings = settings || readData('settings.json') || {};
    const instName = settings.name || 'Genius Computer Education';
    const addr = settings.address || '';
    const phone = settings.phone || '';
    const emailAddr = settings.email || settings.smtpUser || '';
    const passColor = grade.status === 'Passed' ? '#16a34a' : '#dc2626';
    
    // Inline logo as base64 data URL for self-contained PDF
    let logoTag = '';
    if (settings.logo) {
        const relPath = settings.logo.startsWith('/') ? settings.logo.slice(1) : settings.logo;
        const tryPaths = [path.join(__dirname, 'public', relPath), path.join(__dirname, relPath)];
        for (const p of tryPaths) {
            if (fs.existsSync(p)) {
                const ext = path.extname(p).slice(1).toLowerCase() || 'png';
                const b64 = fs.readFileSync(p).toString('base64');
                logoTag = `<img src="data:image/${ext};base64,${b64}" style="max-height:75px;max-width:110px;">`;
                break;
            }
        }
    }
    
    const dateStr = grade.date ? formatDate(grade.date) : '';
    const issuedStr = formatDate(new Date());
    
    // Options handling
    options = options || {};
    const rank = options.rank || calculateExamRank(grade);
    const qrCode = options.qrCode || '';
    const isCertificate = options.isCertificate || false;
    const signatureImage = options.signatureImage || settings.signature;
    
    // Inline signature as base64
    let signatureTag = '';
    if (signatureImage) {
        const sigPath = signatureImage.startsWith('/') ? signatureImage.slice(1) : signatureImage;
        const trySigPaths = [path.join(__dirname, 'public', sigPath), path.join(__dirname, sigPath)];
        for (const p of trySigPaths) {
            if (fs.existsSync(p)) {
                const ext = path.extname(p).slice(1).toLowerCase() || 'png';
                const b64 = fs.readFileSync(p).toString('base64');
                signatureTag = `<img src="data:image/${ext};base64,${b64}" style="max-height:45px;max-width:120px;">`;
                break;
            }
        }
    }
    
    const title = isCertificate ? 'CERTIFICATE OF ACHIEVEMENT' : 'OFFICIAL MARKSHEET / RESULT';
    
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Result - ${grade.studentName} - ${grade.examName}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; color: #1e293b; background: #fff; padding: 0; }
    .page { max-width: 780px; margin: 0 auto; padding: 30px; border: 8px double #1e40af; position: relative; background: #fff; }
    .watermark { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 0; opacity: 0.08; pointer-events: none; }
    .watermark img { max-width: 350px; max-height: 350px; }
    .content { position: relative; z-index: 1; }
    .header { text-align: center; padding-bottom: 15px; border-bottom: 2px solid #1e40af; margin-bottom: 20px; display: flex; align-items: center; gap: 20px; }
    .logo { flex: 0 0 auto; }
    .inst-info { flex: 1; text-align: center; }
    .inst-info h1 { color: #1e40af; font-size: 28px; margin-bottom: 5px; letter-spacing: 1px; }
    .inst-info p { color: #475569; font-size: 12px; margin: 2px 0; }
    .title-bar { background: linear-gradient(135deg, #1e40af, #3b82f6); color: #fff; text-align: center; padding: 12px; margin: 15px 0 25px; letter-spacing: 3px; font-size: 20px; font-weight: 700; }
    .student-section { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 25px; margin-bottom: 20px; padding: 15px 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    .info-item { font-size: 13px; }
    .info-item strong { color: #475569; display: inline-block; min-width: 110px; }
    .info-item span { color: #0f172a; font-weight: 600; }
    table.marks-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .marks-table th { background: #1e40af; color: #fff; padding: 10px; text-align: left; font-size: 13px; }
    .marks-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .marks-table tr:nth-child(even) td { background: #f8fafc; }
    .result-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .summary-card { text-align: center; padding: 15px 10px; border: 2px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
    .summary-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 600; }
    .summary-card .value { font-size: 22px; font-weight: 700; color: #1e40af; }
    .grade-card { border-color: ${passColor}; background: ${grade.status === 'Passed' ? '#f0fdf4' : '#fef2f2'}; }
    .grade-card .value { color: ${passColor}; font-size: 28px; }
    .status-badge { display: inline-block; padding: 8px 30px; border-radius: 30px; font-weight: 700; font-size: 16px; letter-spacing: 2px; color: #fff; background: ${passColor}; margin: 10px 0; }
    .footer { margin-top: 35px; padding-top: 20px; border-top: 2px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; }
    .sig-block { text-align: center; font-size: 12px; color: #475569; }
    .sig-line { width: 160px; border-top: 1px solid #1e293b; padding-top: 4px; margin-bottom: 3px; }
    .sig-img { min-height: 45px; display: flex; align-items: center; justify-content: center; margin-bottom: 3px; }
    .note { text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8; font-style: italic; }
    .qr-code { text-align: right; margin-top: 10px; }
    .qr-code img { max-width: 80px; max-height: 80px; }
    .rank-card { border-color: #f59e0b; background: #fffbeb; }
    .rank-card .value { color: #f59e0b; }
    /* Certificate template styles */
    .cert-page { border: 12px double #1e40af; padding: 40px; background: linear-gradient(to bottom, #fff 0%, #f8fafc 100%); }
    .cert-border { border: 3px solid #1e40af; padding: 20px; height: 100%; }
    .cert-header { text-align: center; margin-bottom: 30px; }
    .cert-title { font-size: 36px; color: #1e40af; letter-spacing: 4px; font-weight: 700; margin: 20px 0; }
    .cert-subtitle { font-size: 18px; color: #64748b; margin-bottom: 30px; }
    .cert-recipient { font-size: 28px; font-weight: 700; color: #0f172a; margin: 20px 0; text-decoration: underline; text-decoration-color: #1e40af; }
    .cert-text { font-size: 16px; line-height: 1.8; color: #334155; margin: 20px 40px; }
    .cert-course { font-size: 20px; font-weight: 700; color: #1e40af; margin: 15px 0; }
    .cert-footer { margin-top: 50px; display: flex; justify-content: space-around; align-items: flex-end; }
    .cert-date { text-align: center; }
    .cert-sig { text-align: center; }
</style></head><body>
<div class="page">
    <div class="watermark">${logoTag}</div>
    <div class="content">
        <div class="header">
            <div class="logo">${logoTag}</div>
            <div class="inst-info">
                <h1>${instName}</h1>
                ${addr ? `<p>${addr}</p>` : ''}
                ${phone || emailAddr ? `<p>${phone ? 'Phone: ' + phone : ''}${phone && emailAddr ? ' | ' : ''}${emailAddr ? 'Email: ' + emailAddr : ''}</p>` : ''}
            </div>
        </div>
        <div class="title-bar">${title}</div>
        ${isCertificate ? `
        <div class="cert-content" style="text-align:center;margin:20px 0;">
            <p class="cert-text">This is to certify that</p>
            <p class="cert-recipient">${grade.studentName}</p>
            <p class="cert-text">has successfully completed the examination</p>
            <p class="cert-course">${grade.examName}</p>
            <p class="cert-text">with a score of <strong>${grade.obtained}/${grade.total}</strong> (${grade.percentage}%)</p>
            <p class="cert-text">and has been awarded the grade <strong>${grade.grade}</strong></p>
            ${rank ? `<p class="cert-text">Securing <strong>Rank #${rank}</strong> among all participants</p>` : ''}
        </div>
        <div class="cert-footer">
            <div class="cert-date">
                <div class="sig-line"></div>
                <div>Date: ${issuedStr}</div>
            </div>
            <div class="cert-sig">
                <div class="sig-img">${signatureTag}</div>
                <div class="sig-line"></div>
                <div>Authorized Signatory</div>
            </div>
        </div>
        ` : `
        <div class="student-section">
            <div class="info-item"><strong>Student Name:</strong> <span>${grade.studentName}</span></div>
            <div class="info-item"><strong>Roll No:</strong> <span>${student && student.rollNo ? student.rollNo : '-'}</span></div>
            <div class="info-item"><strong>Course:</strong> <span>${grade.course}</span></div>
            <div class="info-item"><strong>Batch:</strong> <span>${student && student.batch ? student.batch : '-'}</span></div>
            <div class="info-item"><strong>Exam Name:</strong> <span>${grade.examName}</span></div>
            <div class="info-item"><strong>Exam Date:</strong> <span>${dateStr}</span></div>
            ${rank ? `<div class="info-item"><strong>Rank:</strong> <span style="color:#f59e0b;font-weight:700;">#${rank}</span></div>` : ''}
        </div>
        <table class="marks-table">
            <thead>
                <tr><th style="width:8%;">#</th><th>Subject / Exam</th><th style="width:18%;text-align:center;">Total Marks</th><th style="width:18%;text-align:center;">Obtained</th><th style="width:18%;text-align:center;">Percentage</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td>${grade.examName}</td>
                    <td style="text-align:center;">${grade.total}</td>
                    <td style="text-align:center;font-weight:700;">${grade.obtained}</td>
                    <td style="text-align:center;font-weight:700;">${grade.percentage}%</td>
                </tr>
            </tbody>
        </table>
        <div class="result-summary">
            <div class="summary-card"><div class="label">Total Marks</div><div class="value">${grade.total}</div></div>
            <div class="summary-card"><div class="label">Obtained</div><div class="value">${grade.obtained}</div></div>
            <div class="summary-card"><div class="label">Percentage</div><div class="value">${grade.percentage}%</div></div>
            ${rank ? `<div class="summary-card rank-card"><div class="label">Rank</div><div class="value">#${rank}</div></div>` : '<div class="summary-card grade-card"><div class="label">Grade</div><div class="value">${grade.grade}</div></div>'}
        </div>
        <div style="text-align:center;margin-top:10px;">
            <span class="status-badge">${grade.status === 'Passed' ? '✓ PASSED' : '✗ FAILED'}</span>
        </div>
        <div class="footer">
            <div class="sig-block">
                <div class="sig-line"></div>
                <div>Date: ${issuedStr}</div>
            </div>
            <div class="sig-block">
                <div class="sig-img">${signatureTag}</div>
                <div class="sig-line"></div>
                <div>Authorized Signatory</div>
            </div>
        </div>
        <div class="note">This is a computer-generated marksheet. For verification, contact the institute.${qrCode ? ` Scan QR code to verify online.` : ''}</div>
        ${qrCode ? `<div class="qr-code"><img src="${qrCode}" alt="Verify Online"></div>` : ''}
        `}
    </div>
</div>
</body></html>`;
}

// Generate Result PDF using Puppeteer
let _sharedBrowser = null;
async function getBrowser() {
    if (!_sharedBrowser || !_sharedBrowser.connected) {
        _sharedBrowser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    return _sharedBrowser;
}

async function generateResultPDF(grade, student, settings, options) {
    options = options || {};
    const isCertificate = options.isCertificate || false;
    
    // Generate QR code if not provided
    let qrCode = options.qrCode;
    if (!qrCode && !isCertificate) {
        try {
            const verifyUrl = `${settings.websiteUrl || 'http://localhost:3000'}/verify-result?gradeId=${grade.id}`;
            qrCode = await QRCode.toDataURL(verifyUrl, { width: 100, margin: 1 });
        } catch (e) {
            qrCode = '';
        }
    }
    
    // Calculate rank
    const rank = options.rank || calculateExamRank(grade);
    
    const html = buildResultMarksheetHTML(grade, student, settings, {
        rank,
        qrCode,
        isCertificate,
        signatureImage: options.signatureImage
    });
    
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' }
        });
        return pdfBuffer;
    } finally {
        await page.close();
    }
}

// API to download result PDF (admin/student)
app.get('/api/exam-grades/:gradeId/pdf', async (req, res) => {
    try {
        const grades = readData('exam-grades.json') || [];
        const grade = grades.find(g => g.id == req.params.gradeId);
        if (!grade) return res.status(404).send('Result not found');
        
        const students = readData('students.json') || [];
        const student = students.find(s => s.id == grade.studentId);
        const settings = readData('settings.json') || {};
        
        const isCertificate = req.query.type === 'certificate';
        const pdfBuffer = await generateResultPDF(grade, student, settings, { isCertificate });
        const safeName = (grade.studentName || 'student').replace(/[^a-z0-9]/gi, '_');
        const safeExam = (grade.examName || 'exam').replace(/[^a-z0-9]/gi, '_');
        const filePrefix = isCertificate ? 'Certificate' : 'Result';
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filePrefix}_${safeName}_${safeExam}.pdf"`);
        res.send(pdfBuffer);
    } catch (e) {
        console.error('PDF generation error:', e);
        res.status(500).send('Error generating PDF: ' + e.message);
    }
});

// Mobile-friendly result verification page for QR code scanning
app.get('/verify-result', (req, res) => {
    const gradeId = req.query.gradeId;
    if (!gradeId) {
        return res.status(400).send(`
            <!DOCTYPE html>
            <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Result Verification</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f1f5f9; padding: 20px; text-align: center; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #dc2626; margin-bottom: 10px; }
                p { color: #64748b; }
            </style></head><body>
            <div class="container"><h1>❌ Invalid Link</h1><p>No result ID provided. Please scan the QR code from the original marksheet.</p></div>
            </body></html>
        `);
    }
    
    const grades = readData('exam-grades.json') || [];
    const grade = grades.find(g => g.id == gradeId);
    
    if (!grade) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Result Verification</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f1f5f9; padding: 20px; text-align: center; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #dc2626; margin-bottom: 10px; }
                p { color: #64748b; }
            </style></head><body>
            <div class="container"><h1>❌ Result Not Found</h1><p>The result you are looking for does not exist or may have been removed.</p></div>
            </body></html>
        `);
    }
    
    const settings = readData('settings.json') || {};
    const instName = settings.name || 'Genius Computer Education';
    const passColor = grade.status === 'Passed' ? '#16a34a' : '#dc2626';
    const bgGradient = grade.status === 'Passed' ? 'linear-gradient(135deg, #16a34a, #22c55e)' : 'linear-gradient(135deg, #dc2626, #ef4444)';
    
    res.send(`
        <!DOCTYPE html>
        <html><head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Result Verification - ${grade.studentName}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 15px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
                .header { background: ${bgGradient}; color: white; padding: 30px 20px; text-align: center; }
                .header h1 { font-size: 24px; margin-bottom: 5px; }
                .header p { opacity: 0.9; font-size: 14px; }
                .inst-badge { background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; font-size: 12px; margin-top: 10px; display: inline-block; }
                .content { padding: 25px 20px; }
                .student-card { background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #3b82f6; }
                .student-card h2 { color: #1e293b; font-size: 20px; margin-bottom: 15px; }
                .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
                .info-row:last-child { border-bottom: none; }
                .info-label { color: #64748b; font-size: 13px; }
                .info-value { color: #0f172a; font-weight: 600; font-size: 14px; }
                .result-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; }
                .result-card { background: #f1f5f9; padding: 15px; border-radius: 10px; text-align: center; }
                .result-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
                .result-card .value { font-size: 24px; font-weight: 700; color: #1e293b; }
                .result-card.passed .value { color: #16a34a; }
                .result-card.failed .value { color: #dc2626; }
                .status-badge { display: inline-block; padding: 12px 30px; border-radius: 30px; font-weight: 700; font-size: 16px; color: white; background: ${passColor}; }
                .footer { text-align: center; padding: 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
                .footer p { color: #94a3b8; font-size: 12px; }
                .verified-badge { display: flex; align-items: center; justify-content: center; gap: 8px; color: #16a34a; font-weight: 600; margin-top: 15px; }
                .verified-badge svg { width: 20px; height: 20px; }
            </style>
        </head><body>
            <div class="container">
                <div class="header">
                    <h1>${grade.status === 'Passed' ? '✓ PASSED' : '✗ FAILED'}</h1>
                    <p>Official Result Verification</p>
                    <div class="inst-badge">${instName}</div>
                </div>
                <div class="content">
                    <div class="student-card">
                        <h2>${grade.studentName}</h2>
                        <div class="info-row">
                            <span class="info-label">Exam</span>
                            <span class="info-value">${grade.examName}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Course</span>
                            <span class="info-value">${grade.course}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Date</span>
                            <span class="info-value">${grade.date ? formatDate(grade.date) : '-'}</span>
                        </div>
                        ${grade.rank ? `
                        <div class="info-row">
                            <span class="info-label">Rank</span>
                            <span class="info-value" style="color:#f59e0b;">#${grade.rank}</span>
                        </div>` : ''}
                    </div>
                    <div class="result-grid">
                        <div class="result-card">
                            <div class="label">Total</div>
                            <div class="value">${grade.total}</div>
                        </div>
                        <div class="result-card ${grade.status === 'Passed' ? 'passed' : 'failed'}">
                            <div class="label">Obtained</div>
                            <div class="value">${grade.obtained}</div>
                        </div>
                        <div class="result-card">
                            <div class="label">Percentage</div>
                            <div class="value">${grade.percentage}%</div>
                        </div>
                        <div class="result-card ${grade.status === 'Passed' ? 'passed' : 'failed'}">
                            <div class="label">Grade</div>
                            <div class="value">${grade.grade}</div>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <span class="status-badge">${grade.status} - ${grade.percentage}%</span>
                        <div class="verified-badge">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Verified by ${instName}
                        </div>
                    </div>
                </div>
                <div class="footer">
                    <p>This is an official result. Scan date: ${formatDate(new Date())}</p>
                    <p>For queries, contact the institute administration.</p>
                </div>
            </div>
        </body></html>
    `);
});

// Scheduled publish checker - runs every minute
function checkScheduledPublishes() {
    try {
        const grades = readData('exam-grades.json') || [];
        const examResults = readData('exam-results.json') || [];
        const now = new Date();
        let changed = false;
        let addedResults = 0;
        const toEmail = [];
        
        grades.forEach(g => {
            if (!g.published && g.scheduledPublishAt && new Date(g.scheduledPublishAt) <= now) {
                g.published = true;
                g.publishedAt = now.toISOString();
                const wasScheduledEmail = g.scheduledWithEmail;
                g.scheduledPublishAt = null;
                g.scheduledWithEmail = false;
                changed = true;
                
                examResults.push({
                    id: Date.now() + addedResults,
                    studentId: g.studentId,
                    studentName: g.studentName,
                    course: g.course,
                    examName: g.examName,
                    totalMarks: g.total,
                    obtainedMarks: g.obtained,
                    percentage: g.percentage,
                    grade: g.grade,
                    date: g.date,
                    timestamp: g.timestamp,
                    publishedAt: now.toISOString()
                });
                addedResults++;
                
                if (wasScheduledEmail) toEmail.push(g);
            }
        });
        
        if (changed) {
            writeData('exam-grades.json', grades);
            writeData('exam-results.json', examResults);
            console.log(`[ScheduledPublish] Published ${addedResults} scheduled result(s)`);
            
            toEmail.forEach(g => {
                sendExamResultEmail(g).catch(e => console.warn('Schedule email failed:', e.message));
            });
        }
    } catch (e) {
        console.error('[ScheduledPublish] Error:', e);
    }
}
setInterval(checkScheduledPublishes, 60 * 1000);
setTimeout(checkScheduledPublishes, 5000);

// API to delete exam grade
app.delete('/api/exam-grades/:gradeId', (req, res) => {
    const gradeId = parseInt(req.params.gradeId);
    
    const grades = readData('exam-grades.json') || [];
    const gradeIndex = grades.findIndex(g => g.id == gradeId);
    
    if (gradeIndex === -1) {
        return res.status(404).json({ success: false, message: 'Grade not found' });
    }
    
    grades.splice(gradeIndex, 1);
    writeData('exam-grades.json', grades);
    
    res.json({ success: true });
});

// API to bulk publish exam results by exam ID
app.post('/api/exam-grades/publish-batch', (req, res) => {
    const { examId } = req.body;
    if (!examId) return res.status(400).json({ success: false, message: 'Exam ID required' });
    
    const grades = readData('exam-grades.json') || [];
    const examResults = readData('exam-results.json') || [];
    
    let publishedCount = 0;
    
    grades.forEach(grade => {
        if (grade.examId == examId && !grade.published) {
            grade.published = true;
            
            // Save to exam-results.json
            const result = {
                id: Date.now() + publishedCount,
                studentId: grade.studentId,
                studentName: grade.studentName,
                course: grade.course,
                examName: grade.examName,
                totalMarks: grade.total,
                obtainedMarks: grade.obtained,
                percentage: grade.percentage,
                grade: grade.grade,
                date: grade.date,
                timestamp: grade.timestamp,
                publishedAt: new Date().toISOString()
            };
            examResults.push(result);
            publishedCount++;
        }
    });
    
    writeData('exam-grades.json', grades);
    writeData('exam-results.json', examResults);
    
    res.json({ success: true, publishedCount });
});

app.get('/api/admit-cards/:studentId', (req, res) => {
    const registrations = readData('exam-registrations.json') || [];
    const schedules = readData('exam-schedules.json') || [];
    const studentRegistrations = registrations.filter(r => r.studentId == req.params.id && r.status === 'Registered');
    const admitCards = studentRegistrations.map(r => {
        const schedule = schedules.find(s => s.id == r.examId);
        return {
            id: r.id,
            examName: r.exam,
            examDate: schedule ? schedule.date : '',
            rollNo: r.rollNo,
            venue: schedule ? schedule.venue : '',
            time: schedule ? schedule.time : '',
            course: r.course
        };
    });
    res.json({ success: true, admitCards });
});

// Question Papers — returns list of exams the student has attempted
// Each paper includes questions WITHOUT correct answers (unsolved version)
app.get('/api/question-papers/:studentId', (req, res) => {
    const studentId = req.params.studentId;
    const students = readData('students.json') || [];
    const student = students.find(s => s.id == studentId);
    if (!student) {
        return res.json({ success: true, papers: [] });
    }
    
    const attempts = readData('exam-attempts.json') || [];
    const onlineExams = readData('online-exams.json') || [];
    
    // Get unique attempted exam IDs for this student
    const studentAttempts = attempts.filter(a => a.studentId == studentId);
    const uniqueExamIds = [...new Set(studentAttempts.map(a => a.examId))];
    
    const papers = uniqueExamIds.map(examId => {
        const exam = onlineExams.find(e => e.id == examId);
        if (!exam) return null;
        const latestAttempt = studentAttempts
            .filter(a => a.examId == examId)
            .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))[0];
        
        // Strip correctAnswer, gradingCriteria from questions (unsolved paper)
        const unsolvedQuestions = (exam.questions || []).map(q => ({
            id: q.id,
            text: q.text,
            textHindi: q.textHindi || '',
            type: q.type,
            difficulty: q.difficulty,
            marks: q.marks,
            options: q.options || []
        }));
        
        return {
            attemptId: latestAttempt ? latestAttempt.id : null,
            examId: exam.id,
            examName: exam.name,
            course: exam.course,
            totalMarks: exam.totalMarks,
            duration: exam.duration,
            totalQuestions: unsolvedQuestions.length,
            attemptedAt: latestAttempt ? (latestAttempt.submittedAt || latestAttempt.createdAt) : null,
            instructions: exam.instructions || '',
            questions: unsolvedQuestions
        };
    }).filter(Boolean);
    
    // Sort newest first
    papers.sort((a, b) => new Date(b.attemptedAt || 0) - new Date(a.attemptedAt || 0));
    
    res.json({ success: true, papers });
});

// --- Google Auth Routes ---
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    app.get('/auth/google', passport.authenticate('google-student', { scope: ['profile', 'email'] }));

    app.get('/auth/google/faculty', passport.authenticate('google-faculty', { scope: ['profile', 'email'] }));

    app.get('/auth/google/callback', passport.authenticate('google-student', { failureRedirect: '/student-portal.html?error=google_auth_failed' }), (req, res) => {
        // Check if the Google email is registered in students.json
        const students = readData('students.json') || [];
        const student = students.find(s => s.email === req.user.email);
        
        if (!student) {
            return res.redirect('/student-portal.html?error=email_not_registered');
        }
        
        res.redirect('/student-portal.html?google_auth=success');
    });

    app.get('/auth/google/faculty/callback', passport.authenticate('google-faculty', { failureRedirect: '/faculty-portal.html?error=google_auth_failed' }), (req, res) => {
        const facultyData = { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, subject: req.user.subject };
        res.redirect(`/faculty-portal.html?auth=success&data=${encodeURIComponent(JSON.stringify(facultyData))}`);
    });
} else {
    app.get('/auth/google', (req, res) => res.redirect('/student-portal.html?error=google_auth_not_configured'));
    app.get('/auth/google/faculty', (req, res) => res.redirect('/faculty-portal.html?error=google_auth_not_configured'));
    app.get('/auth/google/callback', (req, res) => res.redirect('/student-portal.html?error=google_auth_not_configured'));
    app.get('/auth/google/faculty/callback', (req, res) => res.redirect('/faculty-portal.html?error=google_auth_not_configured'));
}

app.get('/api/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ success: true, user: req.user });
    } else {
        res.json({ success: false, message: 'Not authenticated' });
    }
});

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/student-portal.html');
    });
});

// --- About ---
app.get('/api/about', (req, res) => {
    res.json(readData('about.json') || {});
});

app.put('/api/about', (req, res) => {
    const about = { ...readData('about.json'), ...req.body };
    writeData('about.json', about);
    res.json({ success: true });
});

// --- Settings ---
app.get('/api/settings', (req, res) => {
    const settings = readData('settings.json') || {};
    // If not admin, hide sensitive fields
    if (!req.session || !req.session.isAdmin) {
        const { adminEmail, smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure, ...publicSettings } = settings;
        return res.json(publicSettings);
    }
    res.json(settings);
});

app.put('/api/settings', (req, res) => {
    const current = readData('settings.json');
    const updated = { ...current, ...req.body };
    writeData('settings.json', updated);
    res.json({ success: true });
});

// --- Logo Upload ---
app.post('/api/logo', uploadLogo.single('logo'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No logo uploaded' });
    const settings = readData('settings.json');
    // Delete old logo
    if (settings.logo) {
        const oldPath = path.join(__dirname, settings.logo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    settings.logo = '/uploads/logo/' + req.file.filename;
    writeData('settings.json', settings);
    res.json({ success: true, logo: settings.logo });
});

app.delete('/api/logo', (req, res) => {
    const settings = readData('settings.json');
    if (settings.logo) {
        const logoPath = path.join(__dirname, settings.logo);
        if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
    }
    settings.logo = '';
    writeData('settings.json', settings);
    res.json({ success: true });
});

// --- Signature Upload ---
app.post('/api/signature', uploadSignature.single('signature'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No signature uploaded' });
    const settings = readData('settings.json');
    // Delete old signature
    if (settings.signature) {
        const oldPath = path.join(__dirname, settings.signature);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    settings.signature = '/uploads/logo/' + req.file.filename;
    writeData('settings.json', settings);
    res.json({ success: true, signature: settings.signature });
});

app.delete('/api/signature', (req, res) => {
    const settings = readData('settings.json');
    if (settings.signature) {
        const sigPath = path.join(__dirname, settings.signature);
        if (fs.existsSync(sigPath)) fs.unlinkSync(sigPath);
    }
    settings.signature = '';
    writeData('settings.json', settings);
    res.json({ success: true });
});

// --- Favicon Upload ---
app.post('/api/favicon', uploadFavicon.single('favicon'), (req, res) => {
    console.log('Favicon upload request received');
    if (!req.file) {
        console.log('No file uploaded');
        return res.status(400).json({ success: false, message: 'No favicon uploaded' });
    }
    console.log('File received:', req.file);
    const settings = readData('settings.json') || {};
    // Delete old favicon
    if (settings.favicon) {
        const oldPath = path.join(__dirname, settings.favicon);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    settings.favicon = '/uploads/logo/' + req.file.filename;
    writeData('settings.json', settings);
    console.log('Favicon saved:', settings.favicon);
    res.json({ success: true, favicon: settings.favicon });
});

app.get('/favicon.ico', (req, res) => {
    const settings = readData('settings.json') || {};
    if (settings.favicon) {
        const faviconPath = path.join(__dirname, settings.favicon);
        if (fs.existsSync(faviconPath)) {
            return res.sendFile(faviconPath);
        }
    }
    // Return 204 No Content if no favicon is set
    res.status(204).end();
});

// --- Popup Image Upload ---
app.post('/api/popup-image', uploadPopupImage.single('popupImage'), (req, res) => {
    console.log('Popup image upload request received');
    console.log('Req file:', req.file);
    console.log('Req body:', req.body);
    if (!req.file) {
        console.log('No file uploaded');
        return res.status(400).json({ success: false, message: 'No popup image uploaded' });
    }
    console.log('File received:', req.file);
    const settings = readData('settings.json') || {};
    // Initialize popup object if it doesn't exist
    if (!settings.popup) {
        settings.popup = {};
    }
    // Delete old popup image
    if (settings.popup.image) {
        const oldPath = path.join(__dirname, settings.popup.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    settings.popup.image = '/uploads/logo/' + req.file.filename;
    writeData('settings.json', settings);
    console.log('Popup image saved:', settings.popup.image);
    res.json({ success: true, image: settings.popup.image });
});

// Error handling middleware for multer
app.use((err, req, res, next) => {
    console.error('Error middleware:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large. Max size is 5MB' });
        }
        return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
});

app.delete('/api/popup-image', (req, res) => {
    const settings = readData('settings.json') || {};
    if (settings.popup && settings.popup.image) {
        const imagePath = path.join(__dirname, settings.popup.image);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        if (settings.popup) {
            settings.popup.image = '';
        }
        writeData('settings.json', settings);
    }
    res.json({ success: true });
});

app.delete('/api/favicon', (req, res) => {
    const settings = readData('settings.json');
    if (settings.favicon) {
        const favPath = path.join(__dirname, settings.favicon);
        if (fs.existsSync(favPath)) fs.unlinkSync(favPath);
    }
    settings.favicon = '';
    writeData('settings.json', settings);
    res.json({ success: true });
});

// Multer error handling
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large!' });
        }
        return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
});

// --- QR Code Generator ---
app.get('/api/qr', async (req, res) => {
    const { text, size = 120 } = req.query;
    if (!text) return res.status(400).json({ success: false, message: 'Text required' });
    try {
        const dataUrl = await QRCode.toDataURL(text, { width: parseInt(size), margin: 1, color: { dark: '#1e40af', light: '#ffffff' } });
        res.json({ success: true, dataUrl });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// --- Manual Testimonials API ---
app.get('/api/testimonials', (req, res) => {
    try {
        const testimonials = readData('testimonials.json') || [];
        res.json({ success: true, testimonials });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch testimonials' });
    }
});

app.post('/api/testimonials', (req, res) => {
    try {
        const { name, rating, comment, position, image, studentId, alumniId } = req.body;
        
        if (!name || !rating || !comment) {
            return res.status(400).json({ success: false, message: 'Name, rating, and comment are required' });
        }

        const testimonials = readData('testimonials.json') || [];
        
        // If studentId is provided, get student photo
        let photo = image || '';
        if (studentId) {
            const students = readData('students.json') || [];
            const student = students.find(s => s.id == studentId);
            if (student && student.photo) {
                photo = student.photo;
            }
        }
        
        // If alumniId is provided, get alumni photo
        if (alumniId) {
            const alumni = readData('data/alumni.json') || [];
            const alumnus = alumni.find(a => a.id == alumniId);
            if (alumnus && alumnus.photo) {
                photo = alumnus.photo;
            }
        }

        const newTestimonial = {
            id: Date.now(),
            name,
            rating: parseInt(rating),
            comment,
            position: position || '',
            image: photo,
            studentId: studentId || '',
            alumniId: alumniId || '',
            date: new Date().toISOString()
        };

        testimonials.push(newTestimonial);
        writeData('testimonials.json', testimonials);
        
        res.json({ success: true, testimonial: newTestimonial });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add testimonial' });
    }
});

app.delete('/api/testimonials/:id', (req, res) => {
    try {
        const { id } = req.params;
        const testimonials = readData('testimonials.json') || [];
        const filtered = testimonials.filter(t => t.id != id);
        
        if (testimonials.length === filtered.length) {
            return res.status(404).json({ success: false, message: 'Testimonial not found' });
        }

        writeData('testimonials.json', filtered);
        res.json({ success: true, message: 'Testimonial deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete testimonial' });
    }
});

app.put('/api/testimonials/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, rating, comment, position, image, studentId, alumniId } = req.body;
        
        if (!name || !rating || !comment) {
            return res.status(400).json({ success: false, message: 'Name, rating, and comment are required' });
        }

        const testimonials = readData('testimonials.json') || [];
        const index = testimonials.findIndex(t => t.id == id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Testimonial not found' });
        }

        // If studentId is provided, get student photo
        let photo = image || testimonials[index].image;
        if (studentId) {
            const students = readData('students.json') || [];
            const student = students.find(s => s.id == studentId);
            if (student && student.photo) {
                photo = student.photo;
            }
        }
        
        // If alumniId is provided, get alumni photo
        if (alumniId) {
            const alumni = readData('data/alumni.json') || [];
            const alumnus = alumni.find(a => a.id == alumniId);
            if (alumnus && alumnus.photo) {
                photo = alumnus.photo;
            }
        }

        testimonials[index] = {
            ...testimonials[index],
            name,
            rating: parseInt(rating),
            comment,
            position: position || '',
            image: photo,
            studentId: studentId || '',
            alumniId: alumniId || ''
        };

        writeData('testimonials.json', testimonials);
        res.json({ success: true, testimonial: testimonials[index] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update testimonial' });
    }
});

// --- Carousel API ---
app.get('/api/carousel', (req, res) => {
    try {
        const carousel = readData('carousel.json') || [];
        res.json({ success: true, carousel });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch carousel' });
    }
});

app.post('/api/carousel', uploadCarousel.single('image'), (req, res) => {
    try {
        const { caption } = req.body;
        
        if (!caption) {
            return res.status(400).json({ success: false, message: 'Caption is required' });
        }

        const carousel = readData('carousel.json') || [];
        
        const image = req.file ? `/uploads/carousel/${req.file.filename}` : '';
        
        const newSlide = {
            id: Date.now(),
            caption,
            image
        };

        carousel.push(newSlide);
        writeData('carousel.json', carousel);
        res.json({ success: true, slide: newSlide });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add carousel slide' });
    }
});

app.put('/api/carousel/:id', uploadCarousel.single('image'), (req, res) => {
    try {
        const { id } = req.params;
        const { caption } = req.body;
        
        if (!caption) {
            return res.status(400).json({ success: false, message: 'Caption is required' });
        }

        const carousel = readData('carousel.json') || [];
        const index = carousel.findIndex(s => s.id == id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Carousel slide not found' });
        }

        const image = req.file ? `/uploads/carousel/${req.file.filename}` : carousel[index].image;
        
        carousel[index] = {
            ...carousel[index],
            caption,
            image
        };

        writeData('carousel.json', carousel);
        res.json({ success: true, slide: carousel[index] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update carousel slide' });
    }
});

app.delete('/api/carousel/:id', (req, res) => {
    try {
        const { id } = req.params;
        const carousel = readData('carousel.json') || [];
        const filtered = carousel.filter(s => s.id != id);
        
        if (carousel.length === filtered.length) {
            return res.status(404).json({ success: false, message: 'Carousel slide not found' });
        }

        writeData('carousel.json', filtered);
        res.json({ success: true, message: 'Carousel slide deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete carousel slide' });
    }
});

// --- Hero Text API ---
app.get('/api/hero-text', (req, res) => {
    try {
        const heroText = readData('hero-text.json') || {
            heading: 'Welcome to Genius Computer Education',
            subheading: 'Apna future banayein digital skills ke saath',
            headingSize: 3,
            subheadingSize: 1.3,
            animation: 'none',
            button1Text: 'View Courses',
            button2Text: 'Apply Online',
            headingMobile: 'Welcome to Genius Computer Education',
            subheadingMobile: 'Apna future banayein digital skills ke saath',
            headingSizeMobile: 1.2,
            subheadingSizeMobile: 1,
            button1TextMobile: 'View Courses',
            button2TextMobile: 'Apply Online'
        };
        res.json({ success: true, heroText });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch hero text' });
    }
});

app.post('/api/hero-text', (req, res) => {
    try {
        const { heading, subheading, headingSize, subheadingSize, animation, button1Text, button2Text, headingMobile, subheadingMobile, headingSizeMobile, subheadingSizeMobile, button1TextMobile, button2TextMobile } = req.body;
        
        const heroText = {
            heading: heading || 'Welcome to Genius Computer Education',
            subheading: subheading || 'Apna future banayein digital skills ke saath',
            headingSize: parseFloat(headingSize) || 3,
            subheadingSize: parseFloat(subheadingSize) || 1.3,
            animation: animation || 'none',
            button1Text: button1Text || 'View Courses',
            button2Text: button2Text || 'Apply Online',
            headingMobile: headingMobile || 'Welcome to Genius Computer Education',
            subheadingMobile: subheadingMobile || 'Apna future banayein digital skills ke saath',
            headingSizeMobile: parseFloat(headingSizeMobile) || 1.2,
            subheadingSizeMobile: parseFloat(subheadingSizeMobile) || 1,
            button1TextMobile: button1TextMobile || 'View Courses',
            button2TextMobile: button2TextMobile || 'Apply Online'
        };

        writeData('hero-text.json', heroText);
        res.json({ success: true, heroText });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save hero text' });
    }
});

// --- Social Media API ---
app.get('/api/social-media', (req, res) => {
    try {
        const socialMedia = readData('social-media.json') || {
            facebookUrl: 'https://facebook.com',
            instagramUrl: 'https://instagram.com',
            whatsappUrl: 'https://whatsapp.com',
            youtubeUrl: 'https://youtube.com',
            linkedinUrl: 'https://linkedin.com'
        };
        res.json({ success: true, socialMedia });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch social media' });
    }
});

app.post('/api/social-media', (req, res) => {
    try {
        const { facebookUrl, instagramUrl, whatsappUrl, youtubeUrl, linkedinUrl } = req.body;
        
        const socialMedia = {
            facebookUrl: facebookUrl || 'https://facebook.com',
            instagramUrl: instagramUrl || 'https://instagram.com',
            whatsappUrl: whatsappUrl || 'https://whatsapp.com',
            youtubeUrl: youtubeUrl || 'https://youtube.com',
            linkedinUrl: linkedinUrl || 'https://linkedin.com'
        };

        writeData('social-media.json', socialMedia);
        res.json({ success: true, socialMedia });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save social media' });
    }
});

// --- Section Visibility API ---
app.get('/api/section-visibility', (req, res) => {
    try {
        const sections = readData('section-visibility.json') || {
            carousel: true,
            notices: false,
            courses: true,
            blog: true,
            about: true,
            gallery: true,
            testimonials: true,
            contact: true
        };
        res.json({ success: true, sections });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch sections' });
    }
});

app.post('/api/section-visibility', (req, res) => {
    try {
        const sections = req.body || {};
        writeData('section-visibility.json', sections);
        res.json({ success: true, sections });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save sections' });
    }
});

// --- Section Texts API ---
app.get('/api/section-texts', (req, res) => {
    try {
        const texts = readData('section-texts.json') || {
            notices: 'Notice Board',
            courses: 'Our Courses',
            blog: 'Blog',
            about: 'About Us',
            gallery: 'Our Gallery',
            testimonials: 'Student Reviews',
            contact: 'Contact Us'
        };
        res.json({ success: true, texts });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch texts' });
    }
});

app.post('/api/section-texts', (req, res) => {
    try {
        const texts = req.body || {};
        writeData('section-texts.json', texts);
        res.json({ success: true, texts });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save texts' });
    }
});

// --- Google My Business Reviews API (Deprecated) ---
app.get('/api/gmb-reviews', async (req, res) => {
    res.json({ success: false, message: 'GMB API deprecated. Use manual testimonials instead.' });
});

app.get('/api/gmb-locations', async (req, res) => {
    res.json({ success: false, message: 'GMB API deprecated. Use manual testimonials instead.' });
});

// ==================== ENTRANCE EXAM ENDPOINTS ====================

// --- Entrance Exam Settings (Enable/Disable) ---
app.get('/api/entrance-settings', (req, res) => {
    const settings = readData('entrance-settings.json') || { enabled: false, enabledAt: null, enabledBy: null };
    res.json(settings);
});

app.post('/api/entrance-settings/toggle', (req, res) => {
    const settings = readData('entrance-settings.json') || { enabled: false };
    settings.enabled = !settings.enabled;
    settings.enabledAt = settings.enabled ? new Date().toISOString() : null;
    settings.enabledBy = settings.enabled ? (req.body.adminName || 'admin') : null;
    writeData('entrance-settings.json', settings);
    res.json({ success: true, settings });
});

// --- Entrance Exams CRUD ---
app.get('/api/entrance-exams', (req, res) => {
    res.json(readData('entrance-exams.json') || []);
});

app.get('/api/entrance-exams/:id', (req, res) => {
    const exams = readData('entrance-exams.json') || [];
    const exam = exams.find(e => e.id == req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    res.json(exam);
});

app.post('/api/entrance-exams', (req, res) => {
    const exams = readData('entrance-exams.json') || [];
    const exam = {
        id: Date.now(),
        name: req.body.name || 'Untitled Exam',
        examCode: req.body.examCode || ('ENT-' + Date.now()),
        course: req.body.course || '',
        description: req.body.description || '',
        instructions: req.body.instructions || 'Read all questions carefully. Do not switch tabs during the exam.',
        totalMarks: parseInt(req.body.totalMarks) || 100,
        passingMarks: parseInt(req.body.passingMarks) || 0,
        questionsPerStudent: parseInt(req.body.questionsPerStudent) || 0,
        randomize: !!req.body.randomize,
        shifts: req.body.shifts || [],
        status: req.body.status || 'Draft',
        createdAt: new Date().toISOString()
    };
    exams.push(exam);
    writeData('entrance-exams.json', exams);
    res.json({ success: true, exam });
});

app.put('/api/entrance-exams/:id', (req, res) => {
    const exams = readData('entrance-exams.json') || [];
    const idx = exams.findIndex(e => e.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Exam not found' });
    exams[idx] = { ...exams[idx], ...req.body, id: exams[idx].id };
    writeData('entrance-exams.json', exams);
    res.json({ success: true, exam: exams[idx] });
});

app.delete('/api/entrance-exams/:id', (req, res) => {
    let exams = readData('entrance-exams.json') || [];
    exams = exams.filter(e => e.id != req.params.id);
    writeData('entrance-exams.json', exams);
    res.json({ success: true });
});

// --- Entrance Questions ---
app.get('/api/entrance-questions', (req, res) => {
    const questions = readData('entrance-questions.json') || [];
    if (req.query.examId) {
        return res.json(questions.filter(q => q.examId == req.query.examId));
    }
    res.json(questions);
});

app.post('/api/entrance-questions', (req, res) => {
    // Check permission for faculty
    if (req.user && req.user.role !== 'Super Admin' && req.user.role !== 'Admin') {
        const faculty = readData('faculty.json') || [];
        const user = faculty.find(f => f.id == req.user.id);
        if (!user || !user.canManageEntranceExam) {
            return res.status(403).json({ success: false, message: 'You do not have permission to manage entrance exam' });
        }
    }
    
    const questions = readData('entrance-questions.json') || [];
    const question = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        examId: req.body.examId,
        question: req.body.question,
        questionHindi: req.body.questionHindi || '',
        options: req.body.options || [],
        optionsHindi: req.body.optionsHindi || [],
        correctAnswer: parseInt(req.body.correctAnswer),
        marks: parseInt(req.body.marks) || 1,
        subject: req.body.subject || '',
        difficulty: req.body.difficulty || 'Medium',
        createdAt: new Date().toISOString()
    };
    questions.push(question);
    writeData('entrance-questions.json', questions);
    res.json({ success: true, question });
});

app.put('/api/entrance-questions/:id', (req, res) => {
    // Check permission for faculty
    if (req.user && req.user.role !== 'Super Admin' && req.user.role !== 'Admin') {
        const faculty = readData('faculty.json') || [];
        const user = faculty.find(f => f.id == req.user.id);
        if (!user || !user.canManageEntranceExam) {
            return res.status(403).json({ success: false, message: 'You do not have permission to manage entrance exam' });
        }
    }
    
    const questions = readData('entrance-questions.json') || [];
    const idx = questions.findIndex(q => q.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Question not found' });
    const updateData = { ...req.body };
    if (!updateData.questionHindi) updateData.questionHindi = '';
    if (!updateData.optionsHindi) updateData.optionsHindi = [];
    questions[idx] = { ...questions[idx], ...updateData, id: questions[idx].id };
    writeData('entrance-questions.json', questions);
    res.json({ success: true, question: questions[idx] });
});

app.post('/api/entrance-questions/bulk-delete', (req, res) => {
    // Check permission for faculty
    if (req.user && req.user.role !== 'Super Admin' && req.user.role !== 'Admin') {
        const faculty = readData('faculty.json') || [];
        const user = faculty.find(f => f.id == req.user.id);
        if (!user || !user.canManageEntranceExam) {
            return res.status(403).json({ success: false, message: 'You do not have permission to manage entrance exam' });
        }
    }
    
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'No IDs provided' });
    let questions = readData('entrance-questions.json') || [];
    const before = questions.length;
    const idSet = new Set(ids.map(i => String(i)));
    questions = questions.filter(q => !idSet.has(String(q.id)));
    writeData('entrance-questions.json', questions);
    res.json({ success: true, deleted: before - questions.length });
});

app.delete('/api/entrance-questions/:id', (req, res) => {
    // Check permission for faculty
    if (req.user && req.user.role !== 'Super Admin' && req.user.role !== 'Admin') {
        const faculty = readData('faculty.json') || [];
        const user = faculty.find(f => f.id == req.user.id);
        if (!user || !user.canManageEntranceExam) {
            return res.status(403).json({ success: false, message: 'You do not have permission to manage entrance exam' });
        }
    }
    
    let questions = readData('entrance-questions.json') || [];
    questions = questions.filter(q => q.id != req.params.id);
    writeData('entrance-questions.json', questions);
    res.json({ success: true });
});

// --- Bulk Question Upload (CSV/TSV) ---
app.post('/api/entrance-questions/bulk-upload', uploadBulk.single('file'), (req, res) => {
    // Check permission for faculty
    if (req.user && req.user.role !== 'Super Admin' && req.user.role !== 'Admin') {
        const faculty = readData('faculty.json') || [];
        const user = faculty.find(f => f.id == req.user.id);
        if (!user || !user.canManageEntranceExam) {
            return res.status(403).json({ success: false, message: 'You do not have permission to manage entrance exam' });
        }
    }
    
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
        const examId = req.body.examId;
        if (!examId) return res.status(400).json({ success: false, message: 'examId is required' });

        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();
        const content = fs.readFileSync(filePath, 'utf8');
        const delimiter = ext === '.tsv' ? '\t' : ',';

        // Simple CSV/TSV parser supporting quoted fields with commas
        const parseLine = (line, delim) => {
            const out = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
                    else inQuotes = !inQuotes;
                } else if (ch === delim && !inQuotes) {
                    out.push(cur); cur = '';
                } else { cur += ch; }
            }
            out.push(cur);
            return out.map(s => s.trim());
        };

        const lines = content.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ success: false, message: 'File must contain header row and at least one question' });
        }

        const header = parseLine(lines[0], delimiter).map(h => h.toLowerCase().trim());
        const required = ['question', 'option_a', 'option_b', 'correct_answer'];
        for (const r of required) {
            if (!header.includes(r)) {
                fs.unlinkSync(filePath);
                return res.status(400).json({ success: false, message: `Missing required column: ${r}` });
            }
        }

        const questions = readData('entrance-questions.json') || [];
        const errors = [];
        let added = 0;

        for (let i = 1; i < lines.length; i++) {
            const cols = parseLine(lines[i], delimiter);
            const row = {};
            header.forEach((h, idx) => row[h] = cols[idx] || '');

            // Validation: At least English question must be provided
            if (!row.question || !row.question.trim()) {
                errors.push(`Row ${i + 1}: English question is required`);
                continue;
            }

            // English options
            const options = [row.option_a, row.option_b, row.option_c, row.option_d].filter(o => o);

            // At least 2 English options required
            if (options.length < 2) {
                errors.push(`Row ${i + 1}: At least 2 English options required`);
                continue;
            }

            // Hindi options (optional)
            const optionsHindi = [row.option_a_hindi, row.option_b_hindi, row.option_c_hindi, row.option_d_hindi].filter(o => o);

            // If Hindi question provided, Hindi options must be provided
            if (row.question_hindi && row.question_hindi.trim() && optionsHindi.length < 2) {
                errors.push(`Row ${i + 1}: At least 2 Hindi options required when Hindi question is provided`);
                continue;
            }

            const correctAns = parseInt(row.correct_answer);
            if (isNaN(correctAns) || correctAns < 1 || correctAns > 4) {
                errors.push(`Row ${i + 1}: correct_answer must be 1-4`);
                continue;
            }

            if (correctAns > options.length) {
                errors.push(`Row ${i + 1}: correct_answer ${correctAns} exceeds available options`);
                continue;
            }

            // Create bilingual question
            const questionData = {
                id: Date.now() + Math.floor(Math.random() * 100000) + i,
                examId: parseInt(examId),
                question: row.question || '',
                questionHindi: row.question_hindi || '',
                options: options,
                optionsHindi: optionsHindi,
                correctAnswer: correctAns - 1, // Convert 1-4 to 0-3 internally
                marks: parseInt(row.marks) || 1,
                subject: row.subject || '',
                difficulty: row.difficulty || 'Medium',
                createdAt: new Date().toISOString()
            };
            questions.push(questionData);
            added++;
        }

        writeData('entrance-questions.json', questions);
        try { fs.unlinkSync(filePath); } catch (e) {}

        res.json({ success: true, added, errors, total: lines.length - 1 });
    } catch (err) {
        console.error('Bulk upload error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- Entrance Registrations ---
app.get('/api/entrance-registrations', (req, res) => {
    const regs = readData('entrance-registrations.json') || [];
    if (req.query.examId) {
        return res.json(regs.filter(r => r.examId == req.query.examId));
    }
    res.json(regs);
});

app.post('/api/entrance-registrations', (req, res) => {
    // Check permission for faculty
    if (req.user && req.user.role !== 'Super Admin' && req.user.role !== 'Admin') {
        const faculty = readData('faculty.json') || [];
        const user = faculty.find(f => f.id == req.user.id);
        if (!user || !user.canManageEntranceExam) {
            return res.status(403).json({ success: false, message: 'You do not have permission to manage entrance exam' });
        }
    }
    
    const regs = readData('entrance-registrations.json') || [];
    const exams = readData('entrance-exams.json') || [];
    const exam = exams.find(e => e.id == req.body.examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

    // Use manual registration ID as both registration number and password
    const regNo = req.body.registrationNo;
    if (!regNo) return res.status(400).json({ success: false, message: 'Registration ID is required' });

    // Check for duplicate registration number
    if (regs.find(r => r.registrationNo === regNo)) {
        return res.status(400).json({ success: false, message: 'Registration ID already exists' });
    }

    const reg = {
        id: Date.now(),
        examId: parseInt(req.body.examId),
        shiftId: req.body.shiftId || null,
        registrationNo: regNo,
        loginPassword: regNo, // Same as registration ID
        studentName: req.body.studentName,
        fatherName: req.body.fatherName || '',
        gender: req.body.gender || '',
        phone: req.body.phone || '',
        qualification: req.body.qualification || '',
        course: req.body.course || exam.course,
        photo: req.body.photo || '',
        signature: req.body.signature || '',
        status: req.body.status || 'approved',
        createdAt: new Date().toISOString()
    };
    regs.push(reg);
    writeData('entrance-registrations.json', regs);
    res.json({ success: true, registration: reg });
});

app.put('/api/entrance-registrations/:id', (req, res) => {
    const regs = readData('entrance-registrations.json') || [];
    const idx = regs.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Registration not found' });
    regs[idx] = { ...regs[idx], ...req.body, id: regs[idx].id };
    writeData('entrance-registrations.json', regs);
    res.json({ success: true, registration: regs[idx] });
});

app.delete('/api/entrance-registrations/:id', (req, res) => {
    let regs = readData('entrance-registrations.json') || [];
    regs = regs.filter(r => r.id != req.params.id);
    writeData('entrance-registrations.json', regs);
    res.json({ success: true });
});

// Suspend / Unsuspend a student
app.post('/api/entrance-registrations/:id/toggle-suspend', (req, res) => {
    const regs = readData('entrance-registrations.json') || [];
    const idx = regs.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Registration not found' });
    regs[idx].suspended = !regs[idx].suspended;
    regs[idx].suspendReason = regs[idx].suspended ? (req.body.reason || 'Suspicious activity') : null;
    regs[idx].suspendedAt = regs[idx].suspended ? new Date().toISOString() : null;
    regs[idx].suspendedBy = regs[idx].suspended ? (req.body.adminName || 'admin') : null;
    writeData('entrance-registrations.json', regs);
    res.json({ success: true, registration: regs[idx] });
});

// Bulk shift assignment
app.post('/api/entrance-registrations/assign-shift', (req, res) => {
    const { registrationIds, shiftId } = req.body;
    const regs = readData('entrance-registrations.json') || [];
    let updated = 0;
    regs.forEach(r => {
        if (registrationIds.includes(r.id)) {
            r.shiftId = shiftId;
            updated++;
        }
    });
    writeData('entrance-registrations.json', regs);
    res.json({ success: true, updated });
});

// --- Entrance Student Login ---
app.post('/api/entrance/login', (req, res) => {
    const settings = readData('entrance-settings.json') || { enabled: false };
    if (!settings.enabled) {
        return res.status(403).json({ success: false, message: 'Entrance exam is currently disabled' });
    }

    const { registrationNo, password } = req.body;
    const regs = readData('entrance-registrations.json') || [];
    const reg = regs.find(r => r.registrationNo === registrationNo && r.loginPassword === password);
    if (!reg) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (reg.suspended) return res.status(403).json({ success: false, message: 'Your ID has been suspended. Reason: ' + (reg.suspendReason || 'Suspicious activity') + '. Please contact the admin.' });
    if (reg.status !== 'approved') return res.status(403).json({ success: false, message: 'Registration not approved' });

    res.json({ success: true, registration: reg });
});

// --- Get exam details for student (with shift) ---
app.get('/api/entrance/student-exam/:registrationId', (req, res) => {
    const regs = readData('entrance-registrations.json') || [];
    const reg = regs.find(r => r.id == req.params.registrationId);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    const exams = readData('entrance-exams.json') || [];
    const exam = exams.find(e => e.id == reg.examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

    const shift = (exam.shifts || []).find(s => s.id === reg.shiftId);

    // Don't expose correct answers
    res.json({
        registration: reg,
        exam: { ...exam, shifts: undefined },
        shift: shift || null
    });
});

// --- Start Exam (calculates remaining time based on shift schedule) ---
app.post('/api/entrance/start-exam', (req, res) => {
    const { registrationId, language } = req.body;
    const regs = readData('entrance-registrations.json') || [];
    const reg = regs.find(r => r.id == registrationId);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
    if (reg.suspended) return res.status(403).json({ success: false, message: 'Your ID has been suspended. Reason: ' + (reg.suspendReason || 'Suspicious activity'), suspended: true });

    const exams = readData('entrance-exams.json') || [];
    const exam = exams.find(e => e.id == reg.examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

    const shift = (exam.shifts || []).find(s => s.id === reg.shiftId);
    if (!shift) return res.status(400).json({ success: false, message: 'No shift assigned' });

    const now = new Date();
    const startTime = new Date(shift.scheduledStart);
    const endTime = new Date(shift.scheduledEnd);

    if (now < startTime) {
        return res.status(400).json({
            success: false,
            message: 'Exam has not started yet',
            scheduledStart: shift.scheduledStart
        });
    }
    if (now > endTime) {
        return res.status(400).json({
            success: false,
            message: 'Exam time has ended'
        });
    }

    // Check if already attempted
    const attempts = readData('entrance-attempts.json') || [];
    let attempt = attempts.find(a => a.registrationId == registrationId);

    // Calculate remaining time (synchronized to shift end time)
    const remainingSeconds = Math.floor((endTime - now) / 1000);

    if (!attempt) {
        // Get questions for this exam (bilingual - contains both English and Hindi)
        let questions = (readData('entrance-questions.json') || []).filter(q => q.examId == exam.id);
        
        // Check if questions available
        if (questions.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No questions available for this exam. Please contact admin.' 
            });
        }
        
        // Always shuffle questions per student for fairness
        questions = questions.sort(() => Math.random() - 0.5);
        if (exam.questionsPerStudent && exam.questionsPerStudent > 0 && exam.questionsPerStudent < questions.length) {
            questions = questions.slice(0, exam.questionsPerStudent);
        }

        // Shuffle options per question and store the mapping
        // optionOrder[qid] = [origIdx0, origIdx1, ...] -> position in shuffled array maps to original option index
        const optionOrder = {};
        questions.forEach(q => {
            const indices = (q.options || []).map((_, i) => i);
            // Fisher-Yates shuffle
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            optionOrder[q.id] = indices;
        });

        attempt = {
            id: Date.now(),
            registrationId: parseInt(registrationId),
            examId: exam.id,
            shiftId: shift.id,
            startedAt: now.toISOString(),
            endTime: shift.scheduledEnd, // Server-controlled end time
            questionIds: questions.map(q => q.id),
            optionOrder: optionOrder,
            answers: {},
            submitted: false
        };
        attempts.push(attempt);
        writeData('entrance-attempts.json', attempts);
    } else if (attempt.submitted) {
        return res.status(400).json({ success: false, message: 'You have already submitted this exam' });
    }

    // Get questions with shuffled options (without correct answers)
    const allQuestions = readData('entrance-questions.json') || [];
    const optionOrder = attempt.optionOrder || {};
    const examQuestions = attempt.questionIds.map(qid => {
        const q = allQuestions.find(qq => qq.id === qid);
        if (!q) return null;
        const order = optionOrder[qid] || (q.options || []).map((_, i) => i);
        const shuffledOptions = order.map(origIdx => (q.options || [])[origIdx]);
        const shuffledOptionsHindi = (q.optionsHindi && q.optionsHindi.length) ? order.map(origIdx => (q.optionsHindi || [])[origIdx]) : [];
        return {
            id: q.id,
            question: q.question,
            questionHindi: q.questionHindi || '',
            options: shuffledOptions,
            optionsHindi: shuffledOptionsHindi,
            marks: q.marks
        };
    }).filter(Boolean);

    res.json({
        success: true,
        attempt: {
            id: attempt.id,
            startedAt: attempt.startedAt,
            endTime: attempt.endTime,
            answers: attempt.answers
        },
        exam: { id: exam.id, name: exam.name, totalMarks: exam.totalMarks, instructions: exam.instructions },
        questions: examQuestions,
        remainingSeconds,
        serverTime: now.toISOString()
    });
});

// --- Save Answer (during exam) ---
app.post('/api/entrance/save-answer', (req, res) => {
    const { attemptId, questionId, answer } = req.body;
    const attempts = readData('entrance-attempts.json') || [];
    const idx = attempts.findIndex(a => a.id == attemptId);
    if (idx !== -1) {
        const regs = readData('entrance-registrations.json') || [];
        const reg = regs.find(r => r.id == attempts[idx].registrationId);
        if (reg && reg.suspended) {
            return res.status(403).json({ success: false, message: 'Your ID has been suspended. Reason: ' + (reg.suspendReason || 'Suspicious activity'), suspended: true });
        }
    }
    if (idx === -1) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (attempts[idx].submitted) return res.status(400).json({ success: false, message: 'Already submitted' });

    // Validate end time
    if (new Date() > new Date(attempts[idx].endTime)) {
        return res.status(400).json({ success: false, message: 'Exam time ended' });
    }

    if (!attempts[idx].answers) attempts[idx].answers = {};
    attempts[idx].answers[questionId] = answer;
    writeData('entrance-attempts.json', attempts);
    res.json({ success: true });
});

// --- Report Security Violation (tab switch, fullscreen exit, etc.) ---
app.post('/api/entrance/report-violation', (req, res) => {
    const { attemptId, type, detail } = req.body;
    const attempts = readData('entrance-attempts.json') || [];
    const aIdx = attempts.findIndex(a => a.id == attemptId);
    if (aIdx === -1) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (attempts[aIdx].submitted) return res.json({ success: true, ignored: true });

    // Track violations on the attempt
    if (!attempts[aIdx].violations) attempts[aIdx].violations = [];
    attempts[aIdx].violations.push({
        type: type || 'unknown',
        detail: detail || '',
        time: new Date().toISOString()
    });
    const violationCount = attempts[aIdx].violations.length;
    writeData('entrance-attempts.json', attempts);

    // Auto-suspend after 3 violations
    const MAX_VIOLATIONS = 3;
    let suspended = false;
    if (violationCount >= MAX_VIOLATIONS) {
        const regs = readData('entrance-registrations.json') || [];
        const rIdx = regs.findIndex(r => r.id == attempts[aIdx].registrationId);
        if (rIdx !== -1 && !regs[rIdx].suspended) {
            regs[rIdx].suspended = true;
            regs[rIdx].suspendReason = `Auto-suspended: ${violationCount} security violations (last: ${type})`;
            regs[rIdx].suspendedAt = new Date().toISOString();
            regs[rIdx].suspendedBy = 'system';
            writeData('entrance-registrations.json', regs);
            suspended = true;
        }
    }
    res.json({ success: true, violationCount, maxViolations: MAX_VIOLATIONS, suspended });
});

// --- Submit Exam ---
app.post('/api/entrance/submit-exam', (req, res) => {
    try {
        const { attemptId } = req.body;
        const attempts = readData('entrance-attempts.json') || [];
        const idx = attempts.findIndex(a => a.id == attemptId);
        if (idx === -1) return res.status(404).json({ success: false, message: 'Attempt not found' });

        const attempt = attempts[idx];
        if (attempt.submitted) return res.status(400).json({ success: false, message: 'Already submitted' });

        const allQuestions = readData('entrance-questions.json') || [];
        const exams = readData('entrance-exams.json') || [];
        const exam = exams.find(e => e.id == attempt.examId);

        // Auto-grade (map shuffled answer index back to original option index)
        let marksObtained = 0;
        let totalMarks = 0;
        const optionOrder = attempt.optionOrder || {};
        attempt.questionIds.forEach(qid => {
            const q = allQuestions.find(qq => qq.id === qid);
            if (!q) return;
            totalMarks += q.marks || 1;
            const studentAns = attempt.answers ? attempt.answers[qid] : undefined;
            if (studentAns === undefined) return;
            // Translate the student's selected (shuffled) index to the original index
            const order = optionOrder[qid];
            const originalSelectedIdx = order ? order[parseInt(studentAns)] : parseInt(studentAns);
            if (originalSelectedIdx === q.correctAnswer) {
                marksObtained += q.marks || 1;
            }
        });

        attempt.submitted = true;
        attempt.submittedAt = new Date().toISOString();
        attempt.marksObtained = marksObtained;
        attempt.totalMarks = totalMarks;
        attempts[idx] = attempt;
        writeData('entrance-attempts.json', attempts);

        // Save result
        const results = readData('entrance-results.json') || [];
        const regs = readData('entrance-registrations.json') || [];
        const reg = regs.find(r => r.id == attempt.registrationId);

        const result = {
            id: Date.now(),
            attemptId: attempt.id,
            registrationId: attempt.registrationId,
            examId: attempt.examId,
            registrationNo: reg ? reg.registrationNo : '',
            studentName: reg ? reg.studentName : '',
            course: reg ? reg.course : '',
            examName: exam ? exam.name : '',
            marksObtained,
            totalMarks: totalMarks || (exam ? exam.totalMarks : 0),
            percentage: totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0,
            submittedAt: attempt.submittedAt,
            published: false
        };
        results.push(result);
        writeData('entrance-results.json', results);

        res.json({ 
            success: true, 
            message: 'Exam submitted successfully',
            marksObtained,
            totalMarks: totalMarks || (exam ? exam.totalMarks : 0),
            percentage: totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0
        });
    } catch (err) {
        console.error('Submit exam error:', err);
        res.status(500).json({ success: false, message: 'Server error during submission: ' + err.message });
    }
});

// --- Entrance Submission Settings ---
app.get('/api/entrance-submission-settings', (req, res) => {
    // Default settings
    const defaultSettings = {
        resultPublishDate: '',
        autoLogout: false,
        showScore: false,
        confirmMessage: 'Your responses have been recorded. Results will be published by the institute.'
    };
    
    // Try to read from settings file
    const settings = readData('entrance-submission-settings.json');
    if (settings) {
        res.json(settings);
    } else {
        res.json(defaultSettings);
    }
});

app.post('/api/entrance-submission-settings', (req, res) => {
    try {
        const settings = req.body;
        writeData('entrance-submission-settings.json', settings);
        res.json({ success: true, message: 'Settings saved' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error saving settings' });
    }
});

// --- PDF Display Options ---
app.get('/api/pdf-display-options', (req, res) => {
    const defaultOptions = {
        showLogo: true,
        showRef: true,
        showCourses: true,
        showQR: true,
        showSignature: true
    };
    
    const options = readData('pdf-display-options.json');
    res.json(options || defaultOptions);
});

app.post('/api/pdf-display-options', (req, res) => {
    try {
        const options = req.body;
        writeData('pdf-display-options.json', options);
        res.json({ success: true, message: 'Options saved' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error saving options' });
    }
});

// --- Entrance Results ---
app.get('/api/entrance-results', (req, res) => {
    const results = readData('entrance-results.json') || [];
    const regs = readData('entrance-registrations.json') || [];
    
    // Add course to results if missing (for backward compatibility)
    const resultsWithCourse = results.map(r => {
        if (!r.course && r.registrationId) {
            const reg = regs.find(reg => reg.id == r.registrationId);
            if (reg && reg.course) {
                return { ...r, course: reg.course };
            }
        }
        return r;
    });
    
    if (req.query.examId) {
        return res.json(resultsWithCourse.filter(r => r.examId == req.query.examId));
    }
    res.json(resultsWithCourse);
});

// Get result for a specific student (only if published)
app.get('/api/entrance/my-result/:registrationId', (req, res) => {
    const results = readData('entrance-results.json') || [];
    const regs = readData('entrance-registrations.json') || [];
    let result = results.find(r => r.registrationId == req.params.registrationId && r.published);
    
    if (!result) return res.status(404).json({ success: false, message: 'Result not yet published' });
    
    // Add course if missing (for backward compatibility)
    if (!result.course && result.registrationId) {
        const reg = regs.find(reg => reg.id == result.registrationId);
        if (reg && reg.course) {
            result = { ...result, course: reg.course };
        }
    }
    
    res.json({ success: true, result });
});

// Publish/Unpublish all results for an exam
app.post('/api/entrance-results/publish', (req, res) => {
    const { examId, publish } = req.body;
    const results = readData('entrance-results.json') || [];
    let updated = 0;
    results.forEach(r => {
        if (r.examId == examId) {
            r.published = !!publish;
            updated++;
        }
    });
    writeData('entrance-results.json', results);
    res.json({ success: true, updated });
});

// Toggle publish for a single result
app.post('/api/entrance-results/:id/toggle-publish', (req, res) => {
    const results = readData('entrance-results.json') || [];
    const idx = results.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Result not found' });
    results[idx].published = !results[idx].published;
    writeData('entrance-results.json', results);
    res.json({ success: true, result: results[idx] });
});

// Manually update marks for a result
app.put('/api/entrance-results/:id', (req, res) => {
    const { marksObtained } = req.body;
    if (marksObtained === undefined || isNaN(parseFloat(marksObtained))) {
        return res.status(400).json({ success: false, message: 'Valid marksObtained required' });
    }
    const results = readData('entrance-results.json') || [];
    const idx = results.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Result not found' });
    const m = parseFloat(marksObtained);
    results[idx].marksObtained = m;
    results[idx].percentage = results[idx].totalMarks > 0 ? Math.round((m / results[idx].totalMarks) * 100 * 100) / 100 : 0;
    results[idx].manuallyEdited = true;
    results[idx].lastEditedAt = new Date().toISOString();
    writeData('entrance-results.json', results);
    res.json({ success: true, result: results[idx] });
});

// Delete a result (also clears the attempt so student can retake)
app.delete('/api/entrance-results/:id', (req, res) => {
    let results = readData('entrance-results.json') || [];
    const result = results.find(r => r.id == req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Result not found' });
    results = results.filter(r => r.id != req.params.id);
    writeData('entrance-results.json', results);
    // Also clear the attempt so the student can re-take if shift is still active
    if (req.query.allowRetake === 'true' || req.body.allowRetake) {
        let attempts = readData('entrance-attempts.json') || [];
        attempts = attempts.filter(a => !(a.registrationId == result.registrationId && a.examId == result.examId));
        writeData('entrance-attempts.json', attempts);
    }
    res.json({ success: true });
});

// Re-evaluate: regrade all submitted attempts for an exam using current correct answers
app.post('/api/entrance-results/re-evaluate', (req, res) => {
    const { examId } = req.body;
    if (!examId) return res.status(400).json({ success: false, message: 'examId required' });
    const attempts = readData('entrance-attempts.json') || [];
    const allQuestions = readData('entrance-questions.json') || [];
    const results = readData('entrance-results.json') || [];
    let updated = 0;
    attempts.forEach(attempt => {
        if (attempt.examId != examId || !attempt.submitted) return;
        let marksObtained = 0;
        let totalMarks = 0;
        const optionOrder = attempt.optionOrder || {};
        attempt.questionIds.forEach(qid => {
            const q = allQuestions.find(qq => qq.id === qid);
            if (!q) return;
            totalMarks += q.marks || 1;
            const studentAns = attempt.answers ? attempt.answers[qid] : undefined;
            if (studentAns === undefined) return;
            const order = optionOrder[qid];
            const originalSelectedIdx = order ? order[parseInt(studentAns)] : parseInt(studentAns);
            if (originalSelectedIdx === q.correctAnswer) marksObtained += q.marks || 1;
        });
        attempt.marksObtained = marksObtained;
        attempt.totalMarks = totalMarks;
        const ridx = results.findIndex(r => r.attemptId == attempt.id);
        if (ridx !== -1) {
            results[ridx].marksObtained = marksObtained;
            results[ridx].totalMarks = totalMarks;
            results[ridx].percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100 * 100) / 100 : 0;
            results[ridx].manuallyEdited = false;
            results[ridx].lastEvaluatedAt = new Date().toISOString();
            updated++;
        }
    });
    writeData('entrance-attempts.json', attempts);
    writeData('entrance-results.json', results);
    res.json({ success: true, updated });
});

// Generate HTML template for entrance result PDF
function generateEntranceResultHTML(result) {
    const settings = readData('settings.json') || {};
    const instituteName = settings.entrancePdfInstituteName || settings.instituteName || 'GENIUS COMPUTER EDUCATION';
    const tagline = settings.entrancePdfTagline || settings.tagline || 'Excellence in Computer Education';
    const address = settings.entrancePdfAddress || settings.address || '';
    const headerColor = settings.headerColor || '#1e3a8a';
    const signatureLabel = settings.signatureLabel || 'Principal / Director';
    const footerText = settings.entrancePdfFooter || settings.footerText || '© Genius Computer Education. All Rights Reserved.';
    const instructions = settings.entrancePdfInstructions || settings.entranceInstructions || 'This scorecard is valid for admission purposes only. Please verify the authenticity of this document with the institute administration.';
    const courses = settings.eligibleCourses || 'DCA, PGDCA, BCA, Tally, Busy, Corel Draw';
    
    const logoUrl = settings.logo || '';
    const logoHtml = logoUrl 
        ? `<img src="${logoUrl}" style="width:90px;height:90px;object-fit:contain;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.1);" alt="Logo">`
        : `<div style="width:90px;height:90px;background:linear-gradient(135deg,${headerColor}15,${headerColor}08);border:2px solid ${headerColor}30;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(0,0,0,0.1);"><span style="font-size:45px;">🎓</span></div>`;
    
    const courseList = courses.split(',').map(c => c.trim()).filter(c => c);
    const coursesHtml = courseList.length > 0 
        ? `<div style="margin-bottom:18px;">
        <h4 style="margin:0 0 12px 0;color:${headerColor};font-size:12px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;">Eligible Courses</h4>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${courseList.map(course => `<span style="background:#fff;border:2px solid ${headerColor}40;color:${headerColor};padding:8px 16px;border-radius:6px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.08);">${course}</span>`).join('')}
        </div></div>`
        : '';
    
    const instructionsHtml = instructions
        ? `<div style="margin-bottom:18px;padding:14px;background:#fffbe6;border:2px solid #fbbf24;border-radius:8px;box-shadow:0 2px 8px rgba(251,191,36,0.15);">
        <h4 style="margin:0 0 10px 0;color:#92400e;font-size:12px;font-weight:800;letter-spacing:0.7px;text-transform:uppercase;">Important Instructions</h4>
        <p style="margin:0;color:#1f2937;font-size:10px;line-height:1.6;">${instructions}</p>
        </div>`
        : '';
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Entrance Result - ${result.registrationNo || 'Student'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', 'Roboto', 'Helvetica', sans-serif; }
    </style>
</head>
<body>
    <div style="width:210mm;height:297mm;padding:0;background:#fff;margin:0;">
        <div style="height:100%;display:flex;flex-direction:column;">
            <div style="background:linear-gradient(135deg,${headerColor} 0%,${headerColor} 100%);padding:25px 30px;position:relative;overflow:hidden;">
                <div style="position:absolute;top:-50%;right:-30%;width:400px;height:400px;background:radial-gradient(circle,rgba(255,255,255,0.1) 0%,transparent 70%);border-radius:50%;"></div>
                <div style="position:absolute;bottom:-30%;left:-20%;width:300px;height:300px;background:radial-gradient(circle,rgba(255,255,255,0.08) 0%,transparent 70%);border-radius:50%;"></div>
                <div style="display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1;">
                    <div style="flex:0 0 110px;">${logoHtml}</div>
                    <div style="flex:1;text-align:center;padding:0 30px;">
                        <h1 style="margin:0;font-size:28px;color:#fff;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,0.2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${instituteName}</h1>
                        <p style="margin:8px 0 0 0;color:rgba(255,255,255,0.95);font-size:14px;font-weight:600;letter-spacing:0.8px;">${tagline}</p>
                        ${address ? `<p style="margin:5px 0 0 0;color:rgba(255,255,255,0.85);font-size:11px;">${address}</p>` : ''}
                    </div>
                    <div style="flex:0 0 110px;"></div>
                </div>
            </div>
            <div style="flex:1;padding:30px;display:flex;flex-direction:column;">
                <div style="text-align:center;margin-bottom:25px;">
                    <div style="display:inline-block;padding:12px 40px;background:#f8fafc;border:2px solid ${headerColor}30;border-radius:30px;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
                        <h2 style="margin:0;color:${headerColor};font-size:14px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;">Official Examination Scorecard</h2>
                    </div>
                </div>
                <div style="background:#fff;border:2px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 4px 15px rgba(0,0,0,0.06);">
                    <h3 style="margin:0 0 16px 0;color:${headerColor};font-size:14px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;border-bottom:2px solid ${headerColor}20;padding-bottom:10px;">Candidate Information</h3>
                    <table style="width:100%;border-collapse:collapse;">
                        <tr><td style="padding:12px 15px;font-weight:700;color:#6b7280;font-size:11px;width:40%;border-bottom:1px solid #f3f4f6;">Registration Number</td><td style="padding:12px 15px;color:#1f2937;font-weight:700;font-size:13px;border-bottom:1px solid #f3f4f6;">${result.registrationNo || ''}</td></tr>
                        <tr><td style="padding:12px 15px;font-weight:700;color:#6b7280;font-size:11px;border-bottom:1px solid #f3f4f6;">Student Name</td><td style="padding:12px 15px;color:#1f2937;font-weight:700;font-size:13px;text-transform:uppercase;border-bottom:1px solid #f3f4f6;">${result.studentName || ''}</td></tr>
                        <tr><td style="padding:12px 15px;font-weight:700;color:#6b7280;font-size:11px;border-bottom:1px solid #f3f4f6;">Applied Course</td><td style="padding:12px 15px;color:${headerColor};font-weight:800;font-size:13px;text-transform:uppercase;border-bottom:1px solid #f3f4f6;">${result.course || '-'}</td></tr>
                        <tr><td style="padding:12px 15px;font-weight:700;color:#6b7280;font-size:11px;border-bottom:1px solid #f3f4f6;">Examination</td><td style="padding:12px 15px;color:#1f2937;font-weight:700;font-size:13px;text-transform:uppercase;border-bottom:1px solid #f3f4f6;">${result.examName || ''}</td></tr>
                        <tr><td style="padding:12px 15px;font-weight:700;color:#6b7280;font-size:11px;">Date of Examination</td><td style="padding:12px 15px;color:#1f2937;font-weight:700;font-size:13px;">${result.submittedAt ? new Date(result.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</td></tr>
                    </table>
                </div>
                <div style="background:linear-gradient(135deg,${headerColor} 0%,${headerColor} 100%);border-radius:12px;padding:25px;margin-bottom:20px;box-shadow:0 8px 25px rgba(0,0,0,0.15);position:relative;overflow:hidden;">
                    <div style="position:absolute;top:-40%;right:-20%;width:300px;height:300px;background:radial-gradient(circle,rgba(255,255,255,0.15) 0%,transparent 70%);border-radius:50%;"></div>
                    <h3 style="margin:0 0 20px 0;color:#fff;font-size:15px;font-weight:900;letter-spacing:0.9px;text-transform:uppercase;text-align:center;border-bottom:2px solid rgba(255,255,255,0.3);padding-bottom:12px;position:relative;">Performance Summary</h3>
                    <table style="width:100%;border-collapse:collapse;position:relative;">
                        <tr><td style="padding:14px;border-bottom:1px solid rgba(255,255,255,0.2);font-weight:700;color:rgba(255,255,255,0.95);width:45%;font-size:12px;">Total Marks Obtained</td><td style="padding:14px;border-bottom:1px solid rgba(255,255,255,0.2);font-size:32px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.2);">${result.marksObtained !== undefined && result.marksObtained !== null ? result.marksObtained : 0} <span style="font-size:18px;color:rgba(255,255,255,0.85);font-weight:700;">/ ${result.totalMarks !== undefined && result.totalMarks !== null ? result.totalMarks : 0}</span></td></tr>
                        <tr><td style="padding:14px;font-weight:700;color:rgba(255,255,255,0.95);font-size:12px;">Overall Percentage</td><td style="padding:14px;font-size:32px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.2);">${result.percentage !== undefined && result.percentage !== null ? result.percentage : 0}<span style="font-size:18px;color:rgba(255,255,255,0.85);font-weight:700;">%</span></td></tr>
                    </table>
                </div>
                ${instructionsHtml}
                ${coursesHtml}
            </div>
            <div style="background:#f8fafc;padding:20px 30px;border-top:2px solid #e5e7eb;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:30px;">
                    <div style="flex:1;">
                        <p style="margin:0;font-size:10px;color:#6b7280;line-height:1.5;">This is a computer-generated document. No manual signatures are required. This scorecard is valid for admission purposes only.</p>
                    </div>
                    <div style="flex:0 0 200px;text-align:center;padding:15px;background:#fff;border:2px solid ${headerColor}30;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                        <p style="margin:0 0 12px 0;font-size:10px;color:${headerColor};font-weight:800;letter-spacing:0.7px;text-transform:uppercase;">Authorization</p>
                        <div style="width:80px;height:50px;border-bottom:3px solid ${headerColor};margin:12px auto 0 auto;"></div>
                        <p style="margin:12px 0 0 0;font-size:10px;color:#374151;font-weight:700;">${signatureLabel}</p>
                    </div>
                </div>
                <div style="text-align:center;margin-top:15px;padding-top:15px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:9px;color:#9ca3af;letter-spacing:0.6px;font-weight:600;">${footerText}</p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// Generate PDF for entrance result using PDFKit
app.get('/api/entrance-result-pdf/:id', async (req, res) => {
    try {
        const results = readData('entrance-results.json') || [];
        const result = results.find(r => r.id == req.params.id);
        
        if (!result) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }
        
        const settings = readData('settings.json') || {};
        const pdfOptions = readData('pdf-display-options.json') || {};
        
        const instituteName = settings.entrancePdfInstituteName || settings.instituteName || 'GENIUS COMPUTER EDUCATION';
        const tagline = settings.entrancePdfTagline || settings.tagline || 'Excellence in Computer Education';
        const address = settings.entrancePdfAddress || settings.address || '';
        const headerColor = settings.headerColor || '#1e3a8a';
        const signatureLabel = settings.signatureLabel || 'Principal / Director';
        const footerText = settings.entrancePdfFooter || settings.footerText || '© Genius Computer Education. All Rights Reserved.';
        const instructions = settings.entrancePdfInstructions || settings.entranceInstructions || 'This scorecard is valid for admission purposes only. Please verify the authenticity of this document with the institute administration.';
        const courses = settings.eligibleCourses || 'DCA, PGDCA, BCA, Tally, Busy, Corel Draw';
        
        const showLogo = pdfOptions.showLogo !== false;
        const showRef = pdfOptions.showRef !== false;
        const showCourses = pdfOptions.showCourses !== false;
        const showQR = pdfOptions.showQR !== false;
        const showSignature = pdfOptions.showSignature !== false;
        
        // Generate unique reference number
        const refNumber = 'GCE-' + new Date().getFullYear() + '-' + String(result.id).padStart(6, '0');
        
        // Generate QR code for verification
        const verificationUrl = `${req.protocol}://${req.get('host')}/verify-result/${refNumber}`;
        const qrCodeDataUrl = await qrcode.toDataURL(verificationUrl, { width: 100 });
        
        // Calculate grade
        const percentage = result.percentage !== undefined && result.percentage !== null ? result.percentage : 0;
        let grade = 'F';
        let gradeColor = '#ef4444';
        if (percentage >= 90) { grade = 'A+'; gradeColor = '#10b981'; }
        else if (percentage >= 80) { grade = 'A'; gradeColor = '#22c55e'; }
        else if (percentage >= 70) { grade = 'B+'; gradeColor = '#84cc16'; }
        else if (percentage >= 60) { grade = 'B'; gradeColor = '#eab308'; }
        else if (percentage >= 50) { grade = 'C'; gradeColor = '#f97316'; }
        else if (percentage >= 40) { grade = 'D'; gradeColor = '#f59e0b'; }
        
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="entrance-result-${result.registrationNo || 'student'}.pdf"`);
            res.send(pdfBuffer);
        });
        
        // Simple border
        doc.lineWidth(2);
        doc.rect(15, 15, 565.28, 811.28).stroke(headerColor);
        doc.lineWidth(1);
        doc.rect(20, 20, 555.28, 801.28).stroke('#e5e7eb');
        
        // Header - clean and professional
        doc.rect(20, 20, 555.28, 80).fill(headerColor);
        
        // Logo on left side of header (vertically centered)
        if (showLogo && settings.logo) {
            try {
                // Resolve logo path to absolute path
                const relPath = settings.logo.startsWith('/') ? settings.logo.slice(1) : settings.logo;
                const absPath = path.join(__dirname, relPath);
                const publicPath = path.join(__dirname, 'public', relPath);
                const logoPath = fs.existsSync(absPath) ? absPath : (fs.existsSync(publicPath) ? publicPath : null);
                
                if (logoPath) {
                    doc.image(logoPath, 30, 30, { width: 60, height: 60 });
                } else {
                    doc.fontSize(36).text('🎓', 30, 30);
                }
            } catch (e) {
                doc.fontSize(36).text('🎓', 30, 30);
            }
        } else if (showLogo) {
            doc.fontSize(36).text('🎓', 30, 30);
        }
        
        // Institute info (vertically centered to the right of logo)
        const textX = showLogo ? 100 : 30;
        const textWidth = showLogo ? 475.28 : 555.28;
        doc.fontSize(24).fillColor('#ffffff').font('Helvetica-Bold').text(instituteName.toUpperCase(), textX, 35, { align: 'center', width: textWidth });
        doc.fontSize(12).fillColor('rgba(255,255,255,0.9)').font('Helvetica').text(tagline, textX, 55, { align: 'center', width: textWidth });
        if (address) {
            doc.fontSize(10).fillColor('rgba(255,255,255,0.8)').font('Helvetica').text(address, textX, 70, { align: 'center', width: textWidth });
        }
        
        // Reference number
        if (showRef) {
            doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold').text('Ref: ' + refNumber, 35, 85);
        }
        
        // Title section
        let y = 115;
        
        // Title text (centered on full page)
        doc.fontSize(16).fillColor(headerColor).font('Helvetica-Bold').text('EXAMINATION RESULT', 20, y + 10, { align: 'center', width: 555.28 });
        y += 35;
        doc.moveTo(20, y).lineTo(575.28, y).stroke(headerColor).lineWidth(2);
        y += 20;
        
        // Student details - improved table format
        doc.rect(30, y, 535.28, 120).fill('#f8fafc');
        doc.rect(30, y, 535.28, 120).stroke('#e5e7eb').lineWidth(1);
        
        doc.fontSize(12).fillColor(headerColor).font('Helvetica-Bold').text('Student Details', 45, y + 12);
        doc.moveTo(45, y + 30).lineTo(550, y + 30).stroke(headerColor).lineWidth(1);
        
        y += 40;
        
        const studentDetails = [
            ['Name', (result.studentName || '').toUpperCase()],
            ['Registration No', result.registrationNo || '-'],
            ['Course', (result.course || '-').toUpperCase()],
            ['Exam', (result.examName || '').toUpperCase()],
            ['Date', result.submittedAt ? new Date(result.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'],
            ['Reference No', refNumber]
        ];
        
        // Two-column layout for better space utilization
        const col1X = 45;
        const col2X = 310;
        const rowHeight = 18;
        
        studentDetails.forEach((detail, index) => {
            const rowY = y + Math.floor(index / 2) * rowHeight;
            const colX = index % 2 === 0 ? col1X : col2X;
            
            doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold').text(detail[0] + ':', colX, rowY);
            doc.fontSize(10).fillColor('#1f293b').font('Helvetica').text(detail[1], colX + 100, rowY);
        });
        
        y += 80;
        
        // Performance section
        doc.rect(30, y, 535.28, 80).fill('#f8fafc');
        doc.rect(30, y, 535.28, 80).stroke('#e5e7eb').lineWidth(1);
        
        doc.fontSize(12).fillColor(headerColor).font('Helvetica-Bold').text('Performance', 45, y + 12);
        
        // Marks
        doc.fontSize(10).fillColor('#6b7280').font('Helvetica').text('Marks Obtained', 45, y + 35);
        doc.fontSize(24).fillColor(headerColor).font('Helvetica-Bold').text(`${result.marksObtained || 0} / ${result.totalMarks || 0}`, 45, y + 50);
        
        // Percentage
        doc.fontSize(10).fillColor('#6b7280').font('Helvetica').text('Percentage', 200, y + 35);
        doc.fontSize(24).fillColor(percentage >= 60 ? '#10b981' : percentage >= 40 ? '#f59e0b' : '#ef4444').font('Helvetica-Bold').text(`${percentage}%`, 200, y + 50);
        
        // Eligible Courses
        doc.fontSize(10).fillColor('#6b7280').font('Helvetica').text('Eligible Courses', 350, y + 35);
        doc.fontSize(12).fillColor('#1e40af').font('Helvetica-Bold').text(courses, 350, y + 50, { width: 180 });
        
        y += 100;
        
        // Signature area - moved before instructions
        if (showSignature) {
            doc.fontSize(9).fillColor('#374151').font('Helvetica').text(signatureLabel, 400, y + 10, { width: 120, align: 'center' });
            doc.moveTo(400, y + 25).lineTo(520, y + 25).stroke('#374151').lineWidth(1);
            y += 40;
        }
        
        // Instructions section with proper styling - larger box to show full content
        if (instructions) {
            doc.rect(30, y, 535.28, 250).fill('#fffbeb');
            doc.rect(30, y, 535.28, 250).stroke('#f59e0b').lineWidth(1);
            
            doc.fontSize(11).fillColor('#92400e').font('Helvetica-Bold').text('Important Instructions', 45, y + 12);
            doc.moveTo(45, y + 28).lineTo(520, y + 28).stroke('#f59e0b').lineWidth(1);
            
            // Split instructions by newlines and render as bullet points with proper spacing
            const instructionLines = instructions.split('\n').filter(line => line.trim());
            let bulletY = y + 38;
            instructionLines.forEach((line, index) => {
                if (index > 0) bulletY += 20; // Increased spacing to prevent overriding
                doc.fontSize(9).fillColor('#1f2937').font('Helvetica').text('• ' + line.trim(), 45, bulletY, { width: 470, align: 'left' });
            });
            
            y += 265;
        }
        
        // Verification section - positioned closer to instructions
        if (showQR) {
            y += 2; // Minimal spacing between instructions and verification
            doc.rect(30, y, 535.28, 80).fill('#f0f9ff');
            doc.rect(30, y, 535.28, 80).stroke('#3b82f6').lineWidth(1);
            
            doc.fontSize(11).fillColor('#1e40af').font('Helvetica-Bold').text('Document Verification', 45, y + 12);
            doc.moveTo(45, y + 28).lineTo(520, y + 28).stroke('#3b82f6').lineWidth(1);
            
            doc.fontSize(9).fillColor('#1e3a8a').font('Helvetica').text('Scan QR code to verify this document online', 45, y + 38, { width: 320 });
            doc.fontSize(8).fillColor('#3b82f6').font('Helvetica').text(verificationUrl, 45, y + 52, { width: 320 });
            
            // QR code - with background and border for better visibility
            try {
                // White background box with border for QR code
                doc.rect(425, y + 5, 70, 70).fill('#ffffff');
                doc.rect(425, y + 5, 70, 70).stroke('#3b82f6').lineWidth(2);
                
                const qrBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
                doc.image(qrBuffer, 430, y + 10, { width: 60, height: 60 });
            } catch (e) {
                doc.rect(425, y + 5, 70, 70).fill('#ffffff');
                doc.rect(425, y + 5, 70, 70).stroke('#3b82f6').lineWidth(2);
                doc.fontSize(8).fillColor('#6b7280').font('Helvetica').text('QR', 430, y + 40, { align: 'center', width: 60 });
            }
            
            y += 80;
        }
        
        // Footer section - positioned higher
        y += 3;
        doc.moveTo(30, y).lineTo(565.28, y).stroke('#e5e7eb').lineWidth(1);
        y += 8;
        
        doc.fontSize(8).fillColor('#9ca3af').font('Helvetica').text(footerText, 30, y, { width: 535.28, align: 'center' });
        
        doc.end();
    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate PDF: ' + error.message });
    }
});

// Entrance result verification page for QR code scanning
app.get('/verify-result/:refNumber', (req, res) => {
    const refNumber = req.params.refNumber;
    const results = readData('entrance-results.json') || [];
    const settings = readData('settings.json') || {};
    
    // Find result by reference number
    const result = results.find(r => {
        const expectedRef = 'GCE-' + new Date().getFullYear() + '-' + String(r.id).padStart(6, '0');
        return expectedRef === refNumber;
    });
    
    if (!result) {
        return res.send(`
            <!DOCTYPE html>
            <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Result Verification</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f1f5f9; padding: 20px; text-align: center; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #dc2626; margin-bottom: 10px; }
                p { color: #64748b; }
            </style></head><body>
            <div class="container"><h1>❌ Invalid Link</h1><p>No result found for this reference number. Please scan the QR code from the original result document.</p></div>
            </body></html>
        `);
    }
    
    const percentage = result.percentage !== undefined && result.percentage !== null ? result.percentage : 0;
    let grade = 'F';
    let gradeColor = '#ef4444';
    if (percentage >= 90) { grade = 'A+'; gradeColor = '#10b981'; }
    else if (percentage >= 80) { grade = 'A'; gradeColor = '#22c55e'; }
    else if (percentage >= 70) { grade = 'B+'; gradeColor = '#84cc16'; }
    else if (percentage >= 60) { grade = 'B'; gradeColor = '#eab308'; }
    else if (percentage >= 50) { grade = 'C'; gradeColor = '#f97316'; }
    else if (percentage >= 40) { grade = 'D'; gradeColor = '#f59e0b'; }
    
    const instituteName = settings.instituteName || 'Genius Computer Education';
    const headerColor = settings.headerColor || '#1e3a8a';
    
    res.send(`
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Result Verification - ${instituteName}</title>
        <style>
            body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; margin: 0; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; margin-bottom: 20px; }
            .header h1 { color: ${headerColor}; margin: 0 0 10px 0; font-size: 24px; }
            .header p { color: #64748b; margin: 0; }
            .status { text-align: center; padding: 20px; background: #f0f9ff; border-radius: 8px; margin-bottom: 20px; }
            .status .grade { font-size: 48px; font-weight: bold; color: ${gradeColor}; }
            .status .percentage { font-size: 24px; color: #1e40af; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .detail-item { background: #f8fafc; padding: 15px; border-radius: 8px; }
            .detail-item label { display: block; color: #64748b; font-size: 12px; margin-bottom: 5px; }
            .detail-item span { color: #1e293b; font-weight: 600; font-size: 14px; }
            .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 12px; }
            .verified { display: inline-flex; align-items: center; background: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin-bottom: 15px; }
        </style></head><body>
        <div class="container">
            <div class="header">
                <div class="verified">✓ Verified Document</div>
                <h1>${instituteName}</h1>
                <p>Entrance Examination Result</p>
            </div>
            <div class="status">
                <div class="grade">${grade}</div>
                <div class="percentage">${percentage}%</div>
            </div>
            <div class="details">
                <div class="detail-item">
                    <label>Student Name</label>
                    <span>${result.studentName || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <label>Registration No</label>
                    <span>${result.registrationNo || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <label>Marks Obtained</label>
                    <span>${result.marksObtained || 0} / ${result.totalMarks || 0}</span>
                </div>
                <div class="detail-item">
                    <label>Reference Number</label>
                    <span>${refNumber}</span>
                </div>
            </div>
            <div class="footer">
                <p>This document has been verified as authentic from ${instituteName}</p>
                <p>Verification Date: ${new Date().toLocaleDateString()}</p>
            </div>
        </div>
        </body></html>
    `);
});

// --- Live Monitoring ---
app.get('/api/entrance/monitor/:examId', (req, res) => {
    const attempts = readData('entrance-attempts.json') || [];
    const regs = readData('entrance-registrations.json') || [];
    const examAttempts = attempts.filter(a => a.examId == req.params.examId);
    const enriched = examAttempts.map(a => {
        const reg = regs.find(r => r.id === a.registrationId);
        return {
            ...a,
            studentName: reg ? reg.studentName : '',
            registrationNo: reg ? reg.registrationNo : '',
            shiftId: a.shiftId,
            suspended: reg ? !!reg.suspended : false,
            suspendReason: reg ? (reg.suspendReason || '') : ''
        };
    });
    res.json(enriched);
});

// ==================== END ENTRANCE EXAM ENDPOINTS ====================

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Handle CORS errors
    if (err.message === 'CORS policy: This origin is not allowed') {
        return res.status(403).json({ error: 'Origin not allowed' });
    }
    
    // Handle rate limit errors
    if (err.status === 429) {
        return res.status(429).json({ error: err.message });
    }
    
    // Handle other errors
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Server accessible on local network at http://192.168.31.12:${PORT}`);
});
