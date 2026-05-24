/**
 * TCP Smart IT Desk — app.js
 * Shared application config, API client, and utilities.
 */

// ── Configuration (update before deploy) ─────────────────────
const APP_CONFIG = {
  API_URL:       'https://script.google.com/macros/s/AKfycbzM4WxnSqQRcluqEwNgzH2ObHDpZJ6--Zv_P1S-l-fISiPy3uCT2BNZ4ce7LPgSQh8x7Q/exec',
  GOOGLE_CLIENT_ID: '705896921657-6ode8bfmctd787npb0ddknmvdunrq2t3.apps.googleusercontent.com',
  SYSTEM_NAME:   'TCP Smart IT Desk',
  VERSION:       '1.0.0'
};

// ── i18n Translations ─────────────────────────────────────────
const TRANSLATIONS = {
  th: {
    app_name:       'TCP Smart IT Desk',
    login:          'เข้าสู่ระบบ',
    logout:         'ออกจากระบบ',
    dashboard:      'แดชบอร์ด',
    tickets:        'Ticket',
    new_ticket:     'เปิด Ticket ใหม่',
    analytics:      'รายงาน & วิเคราะห์',
    admin:          'ผู้ดูแลระบบ',
    loading:        'กำลังโหลด...',
    save:           'บันทึก',
    cancel:         'ยกเลิก',
    close:          'ปิด',
    confirm:        'ยืนยัน',
    search:         'ค้นหา',
    filter:         'กรอง',
    export:         'ส่งออก',
    status:         'สถานะ',
    priority:       'ความเร่งด่วน',
    type:           'ประเภท',
    assignee:       'ผู้รับผิดชอบ',
    created:        'วันที่สร้าง',
    updated:        'อัพเดตล่าสุด',
    sla_deadline:   'SLA Deadline',
    resolution:     'วิธีแก้ไข',
    description:    'รายละเอียด',
    title:          'ชื่อปัญหา',
    all_status:     'ทุกสถานะ',
    no_data:        'ไม่มีข้อมูล',
    error:          'เกิดข้อผิดพลาด',
    success:        'สำเร็จ',
    unauthorized:   'กรุณาเข้าสู่ระบบ',
    forbidden:      'ไม่มีสิทธิ์เข้าถึง'
  },
  en: {
    app_name:       'TCP Smart IT Desk',
    login:          'Sign In',
    logout:         'Sign Out',
    dashboard:      'Dashboard',
    tickets:        'Tickets',
    new_ticket:     'New Ticket',
    analytics:      'Analytics',
    admin:          'Admin',
    loading:        'Loading...',
    save:           'Save',
    cancel:         'Cancel',
    close:          'Close',
    confirm:        'Confirm',
    search:         'Search',
    filter:         'Filter',
    export:         'Export',
    status:         'Status',
    priority:       'Priority',
    type:           'Type',
    assignee:       'Assignee',
    created:        'Created',
    updated:        'Updated',
    sla_deadline:   'SLA Deadline',
    resolution:     'Resolution',
    description:    'Description',
    title:          'Title',
    all_status:     'All Statuses',
    no_data:        'No data found',
    error:          'An error occurred',
    success:        'Success',
    unauthorized:   'Please sign in',
    forbidden:      'Access denied'
  }
};

// ── Language ──────────────────────────────────────────────────
let currentLang = localStorage.getItem('tcp_lang') || 'th';
function t(key) { return (TRANSLATIONS[currentLang] || TRANSLATIONS.th)[key] || key; }
function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('tcp_lang', lang);
  document.dispatchEvent(new Event('langchange'));
}

// ── Authentication State ──────────────────────────────────────
let _idToken  = null;
let _user     = null;
let _role     = null;

function getStoredToken() {
  const ts    = parseInt(localStorage.getItem('tcp_token_ts') || '0', 10);
  const token = localStorage.getItem('tcp_token');
  if (!token || Date.now() - ts > 7 * 3600 * 1000) return null;  // 7hr expiry
  return token;
}

