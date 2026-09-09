const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const source = fs.readFileSync(require.resolve('./server.js'), 'utf8');

function setup() {
    const routes = new Map();
    const db = {
        'faculty.json': [
            { id: 1, name: 'Staff One', email: 'one@example.test', role: 'Counsellor', password: 'private', totpSecret: 'private' },
            { id: 2, name: 'Staff Two', email: 'two@example.test', role: 'Faculty' }
        ],
        'leads.json': [
            { id: 11, name: 'First', phone: '123', status: 'New', assignedToId: '1', assignedTo: 'Staff One', notes: [], activities: [] },
            { id: 12, name: 'Second', status: 'New', assignedToId: '2', assignedTo: 'Staff Two' },
            { id: 13, name: 'Legacy', status: 'New', assignedTo: 'Staff One' }
        ]
    };
    const emails = [];
    const context = vm.createContext({
        app: Object.fromEntries(['get', 'post', 'put', 'patch', 'delete'].map(method => [method, (path, ...handlers) => routes.set(method + ' ' + path, handlers)])),
        readData: file => structuredClone(db[file] || []),
        writeData: (file, data) => { db[file] = structuredClone(data); },
        verifyAdminSessionMiddleware: (req, res, next) => req.headers['x-admin-session'] === 'admin' ? next() : res.status(401).json({ success: false }),
        getRolePermissions: () => [],
        formatDate: date => date.toISOString().slice(0, 10),
        sendLeadAssignedEmail: async lead => { emails.push(structuredClone(lead)); },
        sendLeadNotificationEmail: async () => {},
        sendLeadConvertedEmail: async () => {},
        crypto, console
    });
    const authStart = source.indexOf('function facultySessionUser(');
    const leadStart = source.indexOf('function getLeadAssignment(');
    assert.ok(authStart >= 0 && leadStart >= 0, 'Secure faculty sessions and linked assignments must exist');
    vm.runInContext(source.slice(authStart, source.indexOf('// --- Faculty ---', authStart)), context);
    vm.runInContext(source.slice(leadStart, source.indexOf('// Public endpoint for creating leads', leadStart)), context);
    async function request(method, path, { body = {}, id, facultyId, admin = false, expired = false } = {}) {
        const req = {
            body, params: { id }, headers: admin ? { 'x-admin-session': 'admin' } : {},
            session: facultyId ? { facultyId, facultyExpiresAt: Date.now() + (expired ? -1000 : 60000) } : {}
        };
        let status = 200;
        let result;
        const res = { set() { return this; }, status(code) { status = code; return this; }, json(value) { result = structuredClone(value); return this; } };
        const handlers = routes.get(method + ' ' + path);
        assert.ok(handlers, method + ' ' + path + ' exists');
        let index = 0;
        const next = () => handlers[index++]?.(req, res, next);
        await next();
        return { status, body: result };
    }
    return { db, emails, request, context, routes };
}

