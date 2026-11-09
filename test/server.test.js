const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

test('public and admin HTTP endpoints', async t => {
  const port = await getFreePort();
  const username = 'test-admin';
  const password = 'test-password';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), ADMIN_USER: username, ADMIN_PASSWORD: password },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  t.after(() => child.kill());

  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 5000);
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      if (output.includes(`http://localhost:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Server exited with ${code}: ${output}`));
    });
  });

  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /RISE COFFEE/);

  const publicContent = await fetch(`${baseUrl}/api/content`);
  assert.equal(publicContent.status, 200);
  assert.ok(Array.isArray((await publicContent.json()).categories));

  const denied = await fetch(`${baseUrl}/admin/api/content`);
  assert.equal(denied.status, 401);

  const adminPage = await fetch(`${baseUrl}/admin/`, { headers: { Authorization: authorization } });
  assert.equal(adminPage.status, 200);

  const adminContent = await fetch(`${baseUrl}/admin/api/content`, { headers: { Authorization: authorization } });
  assert.equal(adminContent.status, 200);
  assert.ok(Array.isArray((await adminContent.json()).categories));

  const invalidUpdate = await fetch(`${baseUrl}/admin/api/content`, {
    method: 'PUT',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(invalidUpdate.status, 400);
});
