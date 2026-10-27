'use strict';
const form = document.getElementById('loginForm');
const button = document.getElementById('loginButton');
const error = document.getElementById('loginError');
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true; button.textContent = 'Signing in…'; error.hidden = true;
  try {
    const response = await fetch('/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('password').value }),
    });
    if (!response.ok) throw new Error('Invalid password or too many attempts. Try again later.');
    document.getElementById('password').value = '';
    location.assign('/dashboard');
  } catch (err) {
    error.textContent = err.message || 'Sign-in failed';
    error.hidden = false;
  } finally { button.disabled = false; button.textContent = 'Sign in →'; }
});