function storeToken(token) {
  localStorage.setItem('tcp_token',    token);
  localStorage.setItem('tcp_token_ts', Date.now().toString());
}

function clearAuth() {
  _idToken = null;
  _user    = null;
  _role    = null;
  localStorage.removeItem('tcp_token');
  localStorage.removeItem('tcp_token_ts');
  localStorage.removeItem('tcp_user');
}

function getCurrentUser() { return _user; }
function getRole()         { return _role; }
function isLoggedIn()      { return !!_idToken; }

function isITStaff()   { return _role === 'IT_STAFF'   || _role === 'IT_MANAGER'; }
function isManager()   { return _role === 'IT_MANAGER'; }

function setSession(token, user) {
  _idToken = token;
  _user    = user;
  _role    = user.role;
  storeToken(token);
  localStorage.setItem('tcp_user', JSON.stringify(user));
}

function loadStoredSession() {
  const token    = getStoredToken();
  const userJSON = localStorage.getItem('tcp_user');
  if (token && userJSON) {
    _idToken = token;
    _user    = JSON.parse(userJSON);
    _role    = _user.role;
    return true;
  }
  return false;
}

// ── API Client ────────────────────────────────────────────────
// NOTE: Token is passed as URL query param (not Authorization header)
// to avoid CORS preflight failures with Apps Script web apps.
// Apps Script reads token from e.parameter.token in authenticateRequest().
const API = {
  async get(path, params) {
    params = params || {};
    params.path = path;
    if (_idToken) params.token = _idToken;   // token in URL → no CORS preflight
    const qs  = new URLSearchParams(params).toString();
    const url = APP_CONFIG.API_URL + '?' + qs;
    try {
      const res  = await fetch(url);          // simple GET, no custom headers
      const text = await res.text();
      try { return JSON.parse(text); }
      catch(e) {
        console.error('[API.get] non-JSON response for', path, text.substring(0, 300));
        return { success: false, data: { error: 'Server returned non-JSON response' } };
      }
    } catch(e) {
      console.error('[API.get] fetch error for', path, e);
      return { success: false, data: { error: e.message || 'Network error' } };
    }
  },

  async post(path, body) {
    // Token in URL param; body carries payload only → avoids Authorization header CORS issue
    // NOTE: No Content-Type header → browser treats as simple request → no CORS preflight
    // Apps Script reads body via e.postData.contents regardless of Content-Type
    const tokenParam = _idToken ? '&token=' + encodeURIComponent(_idToken) : '';
    const url = APP_CONFIG.API_URL + '?path=' + encodeURIComponent(path) + tokenParam;
    try {
      const res  = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
      const text = await res.text();
      try { return JSON.parse(text); }
      catch(e) {
        console.error('[API.post] non-JSON response for', path, text.substring(0, 300));
        return { success: false, data: { error: 'Server returned non-JSON response' } };
      }
    } catch(e) {
      console.error('[API.post] fetch error for', path, e);
      return { success: false, data: { error: e.message || 'Network error' } };
    }
  }
};

// ── Status / Priority UI Helpers ──────────────────────────────
const STATUS_COLORS = {
  'New Requests':  { bg: '#e8f0fe', text: '#1a73e8', badge: 'badge-info' },
  'Working on it': { bg: '#fef9e7', text: '#f5a623', badge: 'badge-warning' },
  'Done':          { bg: '#e6f4ea', text: '#34a853', badge: 'badge-success' },
  'Reopened':      { bg: '#f3e8fd', text: '#9c27b0', badge: 'badge-purple' },
  'SLA Risk':      { bg: '#fff3e0', text: '#ff9800', badge: 'badge-orange' },
  'Over SLA':      { bg: '#fce8e6', text: '#ea4335', badge: 'badge-danger' }
};

