import styles from "./house-playlists.module.css";

const playlists = [
  { id: "6CtJ9JaUpUMWvMK2uR2bFq", name: "Para adorar e ouvir a Deus - PR Rilldy" },
  { id: "6IftxtbEBYsz392waavwgS", name: "CASA FORTE MUSIC" },
] as const;

export default function HousePlaylists() {
  return (
    <section id="playlist-da-casa" className={styles.section} aria-labelledby="house-playlists-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Louvor no seu dia a dia</p>
        <h2 id="house-playlists-title">Playlist da Casa</h2>
        <p>Escolha uma playlist e toque no play para ouvir aqui.</p>
      </div>
      <div className={styles.grid}>
        {playlists.map((playlist) => (
          <article className={styles.card} key={playlist.id}>
            <h3>{playlist.name}</h3>
            <iframe
              src={`https://open.spotify.com/embed/playlist/${playlist.id}?utm_source=generator&theme=0`}
              title={`Spotify: ${playlist.name}`}
              width="100%"
              height="352"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
            <a href={`https://open.spotify.com/playlist/${playlist.id}`} target="_blank" rel="noopener noreferrer"
              aria-label={`Abrir ${playlist.name} no Spotify`}>Abrir no Spotify <span aria-hidden="true">↗</span></a>
          </article>
        ))}
      </div>
      <p className={styles.note}>Se o Spotify disponibilizar apenas uma prévia neste aparelho, use “Abrir no Spotify” para continuar ouvindo.</p>
    </section>
  );
}
