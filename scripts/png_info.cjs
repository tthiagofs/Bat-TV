const fs = require('fs')

function getPngInfo(file) {
  const buf = fs.readFileSync(file)
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  return { file, w, h, size: buf.length }
}

console.log(getPngInfo('public/logo.png'))
console.log(getPngInfo('logo transparente.png'))
console.log(getPngInfo('logo transparente branca.png'))
console.log(getPngInfo('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'))