test('staff list contains only own ID-linked leads; legacy names grant no access', async () => {
    const { request } = setup();
    const res = await request('get', '/api/faculty-leads', { facultyId: 1 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.leads.map(l => l.id), [11]);
});

test('missing, expired and deleted staff sessions are rejected', async () => {
    const { request, db } = setup();
    for (const options of [{}, { facultyId: 1, expired: true }, { facultyId: 99 }]) {
        assert.equal((await request('get', '/api/faculty-leads', options)).status, 401);
    }
    db['faculty.json'] = [];
    assert.equal((await request('get', '/api/faculty-leads', { facultyId: 1 })).status, 401);
});

test('staff cannot read or update another staff lead or a legacy lead', async () => {
    const { request, db } = setup();
    const before = structuredClone(db);
    for (const id of [12, 13, 999]) {
        assert.equal((await request('get', '/api/faculty-leads/:id', { id, facultyId: 1 })).status, 404);
        assert.equal((await request('put', '/api/faculty-leads/:id', { id, facultyId: 1, body: { status: 'Lost' } })).status, 404);
    }
    assert.deepEqual(db, before);
});

test('staff updates follow-up and notes with a server-derived audit identity', async () => {
    const { request, db } = setup();
    const res = await request('put', '/api/faculty-leads/:id', {
        id: 11, facultyId: 1,
        body: { status: 'Contacted', priority: 'Hot', followUpDate: '2026-10-10', followUpTime: '14:30', note: 'Called the student' }
    });
    assert.equal(res.status, 200);
    const lead = db['leads.json'][0];
    assert.equal(lead.status, 'Contacted');
    assert.equal(lead.followUpTime, '14:30');
    assert.equal(lead.notes[0].by, 'Staff One');
    assert.equal(lead.notes[0].facultyId, 1);
    assert.equal(lead.notes[0].text, 'Called the student');
    assert.ok(lead.activities.some(a => a.action === 'Status Changed' && a.from === 'New'));
});

test('staff cannot reassign, change contact details, forge authors or mark admission', async () => {
    const { request, db } = setup();
    const before = structuredClone(db);
    for (const body of [{ assignedToId: '2' }, { assignedTo: 'Staff Two' }, { name: 'Forged' }, { by: 'Admin' }, { status: 'Admitted' }]) {
        assert.equal((await request('put', '/api/faculty-leads/:id', { id: 11, facultyId: 1, body })).status, 400);
    }
    assert.deepEqual(db, before);
});

test('invalid statuses, dates, priorities, empty updates and oversized notes fail atomically', async () => {
    const { request, db } = setup();
    const before = structuredClone(db);
    for (const body of [{}, { status: 'Fake' }, { followUpDate: '2026-02-30' }, { followUpTime: '27:00' }, { priority: 'Urgent' }, { note: 'x'.repeat(5001) }, { note: {} }]) {
        assert.equal((await request('put', '/api/faculty-leads/:id', { id: 11, facultyId: 1, body })).status, 400);
    }
    assert.deepEqual(db, before);
});

test('admin assignments resolve staff names from IDs and notify on changes only', async () => {
    const { request, db, emails } = setup();
    const res = await request('put', '/api/leads/:id', { admin: true, id: 11, body: { assignedToId: '2', assignedTo: 'Forged' } });
    assert.equal(res.status, 200);
    assert.equal(db['leads.json'][0].assignedTo, 'Staff Two');
    assert.equal(emails.length, 1);
    assert.ok(db['leads.json'][0].activities.some(a => a.action === 'Assignment Changed'));
    await request('put', '/api/leads/:id', { admin: true, id: 11, body: { assignedToId: '2', status: 'Contacted' } });
    assert.equal(emails.length, 1);
    assert.equal((await request('get', '/api/faculty-leads/:id', { id: 11, facultyId: 1 })).status, 404);
    assert.equal((await request('get', '/api/faculty-leads/:id', { id: 11, facultyId: 2 })).status, 200);
});

test('unknown assignees are rejected and unassign clears ownership', async () => {
    const { request, db, emails } = setup();
    assert.equal((await request('put', '/api/leads/:id', { admin: true, id: 11, body: { assignedToId: '99' } })).status, 400);
    assert.equal(db['leads.json'][0].assignedToId, '1');
    await request('put', '/api/leads/:id', { admin: true, id: 11, body: { assignedToId: '' } });
    assert.equal(db['leads.json'][0].assignedToId, null);
    assert.equal(db['leads.json'][0].assignedTo, '');
    assert.equal(emails.length, 0);
});

test('admin bulk assignment validates all IDs, records history and respects access', async () => {
    const { request, db, emails } = setup();
    assert.equal((await request('post', '/api/leads/bulk-action', { facultyId: 1, body: { ids: [11], action: 'assign', value: '2' } })).status, 401);
    assert.equal((await request('post', '/api/leads/bulk-action', { admin: true, body: { ids: [11, 999], action: 'assign', value: '2' } })).status, 400);
    assert.equal(db['leads.json'][0].assignedToId, '1');
    const res = await request('post', '/api/leads/bulk-action', { admin: true, body: { ids: [11, '13'], action: 'assign', value: '2' } });
    assert.equal(res.status, 200);
    assert.equal(db['leads.json'][2].assignedToId, '2');
    assert.equal(emails.length, 2);
});

test('new leads persist assignment, courses and notify assigned staff', async () => {
    const { request, db, emails } = setup();
    const res = await request('post', '/api/leads', { admin: true, body: { name: 'New Student', phone: '1234567890', courses: 'DCA', assignedToId: '1' } });
    assert.equal(res.status, 200);
    assert.equal(db['leads.json'][0].assignedToId, '1');
    assert.equal(db['leads.json'][0].courses, 'DCA');
    assert.equal(emails.length, 1);
});

test('admin notes accept frontend text field and keep timestamp', async () => {
    const { request, db } = setup();
    const res = await request('post', '/api/leads/:id/notes', { admin: true, id: 11, body: { text: 'Follow-up from admin' } });
    assert.equal(res.status, 200);
    assert.equal(db['leads.json'][0].notes[0].text, 'Follow-up from admin');
    assert.ok(db['leads.json'][0].notes[0].timestamp);
});

test('assignee endpoint and session response never expose passwords or TOTP secrets', async () => {
    const { request, context, db } = setup();
    assert.equal((await request('get', '/api/lead-assignees')).status, 401);
    const res = await request('get', '/api/lead-assignees', { admin: true });
    assert.deepEqual(Object.keys(res.body.staff[0]).sort(), ['email', 'id', 'name', 'role']);
    const user = context.facultySessionUser(db['faculty.json'][0]);
    assert.equal(user.password, undefined);
    assert.equal(user.totpSecret, undefined);
    const directory = context.facultyDirectoryUser(db['faculty.json'][0]);
    assert.equal(directory.password, undefined);
    assert.equal(directory.totpSecret, undefined);
});

test('assignment email targets the selected staff account and escapes lead content', async () => {
    const { context, db } = setup();
    const messages = [];
    context.getSMTPConfig = () => ({ smtpUser: 'sender@example.test', smtpPass: 'test-only', smtpHost: 'smtp.example.test', smtpPort: 587 });
    context.getEmailLogo = () => ({ html: '', attachments: [] });
    context.nodemailer = { createTransport: () => ({ sendMail: async message => messages.push(message) }) };
    context.console = { log() {}, error() {} };
    vm.runInContext(source.slice(source.indexOf('function sanitizeHTML('), source.indexOf('const app = express();')), context);
    vm.runInContext(source.slice(source.indexOf('async function sendLeadAssignedEmail('), source.indexOf('async function sendLeadConvertedEmail(')), context);
    await context.sendLeadAssignedEmail({ ...db['leads.json'][0], name: '<img src=x onerror=alert(1)>' });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].to, 'one@example.test');
    assert.ok(messages[0].html.includes('&lt;img'));
    assert.ok(!messages[0].html.includes('<img'));
    assert.ok(messages[0].html.includes('/faculty-portal.html#leads'));
    await context.sendLeadAssignedEmail({ assignedToId: '99' });
    assert.equal(messages.length, 1);
});

