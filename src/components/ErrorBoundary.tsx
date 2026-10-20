import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ((error: Error | null, reset: () => void) => ReactNode) | ReactNode
}

interface State {
  error: Error | null
}

/** Evita tela preta/branca total: se uma tela ou player falhar, mostra mensagem e permite tentar de novo. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro capturado pelo ErrorBoundary:', error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    if (this.props.fallback) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset)
      }
      return this.props.fallback
    }

    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100 p-8 text-center">
        <p className="text-lg font-bold">Algo deu errado nesta tela.</p>
        <p className="text-xs text-zinc-500 max-w-md break-words">{this.state.error.message}</p>
        <button
          type="button"
          autoFocus
          onClick={this.reset}
          className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 focus-visible:ring-4 focus-visible:ring-rose-400 focus-visible:outline-none text-white text-sm font-bold cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    )
  }
}

