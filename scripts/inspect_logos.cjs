const fs = require('fs')
const path = require('path')

console.log('--- Checking logo files ---')
const files = [
  'public/logo.png',
  'logo transparente branca.png',
  'logo transparente.png',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'
]

files.forEach(f => {
  if (fs.existsSync(f)) {
    const stat = fs.statSync(f)
    console.log(f, 'exists, size:', stat.size)
  } else {
    console.log(f, 'does NOT exist')
  }
})
