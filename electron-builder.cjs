const path = require('node:path');
module.exports = {
  appId: 'com.shenzhen3d.performance', productName: 'Shenzhen 3D Performance', asar: true,
  npmRebuild: false, files: ['dist/**/*', 'electron/*.cjs', 'package.json', '!**/*.test.cjs'],
  extraResources: [
    { from: path.join(__dirname, 'node_modules/electron/dist/LICENSE'), to: 'Electron-LICENSE.txt' },
    { from: path.join(__dirname, 'node_modules/electron/dist/LICENSES.chromium.html'), to: 'Chromium-LICENSES.html' },
  ],
  mac: { target: [{ target: 'dmg', arch: ['arm64'] }], category: 'public.app-category.graphics-design', icon: path.join(__dirname, 'src-tauri/icons/icon.icns'), minimumSystemVersion: '13.0', identity: 'INTUITION Robotique & Technologies (66LJ4BV7Q3)', hardenedRuntime: true, notarize: false },
  dmg: {
    sign: true,
    title: 'Shenzhen 3D ${version}',
    background: path.join(__dirname, 'electron/installer/background.png'),
    window: { width: 760, height: 500 },
    iconSize: 112,
    iconTextSize: 13,
    contents: [
      { x: 210, y: 280, type: 'file' },
      { x: 550, y: 280, type: 'link', path: '/Applications' },
    ],
  },
  artifactName: 'Shenzhen-3D-${version}-Apple-Silicon.${ext}',

};
