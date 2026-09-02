const STORAGE_KEY = 'genius_code_playground_v1';

const defaultCode = {
  html: '<div class="welcome">\n  <h1>Hello, World!</h1>\n  <p>Code Playground me welcome!</p>\n  <button onclick="changeColor()">Click Me!</button>\n</div>',
  css: '.welcome{text-align:center;padding:40px;font-family:sans-serif}\n.welcome h1{color:#667eea}\n.welcome p{color:#64748b;margin:10px 0}\n.welcome button{padding:10px 24px;border:none;border-radius:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-size:1rem;cursor:pointer;transition:transform .2s}\n.welcome button:hover{transform:scale(1.05)}',
  js: 'function changeColor(){\n  var c=["#667eea","#764ba2","#f093fb","#10b981","#f59e0b"];\n  var color=c[Math.floor(Math.random()*c.length)];\n  document.querySelector(".welcome h1").style.color=color;\n}'
};

const templates = {
  blank: { html: '', css: '', js: '' },
  card: {
    html: '<div class="card">\n  <div class="avatar">G</div>\n  <h2>John Doe</h2>\n  <p class="title">Web Developer</p>\n  <p class="bio">Passionate about creating beautiful websites.</p>\n  <div class="skills">\n    <span>HTML</span><span>CSS</span><span>JS</span>\n  </div>\n</div>',
    css: 'body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0f172a;margin:0;font-family:sans-serif}\n.card{background:#1e293b;border-radius:20px;padding:30px;text-align:center;width:300px;color:#fff}\n.avatar{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;margin:0 auto 16px}\n.card h2{margin:0 0 4px}\n.title{color:#667eea;margin:0 0 12px;font-size:.9rem}\n.bio{color:#94a3b8;font-size:.85rem;margin:0 0 16px}\n.skills{display:flex;gap:8px;justify-content:center}\n.skills span{padding:4px 12px;border-radius:20px;background:rgba(102,126,234,.2);color:#a5b4fc;font-size:.75rem}',
    js: ''
  },
  counter: {
    html: '<div class="counter-app">\n  <h1>Counter</h1>\n  <div class="count" id="count">0</div>\n  <div class="btns">\n    <button onclick="dec()">-</button>\n    <button onclick="reset()">Reset</button>\n    <button onclick="inc()">+</button>\n  </div>\n</div>',
    css: 'body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0f172a;margin:0;font-family:sans-serif}\n.counter-app{text-align:center;color:#fff}\n.counter-app h1{color:#667eea;margin-bottom:20px}\n.count{font-size:4rem;font-weight:800;margin:20px 0}\n.btns{display:flex;gap:10px;justify-content:center}\n.btns button{padding:10px 20px;border:none;border-radius:10px;font-size:1.2rem;cursor:pointer;transition:transform .2s}\n.btns button:hover{transform:scale(1.05)}\n.btns button:nth-child(1){background:#ef4444;color:#fff}\n.btns button:nth-child(2){background:#64748b;color:#fff}\n.btns button:nth-child(3){background:#10b981;color:#fff}',
    js: 'var count=0;\nfunction update(){document.getElementById("count").textContent=count;}\nfunction inc(){count++;update();}\nfunction dec(){count--;update();}\nfunction reset(){count=0;update();}'
  },
  todo: {
    html: '<div class="todo-app">\n  <h1>Todo List</h1>\n  <div class="input-row">\n    <input type="text" id="todoInput" placeholder="New task..." onkeypress="if(event.key==="Enter")addTodo()">\n    <button onclick="addTodo()">Add</button>\n  </div>\n  <ul id="todoList"></ul>\n</div>',
    css: 'body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0f172a;margin:0;font-family:sans-serif}\n.todo-app{background:#1e293b;border-radius:20px;padding:30px;width:350px;color:#fff}\n.todo-app h1{color:#667eea;text-align:center;margin-bottom:20px}\n.input-row{display:flex;gap:8px;margin-bottom:16px}\n.input-row input{flex:1;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#0f172a;color:#fff;font-size:.9rem}\n.input-row button{padding:10px 16px;border:none;border-radius:8px;background:#667eea;color:#fff;cursor:pointer}\n#todoList{list-style:none;padding:0;margin:0}\n#todoList li{padding:12px;border-radius:8px;background:rgba(255,255,255,.04);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}\n#todoList li.done{text-decoration:line-through;opacity:.5}\n#todoList li .del{color:#ef4444;cursor:pointer;font-weight:700}',
    js: 'function addTodo(){\n  var input=document.getElementById("todoInput");\n  var text=input.value.trim();\n  if(!text)return;\n  var li=document.createElement("li");\n  li.innerHTML="<span>"+text+"</span><span class=\\"del\\" onclick=\\"this.parentElement.remove()\\">X</span>";\n  li.onclick=function(){this.classList.toggle("done");};\n  document.getElementById("todoList").appendChild(li);\n  input.value="";\n}'
  },
  clock: {
    html: '<div class="clock-app">\n  <h1>Digital Clock</h1>\n  <div class="clock" id="clock">00:00:00</div>\n  <div class="date" id="date"></div>\n</div>',
    css: 'body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0f172a;margin:0;font-family:sans-serif}\n.clock-app{text-align:center;color:#fff}\n.clock-app h1{color:#667eea;margin-bottom:20px}\n.clock{font-size:3.5rem;font-weight:800;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent}\n.date{color:#94a3b8;margin-top:10px;font-size:1rem}',
    js: 'function updateClock(){\n  var d=new Date();\n  var h=String(d.getHours()).padStart(2,"0");\n  var m=String(d.getMinutes()).padStart(2,"0");\n  var s=String(d.getSeconds()).padStart(2,"0");\n  document.getElementById("clock").textContent=h+":"+m+":"+s;\n  var days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];\n  var months=["January","February","March","April","May","June","July","August","September","October","November","December"];\n  document.getElementById("date").textContent=days[d.getDay()]+", "+d.getDate()+" "+months[d.getMonth()]+" "+d.getFullYear();\n}\nsetInterval(updateClock,1000);\nupdateClock();'
  }
};

