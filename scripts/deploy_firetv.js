import { execSync } from 'child_process'
import path from 'path'

const adbPath = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
const apkPath = path.resolve('BAT-TV.apk')
const fireTvIp = '192.168.0.4:5555'

function run(cmd) {
  try {
    console.log(`> ${cmd}`)
    const out = execSync(`"${adbPath}" ${cmd}`, { stdio: 'pipe' }).toString()
    console.log(out)
    return out
  } catch (err) {
    console.error(`Erro executando: ${cmd}\n`, err.stdout?.toString() || err.message)
    return null
  }
}

console.log('--- Verificando conexão ADB com Fire TV ---')
run(`connect ${fireTvIp}`)
run('devices')

console.log('--- Instalando BAT-TV.apk no Fire TV Stick ---')
const installResult = run(`-s ${fireTvIp} install -r "${apkPath}"`)

if (installResult && installResult.includes('Success')) {
  console.log('✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO NO FIRE TV!')
} else {
  console.log('Tentando instalação alternativa com adb sem especificar IP se for o único device:')
  run(`install -r "${apkPath}"`)
}