const PRIORITY_COLORS = {
  'Urgent': { icon: '🔴', color: '#ea4335', class: 'priority-urgent' },
  'Normal': { icon: '🟡', color: '#f5a623', class: 'priority-normal' },
  'Low':    { icon: '🟢', color: '#34a853', class: 'priority-low' }
};

const STATUS_ICONS = {
  'New Requests':  '📥',
  'Working on it': '⚙️',
  'Done':          '✅',
  'Reopened':      '🔁',
  'SLA Risk':      '⚠️',
  'Over SLA':      '🚨'
};

function statusBadge(status) {
  const c = STATUS_COLORS[status] || { bg: '#f5f5f5', text: '#666' };
  const i = STATUS_ICONS[status] || '';
  return `<span class="badge" style="background:${c.bg};color:${c.text}">${i} ${status}</span>`;
}

function priorityBadge(priority) {
  const p = PRIORITY_COLORS[priority] || { icon: '⚪', color: '#666' };
  return `<span class="badge" style="color:${p.color}">${p.icon} ${priority}</span>`;
}

function formatDate(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  return d.toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── Date Input Helpers (DD/MM/YYYY) — shared across all pages ─
function formatDateInput(input) {
  // Auto-insert slashes: dd/mm/yyyy as user types
  let v = input.value.replace(/\D/g, '').substring(0, 8);
  if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
  if (v.length >= 6) v = v.substring(0, 5) + '/' + v.substring(5);
  input.value = v;
}

function parseDDMMYYYY(str) {
  if (!str || str.length < 8) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return null;
  const date = new Date(y + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0'));
  return isNaN(date.getTime()) ? null : date;
}

function todayDDMMYYYY() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return d + '/' + m + '/' + y;
}

function dateToDDMMYYYY(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return String(d.getDate()).padStart(2, '0') + '/' +
         String(d.getMonth() + 1).padStart(2, '0') + '/' +
         d.getFullYear();
}

function timeAgo(dt) {
  if (!dt) return '';
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return mins + ' นาทีที่แล้ว';
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return hrs  + ' ชั่วโมงที่แล้ว';
  return Math.floor(hrs / 24) + ' วันที่แล้ว';
}

// ── Toast Notifications ───────────────────────────────────────
function showToast(msg, type, duration) {
  type     = type     || 'info';   // info, success, error, warning
  duration = duration || 3500;
  const colors = { info:'#1a73e8', success:'#34a853', error:'#ea4335', warning:'#f5a623' };
  const icons  = { info:'ℹ️', success:'✅', error:'❌', warning:'⚠️' };

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `background:#fff;border-left:4px solid ${colors[type]};box-shadow:0 4px 12px rgba(0,0,0,.15);padding:12px 16px;border-radius:4px;display:flex;align-items:center;gap:10px;min-width:280px;max-width:380px;animation:slideIn .2s ease`;
  toast.innerHTML = `<span style="font-size:18px">${icons[type]}</span><span style="font-size:14px;color:#333;flex:1">${msg}</span><button onclick="this.parentElement.remove()" style="border:none;background:none;cursor:pointer;color:#999;font-size:18px">×</button>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Modal Helper ──────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

// ── Loading Overlay ───────────────────────────────────────────
function showLoader(text) {
  let el = document.getElementById('global-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loader';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.8);z-index:9998;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px';
    el.innerHTML = '<div class="spinner"></div><p style="color:#1a73e8;font-size:14px" id="loader-text"></p>';
    document.body.appendChild(el);
  }
  document.getElementById('loader-text').textContent = text || t('loading');
  el.style.display = 'flex';
}
function hideLoader() {
  const el = document.getElementById('global-loader');
  if (el) el.style.display = 'none';
}

// ── Dark Mode ─────────────────────────────────────────────────
function initDarkMode() {
  const stored = localStorage.getItem('tcp_dark');
  if (stored === 'true' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('tcp_dark', !isDark);
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();

  // Inject CSS animation
  const style = document.createElement('style');
  style.textContent = `@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:none;opacity:1}}`;
  document.head.appendChild(style);
});