var currentTab = 'html';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.pg-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('.pg-tab[data-tab="' + tab + '"]').classList.add('active');
  document.querySelectorAll('.pg-editor-wrap').forEach(function(w) { w.classList.remove('active'); });
  document.getElementById('editor-' + tab).classList.add('active');
}

function runCode() {
  var html = document.getElementById('htmlCode').value;
  var css = document.getElementById('cssCode').value;
  var js = document.getElementById('jsCode').value;
  var doc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' + css + '</style></head><body>' + html + '<scr' + 'ipt>' + js + '</scr' + 'ipt></body></html>';
  var frame = document.getElementById('previewFrame');
  frame.srcdoc = doc;
  saveCode();
}

function saveCode() {
  try {
    var data = {
      html: document.getElementById('htmlCode').value,
      css: document.getElementById('cssCode').value,
      js: document.getElementById('jsCode').value
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

function loadSaved() {
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      var data = JSON.parse(saved);
      document.getElementById('htmlCode').value = data.html || '';
      document.getElementById('cssCode').value = data.css || '';
      document.getElementById('jsCode').value = data.js || '';
      return true;
    }
  } catch (e) {}
  return false;
}

function resetCode() {
  if (!confirm('Sara code reset ho jayega. Continue?')) return;
  document.getElementById('htmlCode').value = defaultCode.html;
  document.getElementById('cssCode').value = defaultCode.css;
  document.getElementById('jsCode').value = defaultCode.js;
  runCode();
}

function copyCode() {
  var code = document.getElementById(currentTab + 'Code').value;
  navigator.clipboard.writeText(code).then(function() {
    var btn = document.querySelector('.pg-btn-copy');
    var orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(function() { btn.innerHTML = orig; }, 2000);
  }).catch(function() {
    alert('Copy nahi hua. Manually select karke Ctrl+C dabao.');
  });
}

function loadTemplate(name) {
  var tpl = templates[name];
  if (!tpl) return;
  document.getElementById('htmlCode').value = tpl.html;
  document.getElementById('cssCode').value = tpl.css;
  document.getElementById('jsCode').value = tpl.js;
  runCode();
}

// Auto-run on input change (debounced)
var runTimer = null;
function autoRun() {
  clearTimeout(runTimer);
  runTimer = setTimeout(runCode, 800);
}

document.getElementById('htmlCode').addEventListener('input', autoRun);
document.getElementById('cssCode').addEventListener('input', autoRun);
document.getElementById('jsCode').addEventListener('input', autoRun);

// Init
if (!loadSaved()) {
  document.getElementById('htmlCode').value = defaultCode.html;
  document.getElementById('cssCode').value = defaultCode.css;
  document.getElementById('jsCode').value = defaultCode.js;
}
runCode();

