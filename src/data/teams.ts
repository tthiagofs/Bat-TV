export interface Club {
  key: string
  name: string
  search: string
  short: string
  c1: string
  c2: string
  country: 'br' | 'eu'
  badge: string
}

export const CLUBS: Club[] = [
  { key: 'flamengo', name: 'Flamengo', search: 'Flamengo', short: 'FLA', c1: '#dc2626', c2: '#111111', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png' },
  { key: 'corinthians', name: 'Corinthians', search: 'Corinthians', short: 'SCCP', c1: '#f4f4f5', c2: '#18181b', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/vvuvps1473538042.png' },
  { key: 'palmeiras', name: 'Palmeiras', search: 'Palmeiras', short: 'PAL', c1: '#15803d', c2: '#14532d', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png' },
  { key: 'saopaulo', name: 'São Paulo', search: 'Sao Paulo', short: 'SPFC', c1: '#dc2626', c2: '#18181b', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png' },
  { key: 'santos', name: 'Santos', search: 'Santos', short: 'SAN', c1: '#f4f4f5', c2: '#3f3f46', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/j8xk9g1679447486.png' },
  { key: 'gremio', name: 'Grêmio', search: 'Gremio', short: 'GRE', c1: '#0ea5e9', c2: '#18181b', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/uvpwyt1473538089.png' },
  { key: 'internacional', name: 'Internacional', search: 'Internacional', short: 'INT', c1: '#dc2626', c2: '#7f1d1d', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/yprvxx1473538097.png' },
  { key: 'cruzeiro', name: 'Cruzeiro', search: 'Cruzeiro', short: 'CRU', c1: '#2563eb', c2: '#1e3a8a', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/upsvvu1473538059.png' },
  { key: 'atletico-mg', name: 'Atlético-MG', search: 'Atletico Mineiro', short: 'CAM', c1: '#27272a', c2: '#f4f4f5', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/x5lixs1743742872.png' },
  { key: 'fluminense', name: 'Fluminense', search: 'Fluminense', short: 'FLU', c1: '#7f1d1d', c2: '#15803d', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/stvvwp1473538082.png' },
  { key: 'vasco', name: 'Vasco da Gama', search: 'Vasco da Gama', short: 'VAS', c1: '#18181b', c2: '#e4e4e7', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/ynqlxo1630521109.png' },
  { key: 'botafogo', name: 'Botafogo', search: 'Botafogo', short: 'BOT', c1: '#18181b', c2: '#f4f4f5', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/bs5mbw1733004596.png' },
  { key: 'bahia', name: 'Bahia', search: 'Bahia', short: 'BAH', c1: '#1d4ed8', c2: '#dc2626', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/xuvtsv1473539308.png' },
  { key: 'fortaleza', name: 'Fortaleza', search: 'Fortaleza', short: 'FOR', c1: '#1d4ed8', c2: '#dc2626', country: 'br', badge: 'https://r2.thesportsdb.com/images/media/team/badge/tosmdr1532853458.png' },
  { key: 'real-madrid', name: 'Real Madrid', search: 'Real Madrid', short: 'RMA', c1: '#f4f4f5', c2: '#ca8a04', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/vwvwrw1473502969.png' },
  { key: 'barcelona', name: 'Barcelona', search: 'Barcelona', short: 'FCB', c1: '#1d4ed8', c2: '#9f1239', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/wq9sir1639406443.png' },
  { key: 'man-city', name: 'Manchester City', search: 'Manchester City', short: 'MCI', c1: '#38bdf8', c2: '#0c4a6e', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png' },
  { key: 'man-united', name: 'Manchester United', search: 'Manchester United', short: 'MUN', c1: '#dc2626', c2: '#18181b', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png' },
  { key: 'liverpool', name: 'Liverpool', search: 'Liverpool', short: 'LIV', c1: '#b91c1c', c2: '#fbbf24', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/kfaher1737969724.png' },
  { key: 'arsenal', name: 'Arsenal', search: 'Arsenal', short: 'ARS', c1: '#dc2626', c2: '#f4f4f5', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png' },
  { key: 'chelsea', name: 'Chelsea', search: 'Chelsea', short: 'CHE', c1: '#1d4ed8', c2: '#1e3a8a', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/pbf4ul1782638263.png' },
  { key: 'bayern', name: 'Bayern de Munique', search: 'Bayern Munich', short: 'FCB', c1: '#dc2626', c2: '#1e3a8a', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/01ogkh1716960412.png' },
  { key: 'psg', name: 'Paris Saint-Germain', search: 'Paris SG', short: 'PSG', c1: '#1e3a8a', c2: '#dc2626', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/has8b01763050866.png' },
  { key: 'juventus', name: 'Juventus', search: 'Juventus', short: 'JUV', c1: '#f4f4f5', c2: '#18181b', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/uxf0gr1742983727.png' },
  { key: 'milan', name: 'Milan', search: 'AC Milan', short: 'MIL', c1: '#dc2626', c2: '#18181b', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/wvspur1448806617.png' },
  { key: 'inter', name: 'Inter de Milão', search: 'Inter Milan', short: 'INT', c1: '#1d4ed8', c2: '#18181b', country: 'eu', badge: 'https://r2.thesportsdb.com/images/media/team/badge/ryhu6d1617113103.png' },
]

export const clubByKey = (key?: string) => CLUBS.find((c) => c.key === key)