async function startTestServer(t) {
    const fixture = setup();
    fixture.db['faculty.json'].forEach(staff => { staff.password = 'private'; staff.passwordChanged = true; });
    const loginStart = source.indexOf("app.post('/api/faculty/login'");
    vm.runInContext(source.slice(loginStart, source.indexOf('// Helper function: Get permissions', loginStart)), fixture.context);
    const otpStart = source.indexOf("app.post('/api/faculty/verify-otp'");
    vm.runInContext(source.slice(otpStart, source.indexOf('// Faculty Password Change', otpStart)), fixture.context);
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(require('express-session')({ secret: 'isolated-test-session-secret', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'strict' } }));
    for (const [route, handlers] of fixture.routes) {
        const [method, path] = route.split(' ');
        app[method](path, ...handlers);
    }
    app.get('/api/settings', (req, res) => res.json({}));
    for (const path of ['/api/students', '/api/courses', '/api/assignments']) app.get(path, (req, res) => res.json([]));
    app.get('/test-admin', (req, res) => {
        const html = fs.readFileSync(require.resolve('./public/admin.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        res.type('html').send(html);
    });
    app.use(express.static(require('node:path').join(__dirname, 'public')));
    const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return { ...fixture, url: `http://127.0.0.1:${server.address().port}` };
}

test('password and OTP login establish real sessions; logout revokes access', async t => {
    const { url, db } = await startTestServer(t);
    const post = (path, body, cookie = '') => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
    const wrong = await post('/api/faculty/login', { email: 'one@example.test', password: 'wrong' });
    assert.equal((await wrong.json()).success, false);
    assert.equal(wrong.headers.get('set-cookie'), null);
    const login = await post('/api/faculty/login', { email: 'one@example.test', password: 'private' });
    assert.equal((await login.json()).success, true);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    assert.match(login.headers.get('set-cookie'), /SameSite=Strict/);
    const me = await fetch(url + '/api/faculty-auth/me', { headers: { Cookie: cookie } }).then(r => r.json());
    assert.equal(me.user.id, 1);
    assert.equal(me.user.password, undefined);
    const leads = await fetch(url + '/api/faculty-leads', { headers: { Cookie: cookie } }).then(r => r.json());
    assert.deepEqual(leads.leads.map(l => l.id), [11]);
    assert.equal((await fetch(url + '/api/faculty-leads/12', { headers: { Cookie: cookie } })).status, 404);
    await post('/api/faculty-auth/logout', {}, cookie);
    assert.equal((await fetch(url + '/api/faculty-leads', { headers: { Cookie: cookie } })).status, 401);
    db['faculty-otps.json'] = [{ facultyId: 2, email: 'two@example.test', otp: '123456', expiresAt: Date.now() + 60000 }];
    const otp = await post('/api/faculty/verify-otp', { email: 'two@example.test', otp: '123456' });
    assert.equal((await otp.json()).user.id, 2);
    const otpCookie = otp.headers.get('set-cookie').split(';')[0];
    const second = await fetch(url + '/api/faculty-leads', { headers: { Cookie: otpCookie } }).then(r => r.json());
    assert.deepEqual(second.leads.map(l => l.id), [12]);
    const reused = await post('/api/faculty/verify-otp', { email: 'two@example.test', otp: '123456' });
    assert.equal((await reused.json()).success, false);
});

test('browser: admin assignment, staff follow-up, reassignment, legacy links and mobile UI', { skip: process.env.RUN_BROWSER_TESTS !== '1' }, async t => {
    const { url, db } = await startTestServer(t);
    const browser = await require('puppeteer').launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.setRequestInterception(true);
    page.on('request', request => request.url().startsWith(url) ? request.continue() : request.abort());
    await page.goto(url + '/faculty-portal.html#leads');
    await page.type('#facultyEmail', 'one@example.test');
    await page.type('#facultyPassword', 'private');
    await page.click('#facultyLoginForm button[type="submit"]');
    await page.waitForSelector('#facultyLeadsTable [data-lead-index]');
    assert.equal(await page.$$eval('#facultyLeadsTable [data-lead-index]', buttons => buttons.length), 1);
    assert.equal(await page.$eval('#facultyLeadsTable tbody', el => el.textContent.includes('Second')), false);
    await page.click('#facultyLeadsTable [data-lead-index]');
    await page.waitForFunction(() => !document.getElementById('facultyLeadEditor').hidden);
    await page.select('#facultyLeadStatus', 'Contacted');
    await page.type('#facultyLeadNote', '<img src=x onerror=alert(1)> Called today');
    await page.evaluate(() => { document.getElementById('facultyLeadDate').value = '2026-10-10'; document.getElementById('facultyLeadTime').value = '15:30'; });
    await page.click('#facultyLeadSaveBtn');
    await page.waitForFunction(() => document.getElementById('facultyLeadMessage').textContent === 'Lead updated successfully.');
    assert.equal(db['leads.json'][0].status, 'Contacted');
    assert.equal(db['leads.json'][0].followUpTime, '15:30');
    assert.equal(await page.$('#facultyLeadHistory img'), null);
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.reload();
    await page.waitForSelector('#facultyLeadsTable [data-lead-index]');
    const admin = await browser.newPage();
    admin.on('pageerror', error => errors.push(error.message));
    admin.on('dialog', dialog => dialog.accept());
    await admin.setExtraHTTPHeaders({ 'X-Admin-Session': 'admin' });
    await admin.setRequestInterception(true);
    admin.on('request', request => request.url().startsWith(url) ? request.continue() : request.abort());
    await admin.goto(url + '/test-admin');
    const adminJS = fs.readFileSync(require.resolve('./public/js/admin.js'), 'utf8');
    await admin.addScriptTag({ content: adminJS.slice(0, adminJS.indexOf('let currentPage')) + adminJS.slice(adminJS.indexOf('let allLeads ='), adminJS.indexOf('// ===== Leads Reports & Analytics =====')) });
    await admin.evaluate(() => {
        window.showNotification = message => { window.lastLeadMessage = message; };
        window.closeModal = id => document.getElementById(id).classList.remove('active');
        document.querySelectorAll('.page-content').forEach(el => { el.style.display = 'none'; });
        for (let el = document.getElementById('page-leads'); el && el.tagName !== 'HTML'; el = el.parentElement) { el.classList.remove('hidden'); el.style.display = 'block'; }
        return loadLeads();
    });
    await admin.evaluate(() => openEditLeadModal(11));
    await admin.waitForFunction(() => !document.getElementById('leadAssignedTo').disabled);
    assert.equal(await admin.$eval('#leadAssignedTo', el => el.value), '1');
    await admin.select('#leadAssignedTo', '2');
    await admin.evaluate(() => saveLead());
    assert.equal(db['leads.json'][0].assignedToId, '2');
    await page.evaluate(() => loadFacultyLeads());
    assert.equal(await page.$$eval('#facultyLeadsTable [data-lead-index]', buttons => buttons.length), 0);
    await admin.evaluate(() => openEditLeadModal(13));
    await admin.waitForFunction(() => !document.getElementById('leadAssignedTo').disabled);
    assert.equal(await admin.$eval('#leadAssignedTo', el => el.value), '__keep__');
    await admin.select('#leadAssignedTo', '1');
    await admin.type('#leadPhone', '1234567890');
    await admin.evaluate(() => saveLead());
    assert.equal(db['leads.json'][2].assignedToId, '1');
    await admin.evaluate(async () => { await loadLeads(); document.querySelector('.lead-checkbox[value="13"]').checked = true; });
    await admin.select('#bulkLeadAssignee', '2');
    await admin.evaluate(() => assignSelectedLeads());
    assert.equal(db['leads.json'][2].assignedToId, '2');
    await page.evaluate(() => logout());
    assert.equal(await page.$eval('#dashboardSection', el => el.classList.contains('hidden')), true);
    assert.deepEqual(errors, []);
});
