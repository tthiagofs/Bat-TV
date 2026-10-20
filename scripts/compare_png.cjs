const fs = require('fs')

// Checa os chunks do PNG e encontra os limites da imagem
const buf1 = fs.readFileSync('logo transparente.png')
const buf2 = fs.readFileSync('logo transparente branca.png')
console.log('logo transparente len:', buf1.length)
console.log('logo transparente branca len:', buf2.length)
