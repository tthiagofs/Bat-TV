import { useState, type FormEvent } from 'react'
import { Tv, Loader2, Plus, Trash2, Play, ArrowLeft, Server, Pencil } from 'lucide-react'
import { useAuth, type Profile } from '../context/AuthContext'
import batLogo from '../assets/logo.png'

const emptyForm = { name: '', server: '', username: '', password: '' }

export default function Login() {
  const { profiles, active, addProfile, updateProfile, removeProfile, selectProfile, closeManager } = useAuth()
  const [adding, setAdding] = useState(profiles.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const startAdd = () => { setEditingId(null); setForm(emptyForm); setError(''); setAdding(true) }
  const startEdit = (p: Profile) => {
    setEditingId(p.id)
    setForm({ name: p.name, server: p.server, username: p.username, password: p.password })
    setError(''); setAdding(true)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (editingId) {
        await updateProfile({ ...form, id: editingId })
        setAdding(false)
      } else {
        await addProfile(form, true)
      }
      setForm(emptyForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao conectar')
    } finally {
      setLoading(false)
    }
  }

  const input =
    'w-full rounded-lg bg-zinc-800/80 border border-zinc-700 px-4 py-3 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 transition'

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-rose-950/40 p-6">
      <div className="w-[460px] max-w-full p-8 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur shadow-2xl fade-up">
        <div className="flex flex-col items-center gap-2 mb-6">
          <img
            src={batLogo}
            alt="BAT TV"
            className="h-20 w-auto object-contain drop-shadow-xl mb-1 hover:scale-105 transition-transform"
          />
          <h1 className="text-2xl font-bold">Gerenciador de Listas</h1>
          <p className="text-sm text-zinc-400">Escolha uma lista ou adicione uma nova conexão Xtream</p>
        </div>

        {!adding ? (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border transition ${active?.id === p.id ? 'border-rose-500 bg-rose-500/10' : 'border-zinc-800 bg-zinc-800/40 hover:border-zinc-600'}`}>
                <Server size={18} className="text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{p.username} · {p.server}</p>
                </div>
                <button onClick={() => selectProfile(p.id)} className="p-2 rounded-full bg-rose-600 hover:bg-rose-500 transition" aria-label={`Entrar em ${p.name}`} title="Entrar"><Play size={14} className="fill-white" /></button>
                <button onClick={() => startEdit(p)} className="p-2 rounded-full hover:bg-zinc-700 transition" aria-label="Editar" title="Editar"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm(`Excluir a lista "${p.name}"?`)) removeProfile(p.id) }} className="p-2 rounded-full hover:bg-zinc-700 hover:text-rose-400 transition" aria-label="Excluir" title="Excluir"><Trash2 size={14} /></button>
              </div>
            ))}
            <button id="add-list-btn" onClick={startAdd} className="w-full flex justify-center items-center gap-2 rounded-xl border border-dashed border-zinc-700 hover:border-rose-500 hover:text-rose-400 py-3 text-sm transition">
              <Plus size={16} /> Adicionar nova lista
            </button>
            {active && (
              <button onClick={closeManager} className="w-full flex justify-center items-center gap-2 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition">
                <ArrowLeft size={14} /> Voltar para "{active.name}"
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input id="list-name" className={input} placeholder="Nome da lista (ex.: Casa)" value={form.name} onChange={set('name')} required />
            <input id="server" className={input} placeholder="http://servidor.com:8080" value={form.server} onChange={set('server')} required />
            <input id="username" className={input} placeholder="Usuário" value={form.username} onChange={set('username')} required />
            <input id="password" type="password" className={input} placeholder="Senha" value={form.password} onChange={set('password')} required />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button id="connect-btn" disabled={loading} className="w-full flex justify-center items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 py-3 font-semibold transition">
              {loading && <Loader2 size={16} className="animate-spin" />} {editingId ? 'Salvar' : 'Salvar e conectar'}
            </button>
            {profiles.length > 0 && (
              <button type="button" onClick={() => setAdding(false)} className="w-full flex justify-center items-center gap-2 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition">
                <ArrowLeft size={14} /> Voltar às listas
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
