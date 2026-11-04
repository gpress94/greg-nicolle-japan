// unlock.js — the family site's password gate.
//
// The itinerary ships encrypted in data/days.enc.json. This asks for the trip
// password (any capitalization), derives the key with PBKDF2 and decrypts it
// with AES-GCM in the browser. A correct password is remembered on the device.
// It is light protection by design: enough to keep the plans off search
// engines and away from casual visitors.

const SAVED = 'family:password';
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const normalize = (s) => String(s ?? '').trim().toLowerCase();

function remembered() { try { return localStorage.getItem(SAVED); } catch { return null; } }
function remember(value) { try { localStorage.setItem(SAVED, value); } catch { /* Private browsing: ask again next time. */ } }

async function decrypt(box, password) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(box.salt), iterations: box.iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

const STYLE = `
.fg-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:var(--paper-bg,#e4d5bd);color:var(--ink,#203140)}
.fg-card{width:min(100%,360px);padding:28px 24px;border-radius:var(--radius-lg,20px);background:var(--card-solid,#f3e8d5);box-shadow:var(--shadow-lg,0 24px 64px rgba(6,28,45,.25));text-align:center}
.fg-card h1{margin:0 0 6px;font-size:1.7rem;color:var(--brand-deep,#0b3d66)}
.fg-card p{margin:0 0 18px;color:var(--ink-soft,#4f6577);line-height:1.45}
.fg-card label{display:block;text-align:left;font-weight:600;margin-bottom:6px}
.fg-card input{width:100%;box-sizing:border-box;font:inherit;font-size:1rem;padding:12px 14px;border:1px solid var(--line,rgba(101,78,48,.28));border-radius:var(--radius-md,14px);background:#fffaf2;color:inherit}
.fg-card button{margin-top:12px;width:100%;font:inherit;font-weight:700;font-size:1rem;padding:12px 14px;border:0;border-radius:var(--radius-md,14px);background:var(--brand-deep,#0b3d66);color:#fff;cursor:pointer}
.fg-card button:disabled{opacity:.6;cursor:progress}
.fg-error{min-height:1.3em;margin:10px 0 0;color:#8f2d1f;font-weight:600}`;

function ask(box) {
  return new Promise((resolve) => {
    const style = Object.assign(document.createElement('style'), { textContent: STYLE });
    const overlay = document.createElement('div');
    overlay.className = 'fg-overlay';
    const card = document.createElement('form');
    card.className = 'fg-card';
    const title = Object.assign(document.createElement('h1'), { textContent: 'Japan, together' });
    const line = Object.assign(document.createElement('p'), { textContent: 'Greg & Nicolle’s honeymoon in Japan. Enter the password they shared with you.' });
    const label = Object.assign(document.createElement('label'), { textContent: 'Password', htmlFor: 'fg-password' });
    const input = Object.assign(document.createElement('input'), { id: 'fg-password', type: 'password', autocomplete: 'current-password', required: true });
    input.setAttribute('autocapitalize', 'none');
    const button = Object.assign(document.createElement('button'), { type: 'submit', textContent: 'Open' });
    const error = Object.assign(document.createElement('p'), { className: 'fg-error' });
    error.setAttribute('aria-live', 'polite');
    card.append(title, line, label, input, button, error);
    overlay.append(card);
    document.head.append(style);
    document.body.append(overlay);
    input.focus();
    card.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = normalize(input.value);
      button.disabled = true;
      error.textContent = '';
      try {
        const data = await decrypt(box, password);
        remember(password);
        overlay.remove();
        style.remove();
        resolve(data);
      } catch {
        error.textContent = 'That isn’t it. Try again.';
        button.disabled = false;
        input.select();
      }
    });
  });
}

export async function unlock() {
  const box = await fetch(new URL('./data/days.enc.json', import.meta.url)).then((r) => r.json());
  const saved = remembered();
  if (saved) {
    try { return await decrypt(box, saved); } catch { /* The password changed: ask again. */ }
  }
  return ask(box);
}
