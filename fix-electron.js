const { downloadArtifact } = require('@electron/get');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const electronDir = path.join(__dirname, 'node_modules', 'electron');
const ver = require(path.join(electronDir, 'package.json')).version;

console.log(`Fixing Electron ${ver}...`);

downloadArtifact({ version: ver, artifactName: 'electron', platform: 'win32', arch: 'x64' })
  .then(zipPath => {
    console.log('Zip encontrado:', zipPath);
    const dist = path.join(electronDir, 'dist');
    fs.mkdirSync(dist, { recursive: true });
    console.log('Extraindo...');
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${dist}' -Force"`);
    fs.writeFileSync(path.join(electronDir, 'path.txt'), 'electron.exe');
    console.log('Pronto! Roda npm start agora.');
  })
  .catch(e => console.error('Erro:', e.message));