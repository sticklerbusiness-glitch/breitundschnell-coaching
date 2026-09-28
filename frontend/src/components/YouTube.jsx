import { useState } from 'react'
import { youtubeId, youtubeEmbed } from '../lib/youtube.js'
import Icon from './Icon.jsx'

// B&S: the coach's own demo video for one exercise. Sits where the dataset animation sits, so
// the layout does not move when a video is attached. Styles are inline: index.css belongs to
// the branding workstream and one 16:9 box is not worth a shared rule.
//
// Zwei-Klick-Lösung (DSGVO): vor dem Tippen geht KEINE Anfrage an Google. Das Vorschaubild
// käme sonst von i.ytimg.com und das iframe von youtube-nocookie.com — beides überträgt die
// IP-Adresse des Mitglieds an Google, und genau das sagt unsere Datenschutzerklärung zu:
// erst auf Klick. Deshalb steht hier eine eigene, lokal gezeichnete Vorschau.
export default function YouTube({ id, title }) {
  const [geladen, setGeladen] = useState(false)
  const vid = youtubeId(id)
  if (!vid) return null
  const rahmen = {
    position: 'relative', width: '100%', aspectRatio: '16 / 9',
    borderRadius: 14, overflow: 'hidden', background: '#000', marginBottom: 10,
  }
  if (!geladen) return (
    <button
      type="button"
      className="ytmedia ytmedia-vorschau"
      onClick={e => { e.stopPropagation(); setGeladen(true) }}
      style={{
        ...rahmen,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: 14, border: '1px solid var(--sep)', color: 'var(--label)',
        background: 'linear-gradient(160deg, var(--surface-2), var(--surface))', cursor: 'pointer',
        font: 'inherit', textAlign: 'center',
      }}
    >
      <span style={{
        width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: 'var(--acc)', color: 'var(--on-acc)', fontSize: 24,
      }}><Icon name="play" /></span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>Video deines Coaches abspielen</span>
      <span style={{ fontSize: 12, color: 'var(--label-2)', lineHeight: 1.35 }}>
        Erst beim Tippen wird das Video von YouTube geladen — dabei erfährt Google deine IP-Adresse.
      </span>
    </button>
  )
  return (
    <div className="ytmedia" style={rahmen}>
      <iframe
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        src={youtubeEmbed(vid) + '&autoplay=1'}
        title={title || 'Video'}
        loading="lazy"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
