import { useState, useEffect } from 'react'
import { trailerCoordinator } from '../services/trailerCoordinator'

export function useTrailerSync(trailerId?: string) {
  const [isMuted, setIsMuted] = useState(trailerCoordinator.isMuted)
  const [activeId, setActiveId] = useState(trailerCoordinator.activeTrailerId)

  useEffect(() => {
    return trailerCoordinator.subscribe(() => {
      setIsMuted(trailerCoordinator.isMuted)
      setActiveId(trailerCoordinator.activeTrailerId)
    })
  }, [])

  const canPlay = !trailerId || activeId === trailerId

  const requestPlay = (id = trailerId) => {
    if (id) return trailerCoordinator.requestPlay(id)
    return false
  }

  const releasePlay = (id = trailerId) => {
    if (id) trailerCoordinator.releasePlay(id)
  }

  const toggleMuted = () => trailerCoordinator.toggleMuted()
  const setMuted = (muted: boolean) => trailerCoordinator.setMuted(muted)
  const stopAll = () => trailerCoordinator.stopAll()

  return {
    isMuted,
    setMuted,
    toggleMuted,
    activeId,
    canPlay,
    requestPlay,
    releasePlay,
    stopAll,
  }
}
